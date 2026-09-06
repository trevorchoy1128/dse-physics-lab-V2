import { useCallback, useRef } from "react";
import { Canvas2D, ARROW_STYLE } from "@/components";
import { sig } from "@/shell/format";
import { useLang } from "@/i18n/lang";
import type { ArrowKind, RenderPlan, SceneProps, Vec3 } from "@/shell/types";

// 與 3D 同步的三個平面視窗：側視投影（x–y，顯示垂直運動）、俯視投影（x–z，顯示水平勻速運動）、動能—時間圖。
// 只畫 plan 的結果：世界座標 ÷ k 還原為米；箭嘴用與 3D 相同的 kind 顏色、線型與縮放比例。沒有物理。

const nice = (m: number) => { const e = 10 ** Math.floor(Math.log10(m)); const f = m / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; };
const COLOR_A = "#e0891c", COLOR_B = "#4a6fa5";
/** 軸刻度：三位有效數字後去掉小數尾零（100 仍是 100，不會變成 1） */
const fmt = (x: number) => sig(x).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

function arrow2d(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, kind: ArrowKind, label?: string) {
  const st = ARROW_STYLE[kind];
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len, uy = dy / len;
  const head = Math.min(12, Math.max(6, len * 0.25));
  ctx.save();
  ctx.strokeStyle = st.color; ctx.fillStyle = st.color; ctx.lineWidth = kind === "net" ? 3 : 2;
  ctx.setLineDash(st.dashed ? [5, 4] : []);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * (st.head === "cone" ? head : 0), y1 - uy * (st.head === "cone" ? head : 0)); ctx.stroke();
  ctx.setLineDash([]);
  if (st.head === "cone") {
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - ux * head - uy * head * 0.45, y1 - uy * head + ux * head * 0.45);
    ctx.lineTo(x1 - ux * head + uy * head * 0.45, y1 - uy * head - ux * head * 0.45);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1 - ux * head - uy * head * 0.5, y1 - uy * head + ux * head * 0.5); ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - ux * head + uy * head * 0.5, y1 - uy * head - ux * head * 0.5); ctx.stroke();
  }
  if (label) { ctx.font = "italic bold 13px system-ui, sans-serif"; ctx.fillText(label, x1 + ux * 6 + 2, y1 + uy * 6 + 4); }
  ctx.restore();
}

function axes(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, xMax: number, yMax: number, xLab: string, yLab: string, ink: string, ink3: string, line: string, px: (x: number) => number, py: (y: number) => number) {
  ctx.save();
  ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.fillStyle = ink3; ctx.font = "11px 'IBM Plex Mono', monospace";
  const sx = nice(xMax / 4), sy = nice(yMax / 3);
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let x = 0; x <= xMax + 1e-9; x += sx) { const X = px(x); ctx.beginPath(); ctx.moveTo(X, y0); ctx.lineTo(X, y1); ctx.stroke(); ctx.fillText(fmt(x), X, y1 + 3); }
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let y = 0; y <= yMax + 1e-9; y += sy) { const Y = py(y); ctx.beginPath(); ctx.moveTo(x0, Y); ctx.lineTo(x1, Y); ctx.stroke(); ctx.fillText(fmt(y), x0 - 4, Y); }
  ctx.strokeStyle = ink; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.fillStyle = ink; ctx.font = "italic 12px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(xLab, x1, y1 - 3);
  ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(yLab, x0 + 4, y0);
  ctx.restore();
}

type Ctx = CanvasRenderingContext2D;
interface Theme { ink: string; ink3: string; line: string; accent: string }
const theme = (): Theme => {
  const css = getComputedStyle(document.documentElement);
  const v = (k: string, d: string) => css.getPropertyValue(k).trim() || d;
  return { ink: v("--ink", "#1b2530"), ink3: v("--ink-3", "#7b8591"), line: v("--line", "#d8ddd7"), accent: v("--accent", "#0e6f6a") };
};
const ball = (ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 1) => { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };

// ---- 側視投影 x–y（米，等比例）----
function drawSide(plan: RenderPlan, zh: boolean): (ctx: Ctx, w: number, h: number) => void {
  return (ctx, w, h) => {
    const m = plan.meta!, k = m.k, T = theme();
    const L = m.L, Y = Math.max(m.yMax * 1.15, L * 0.25, 1);
    const x0 = 34, y1 = h - 20, x1 = w - 10, y0 = 22;
    const sc = Math.min((x1 - x0) / L, (y1 - y0) / Y);   // 等比例
    const px = (x: number) => x0 + x * sc, py = (y: number) => y1 - y * sc;
    const toM = (p: Vec3): [number, number] => [p[0] / k, (p[1] - m.r) / k];
    // 頻閃照片模式（老師 2026-09-06 定加入）：黑底、只留每 0.1 s 的影像與比例尺，模仿 DSE 試卷的頻閃照片
    if (m.photo) {
      ctx.fillStyle = "#0b0f14"; ctx.fillRect(0, 0, w, h);
      for (const b of plan.bodies ?? []) {
        if (b.key.startsWith("strobe-a-")) { const [x, y] = toM(b.position); ball(ctx, px(x), py(y), 4, "#f5f5f0"); }
        if (b.key.startsWith("strobe-b-")) { const [x, y] = toM(b.position); ball(ctx, px(x), py(y), 4, "#9fc5ff"); }
      }
      const A = toM(plan.bodies!.find(b => b.key === "ball-a")!.position); ball(ctx, px(A[0]), py(A[1]), 5, "#ffb347");
      const bar = nice(L / 5);
      ctx.save(); ctx.strokeStyle = "#f5f5f0"; ctx.fillStyle = "#f5f5f0"; ctx.lineWidth = 2; ctx.font = "11px 'IBM Plex Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.beginPath(); ctx.moveTo(px(0), y1 + 4); ctx.lineTo(px(bar), y1 + 4); ctx.stroke(); ctx.fillText(`${fmt(bar)} m`, px(bar / 2), y1 + 6);
      ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
      ctx.fillText(zh ? "頻閃照片（每 0.1 s）" : "Strobe photo (every 0.1 s)", w - 8, 14); ctx.restore();
      return;
    }
    axes(ctx, x0, y0, x1, y1, L, Math.min(Y, (y1 - y0) / sc), "x / m", "y / m", T.ink, T.ink3, T.line, px, py);
    const trail = (key: string) => plan.trails?.find(t => t.key === key);
    // 各角度路徑
    for (const g of plan.trails?.filter(t => t.key.startsWith("ghost-")) ?? []) {
      ctx.save(); ctx.strokeStyle = g.key === "ghost-45" ? T.accent : "#8a94a0"; ctx.setLineDash([5, 4]); ctx.lineWidth = g.key === "ghost-45" ? 2 : 1;
      ctx.beginPath(); g.points.forEach((p, i) => { const [x, y] = toM(p); i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y)); }); ctx.stroke();
      const mid = toM(g.points[Math.floor(g.points.length / 2)]); ctx.fillStyle = T.ink3; ctx.font = "11px system-ui"; ctx.fillText(`${g.key.slice(6)}°`, px(mid[0]) + 3, py(mid[1]) - 3);
      ctx.restore();
    }
    // 路徑
    for (const [key, color] of [["path-a", COLOR_A], ["path-b", COLOR_B]] as const) {
      const tr = trail(key); if (!tr || tr.points.length < 2) continue;
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
      tr.points.forEach((p, i) => { const [x, y] = toM(p); i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y)); }); ctx.stroke(); ctx.restore();
    }
    // 頻閃影像
    for (const b of plan.bodies ?? []) {
      if (b.key.startsWith("strobe-a-")) { const [x, y] = toM(b.position); ball(ctx, px(x), py(y), 3.5, COLOR_A, 0.45); ball(ctx, x0 + 7, py(y), 2.5, "#6b7480", 0.8); }   // y 軸旁：只顯示高度的灰點列（垂直運動）
      if (b.key.startsWith("strobe-b-")) { const [x, y] = toM(b.position); ball(ctx, px(x), py(y), 3.5, COLOR_B, 0.45); }
    }
    // 發射器平台
    if (m.h > 0) { ctx.save(); ctx.fillStyle = "#9aa5b1"; ctx.fillRect(px(0) - 8, py(m.h), 8, y1 - py(m.h)); ctx.restore(); }
    // 兩球與高度連線
    const A = toM(plan.bodies!.find(b => b.key === "ball-a")!.position);
    const B = plan.bodies!.find(b => b.key === "ball-b"); const Bm = B ? toM(B.position) : null;
    if (Bm) { ctx.save(); ctx.strokeStyle = T.ink; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x0, py(A[1])); ctx.lineTo(px(Math.max(A[0], Bm[0])) + 8, py(A[1])); ctx.stroke(); ctx.restore(); }
    if (Bm) ball(ctx, px(Bm[0]), py(Bm[1]), 6, COLOR_B);
    ball(ctx, px(A[0]), py(A[1]), 6, COLOR_A);
    // 箭嘴：與 3D 相同比例（畫出長度 = |v| × scale 世界單位 → ÷ k 米 → × sc 像素）
    for (const a of plan.arrows) {
      const o = toM(a.origin); const s = (plan.scales[a.kind] ?? 1) / k * sc;
      const dx = a.kind === "acceleration" ? 12 : 0;   // 側視中加速度與重量同向：向右偏 12 px，箭嘴與標籤都分得開
      arrow2d(ctx, px(o[0]) + dx, py(o[1]), px(o[0]) + dx + a.vector[0] * s, py(o[1]) - a.vector[1] * s, a.kind, a.label);
    }
    ctx.save(); ctx.fillStyle = T.ink; ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.fillText(zh ? "側視投影（垂直運動）" : "Side projection (vertical motion)", w - 8, 14); ctx.restore();
  };
}

// ---- 俯視投影 x–z（x 為米；z 只分兩條跑道）----
function drawTop(plan: RenderPlan, zh: boolean): (ctx: Ctx, w: number, h: number) => void {
  return (ctx, w, h) => {
    const m = plan.meta!, k = m.k, T = theme();
    const L = m.L;
    const x0 = 34, x1 = w - 10, y0 = 22, y1 = h - 20;
    const px = (x: number) => x0 + ((x1 - x0) * x) / L;
    const laneA = y0 + (y1 - y0) * (m.hasB ? 0.68 : 0.5), laneB = y0 + (y1 - y0) * 0.3;
    // x 軸格線
    ctx.save(); ctx.strokeStyle = T.line; ctx.fillStyle = T.ink3; ctx.font = "11px 'IBM Plex Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    const sx = nice(L / 4);
    for (let x = 0; x <= L + 1e-9; x += sx) { ctx.beginPath(); ctx.moveTo(px(x), y0); ctx.lineTo(px(x), y1); ctx.stroke(); ctx.fillText(fmt(x), px(x), y1 + 3); }
    ctx.strokeStyle = T.ink; ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.fillStyle = T.ink; ctx.font = "italic 12px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("x / m", x1, y1 - 3);
    // 跑道
    ctx.strokeStyle = T.line; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x0, laneA); ctx.lineTo(x1, laneA); ctx.stroke();
    if (m.hasB) { ctx.beginPath(); ctx.moveTo(x0, laneB); ctx.lineTo(x1, laneB); ctx.stroke(); }
    ctx.restore();
    // 頻閃影子：水平間距相等
    for (const b of plan.bodies ?? []) {
      if (b.key.startsWith("shadow-a-")) ball(ctx, px(b.position[0] / k), laneA, 3.5, COLOR_A, 0.55);
      if (b.key.startsWith("shadow-b-")) ball(ctx, px(b.position[0] / k), laneB, 3.5, COLOR_B, 0.55);
    }
    const A = plan.bodies!.find(b => b.key === "ball-a")!, B = plan.bodies!.find(b => b.key === "ball-b");
    if (B) ball(ctx, px(B.position[0] / k), laneB, 6, COLOR_B);
    ball(ctx, px(A.position[0] / k), laneA, 6, COLOR_A);
    // 只畫水平分量箭嘴（俯視看不到垂直）
    const scPx = (x1 - x0) / L;
    for (const a of plan.arrows) {
      if (a.layer !== "vx") continue;
      const lane = a.origin[2] === 0 ? laneA : laneB;
      const s = (plan.scales[a.kind] ?? 1) / k * scPx;
      arrow2d(ctx, px(a.origin[0] / k), lane, px(a.origin[0] / k) + a.vector[0] * s, lane, a.kind, a.label);
    }
    ctx.save(); ctx.fillStyle = T.ink; ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.fillText(zh ? "俯視投影（水平運動）" : "Top projection (horizontal motion)", w - 8, 14); ctx.restore();
  };
}

// ---- 動能—時間圖 ----
function drawEk(plan: RenderPlan, zh: boolean): (ctx: Ctx, w: number, h: number) => void {
  return (ctx, w, h) => {
    const m = plan.meta!, T = theme();
    const tMax = Math.max(m.tf, 0.5), EkMax = Math.max(m.EkMax * 1.1, 1);
    const x0 = 44, x1 = w - 10, y0 = 22, y1 = h - 20;
    const px = (t: number) => x0 + ((x1 - x0) * t) / tMax, py = (E: number) => y1 - ((y1 - y0) * E) / EkMax;
    axes(ctx, x0, y0, x1, y1, tMax, EkMax, "t / s", zh ? "Eₖ / J" : "Eₖ / J", T.ink, T.ink3, T.line, px, py);
    // ½ m vₓ² 參考線（只在無空氣阻力時有意義：有阻力時 vₓ 隨時間減小，動能最低點不再是 ½ m (u cosθ)²）
    if (!m.air) {
    ctx.save(); ctx.strokeStyle = T.accent; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x0, py(m.EkMin)); ctx.lineTo(x1, py(m.EkMin)); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = T.accent; ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    ctx.fillText(`½mvₓ² = ${sig(m.EkMin)} J`, x1 - 2, py(m.EkMin) - 2); ctx.restore();
    }
    for (const [key, color] of [["Ek-t", COLOR_A], ["EkB-t", COLOR_B]] as const) {
      const tr = plan.trails?.find(t => t.key === key); if (!tr || tr.points.length < 2) continue;
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      tr.points.forEach((p, i) => (i ? ctx.lineTo(px(p[0]), py(p[1])) : ctx.moveTo(px(p[0]), py(p[1])))); ctx.stroke();
      const last = tr.points[tr.points.length - 1]; ball(ctx, px(last[0]), py(last[1]), 4, color); ctx.restore();
    }
    ctx.save(); ctx.fillStyle = T.ink; ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.fillText(zh ? `動能—時間圖（m = ${fmt(m.m)} kg）` : `Kinetic energy–time (m = ${fmt(m.m)} kg)`, w - 8, 14); ctx.restore();
  };
}

export default function Views({ plan }: SceneProps) {
  const lang = useLang(s => s.lang);
  const zh = lang === "zh";
  const frame = useRef(0); frame.current++;
  const side = useCallback(drawSide(plan, zh), [plan, zh]);
  const top = useCallback(drawTop(plan, zh), [plan, zh]);
  const ek = useCallback(drawEk(plan, zh), [plan, zh]);
  return (
    <>
      <div className="view"><Canvas2D draw={side} frame={frame.current} /></div>
      <div className="view"><Canvas2D draw={top} frame={frame.current} /></div>
      <div className="view"><Canvas2D draw={ek} frame={frame.current} /></div>
    </>
  );
}
