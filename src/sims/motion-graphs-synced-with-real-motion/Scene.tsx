import { useCallback, useRef } from "react";
import { Canvas2D, ARROW_STYLE } from "@/components";
import { sig } from "@/shell/format";
import { useLang } from "@/i18n/lang";
import type { RenderPlan, SceneProps } from "@/shell/types";

// 2D 場景：上方直線軌道與小車，下方 s–t、v–t、a–t 三張線圖。只畫 plan，不算物理。
// 「由圖生成運動」時 v–t 圖上每秒一個可拖的控制點（拖動範圍 ≥ 44 px），拖動結果經 onInput("vt", …) 交回。

interface Pane { x: number; y: number; w: number; h: number; yMin: number; yMax: number; tMax: number }
interface Layout { track: { x: number; y: number; w: number; h: number; smax: number }; panes: Record<"s" | "v" | "a", Pane> }

const nice = (m: number) => { const e = 10 ** Math.floor(Math.log10(m)); const f = m / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };

function layoutOf(w: number, h: number, meta: Record<string, number>): Layout {
  const trackH = Math.max(120, Math.round(h * 0.34));
  const gap = 12, top = trackH + 8, gh = h - top - 8;
  const gw = (w - gap * 4) / 3;
  const T = meta.T;
  const mk = (i: number, yAbs: number): Pane => ({ x: gap + i * (gw + gap), y: top, w: gw, h: gh, yMin: -yAbs, yMax: yAbs, tMax: T });
  return {
    track: { x: 0, y: 0, w, h: trackH, smax: meta.smax },
    // s 軸用可預測的範圍（與軌道相同），曲線不會邊畫邊縮放
    panes: { s: mk(0, meta.smax), v: mk(1, nice(Math.max(1, meta.vmax * 1.2))), a: mk(2, nice(Math.max(1, meta.amax * 1.2))) },
  };
}
const px = (p: Pane, t: number) => p.x + 44 + ((p.w - 56) * t) / p.tMax;
const py = (p: Pane, y: number) => p.y + 22 + ((p.h - 44) * (p.yMax - y)) / (p.yMax - p.yMin);
const fromPy = (p: Pane, yy: number) => p.yMax - ((yy - p.y - 22) * (p.yMax - p.yMin)) / (p.h - 44);

export default function Scene({ plan, onInput }: SceneProps) {
  const lang = useLang(s => s.lang);
  const lay = useRef<Layout | null>(null);
  const dragging = useRef<number | null>(null);
  const vtRef = useRef<number[]>([]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const m = plan.meta!;
    const L = layoutOf(w, h, m); lay.current = L;
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ink").trim() || "#1b2530", ink3 = css.getPropertyValue("--ink-3").trim() || "#7b8591", line = css.getPropertyValue("--line").trim() || "#d8ddd7", accent = css.getPropertyValue("--accent").trim() || "#0e6f6a";
    const font = (size: number) => `${size}px "Noto Sans TC", system-ui, sans-serif`;
    const mono = (size: number) => `${size}px "IBM Plex Mono", monospace`;
    const zh = lang === "zh";

    // ---- 軌道 ----
    const tr = L.track; const ty = tr.y + tr.h * 0.62; const pad = 40;
    const sx = (s: number) => tr.x + pad + ((tr.w - 2 * pad) * (s + tr.smax)) / (2 * tr.smax);
    ctx.strokeStyle = line; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tr.x + pad, ty); ctx.lineTo(tr.x + tr.w - pad, ty); ctx.stroke();
    const step = nice(tr.smax / 5);
    ctx.font = mono(11); ctx.fillStyle = ink3; ctx.textAlign = "center"; ctx.strokeStyle = line; ctx.lineWidth = 1;
    for (let s = -tr.smax; s <= tr.smax + 1e-9; s += step) { const x = sx(s); ctx.beginPath(); ctx.moveTo(x, ty - 5); ctx.lineTo(x, ty + 5); ctx.stroke(); ctx.fillText(`${sig(s, 3).replace(/\.00$/, "")}`, x, ty + 20); }
    ctx.fillText(zh ? "位移 s / m（向右為正）" : "displacement s / m (right = +)", tr.x + tr.w / 2, ty + 36);
    // 原點
    ctx.strokeStyle = ink3; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(sx(0), ty - 40); ctx.lineTo(sx(0), ty + 8); ctx.stroke(); ctx.setLineDash([]);
    // 小車
    const body = plan.bodies?.[0]; const cx = sx(body?.position[0] ?? 0);
    const bw = 44, bh = 22;
    ctx.fillStyle = ink; ctx.fillRect(cx - bw / 2, ty - bh - 8, bw, bh);
    ctx.beginPath(); ctx.arc(cx - bw / 3, ty - 6, 5, 0, Math.PI * 2); ctx.arc(cx + bw / 3, ty - 6, 5, 0, Math.PI * 2); ctx.fill();
    // 箭嘴（顏色與線型由 ARROW_STYLE 決定）。像素比例按本次運動的最大 |v|、|a| 自動設定，兩支箭嘴共用，
    // 最長不超過軌道闊度的 30%，箭頭永遠在畫布內（核數員 F3）
    const maxMag = Math.max(1, m.vmax * (plan.scales.velocity ?? 1), m.amax * (plan.scales.acceleration ?? 1));
    const pxPerUnit = Math.min(88, (0.3 * (tr.w - 2 * pad)) / maxMag);
    for (const a of plan.arrows) {
      const st = ARROW_STYLE[a.kind]; const len = a.vector[0] * (plan.scales[a.kind] ?? 1) * pxPerUnit;
      if (Math.abs(len) < 1) continue;
      const yA = ty - bh - 8 - (a.kind === "velocity" ? 16 : 40); const x0 = cx, x1 = cx + len;
      ctx.strokeStyle = st.color; ctx.lineWidth = st.dashed ? 2 : 3; ctx.setLineDash(st.dashed ? [6, 4] : []);
      ctx.beginPath(); ctx.moveTo(x0, yA); ctx.lineTo(x1, yA); ctx.stroke(); ctx.setLineDash([]);
      const dir = Math.sign(len);
      if (st.head === "open") { ctx.beginPath(); ctx.moveTo(x1 - dir * 9, yA - 6); ctx.lineTo(x1, yA); ctx.lineTo(x1 - dir * 9, yA + 6); ctx.stroke(); }
      else { ctx.fillStyle = st.color; ctx.beginPath(); ctx.moveTo(x1, yA); ctx.lineTo(x1 - dir * 10, yA - 6); ctx.lineTo(x1 - dir * 10, yA + 6); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = st.color; ctx.font = `italic ${font(13)}`; ctx.textAlign = dir > 0 ? "left" : "right"; ctx.fillText(a.label ?? "", x1 + dir * 6, yA + 4);
    }
    // 位移標籤
    const lab = plan.labels[0];
    if (lab) { ctx.font = mono(12); ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.fillText(`s = ${sig(lab.value)} ${lab.unit}`, cx, ty - bh - 56); }

    // ---- 三張線圖 ----
    const series: Record<"s" | "v" | "a", { key: string; title: string; unit: string; color: string }> = {
      s: { key: "s-t", title: zh ? "s–t 圖（位移—時間）" : "s–t graph", unit: "m", color: accent },
      v: { key: "v-t", title: zh ? "v–t 圖（速度—時間）" : "v–t graph", unit: "m s⁻¹", color: ARROW_STYLE.velocity.color },
      a: { key: "a-t", title: zh ? "a–t 圖（加速度—時間）" : "a–t graph", unit: "m s⁻²", color: ARROW_STYLE.acceleration.color },
    };
    for (const k of ["s", "v", "a"] as const) {
      const p = L.panes[k]; const ser = series[k];
      const pts = plan.trails?.find(t => t.key === ser.key)?.points ?? [];
      ctx.fillStyle = "rgba(127,127,127,0.06)"; ctx.fillRect(p.x, p.y, p.w, p.h);
      // 軸
      const x0 = px(p, 0), x1 = px(p, p.tMax), y0 = py(p, 0);
      ctx.strokeStyle = ink3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, py(p, p.yMax)); ctx.lineTo(x0, py(p, p.yMin)); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      ctx.font = mono(10); ctx.fillStyle = ink3; ctx.textAlign = "right";
      for (const yv of [p.yMax, p.yMax / 2, 0, p.yMin / 2, p.yMin]) { const yy = py(p, yv); ctx.fillText(sig(yv).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1"), x0 - 4, yy + 3); ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
      ctx.textAlign = "center";
      for (let tv = 0; tv <= p.tMax; tv += p.tMax / 5) ctx.fillText(String(tv), px(p, tv), py(p, p.yMin) + 12);
      ctx.font = font(12); ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.fillText(ser.title, p.x + 6, p.y + 12);
      ctx.font = mono(10); ctx.fillStyle = ink3; ctx.textAlign = "right"; ctx.fillText(`${k} / ${ser.unit}`, p.x + p.w - 4, p.y + 12); ctx.fillText("t / s", p.x + p.w - 4, py(p, p.yMin) + 22);
      // 線下面積（只在 v–t，由 0 至 t）
      if (k === "v" && m.area && pts.length > 1) {
        for (let i = 1; i < pts.length; i++) {
          const [ta, va] = pts[i - 1], [tb, vb] = pts[i];
          ctx.fillStyle = (va + vb) / 2 >= 0 ? "rgba(14,111,106,0.22)" : "rgba(247,127,0,0.28)";
          ctx.beginPath(); ctx.moveTo(px(p, ta), y0); ctx.lineTo(px(p, ta), py(p, va)); ctx.lineTo(px(p, tb), py(p, vb)); ctx.lineTo(px(p, tb), y0); ctx.closePath(); ctx.fill();
        }
        ctx.font = mono(11); ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.fillText(`${zh ? "面積" : "area"} = ${sig(m.s)} m`, x0 + 6, py(p, p.yMax) + 12);
      }
      // 由圖生成運動：完整折線（淡）與控制點
      const handles = plan.trails?.find(t => t.key === "vt-handles")?.points;
      if (k === "v" && handles) {
        ctx.strokeStyle = ser.color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath();
        handles.forEach((q, i) => (i ? ctx.lineTo(px(p, q[0]), py(p, q[1])) : ctx.moveTo(px(p, q[0]), py(p, q[1])))); ctx.stroke(); ctx.globalAlpha = 1;
        for (const q of handles) { ctx.fillStyle = "#fff"; ctx.strokeStyle = ser.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px(p, q[0]), py(p, q[1]), 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.font = font(11); ctx.fillStyle = ink3; ctx.textAlign = "left"; ctx.fillText(zh ? "上下拖動圓點改變該秒的 v（每格 0.5）" : "Drag a dot up/down to set v at that second (steps of 0.5)", x0 + 6, py(p, p.yMin) - 6);
      }
      // 已走過的曲線
      if (pts.length > 1) {
        ctx.strokeStyle = ser.color; ctx.lineWidth = 2.5; ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(px(p, q[0]), py(p, Math.max(p.yMin, Math.min(p.yMax, q[1])))) : ctx.moveTo(px(p, q[0]), py(p, q[1])))); ctx.stroke();
      }
      // 當前點與切線
      const cur = pts.at(-1);
      if (cur) {
        const cxp = px(p, cur[0]), cyp = py(p, Math.max(p.yMin, Math.min(p.yMax, cur[1])));
        if (m.tangent && k !== "a") {
          const slope = k === "s" ? m.v : m.a;    // s–t 切線斜率 = v；v–t 切線斜率 = a
          const dt = p.tMax * 0.12; const dy = slope * dt;
          ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();   // 切線只在本圖框內
          ctx.strokeStyle = ink; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.beginPath();
          ctx.moveTo(px(p, cur[0] - dt), py(p, cur[1] - dy)); ctx.lineTo(px(p, cur[0] + dt), py(p, cur[1] + dy)); ctx.stroke(); ctx.setLineDash([]);
          ctx.restore();
          ctx.font = mono(11); ctx.fillStyle = ink; ctx.textAlign = "left";
          ctx.fillText(`${zh ? "斜率" : "slope"} = ${sig(slope)} ${k === "s" ? "m s⁻¹" : "m s⁻²"}`, x0 + 6, py(p, p.yMax) + (k === "v" && m.area ? 26 : 12));
        }
        ctx.fillStyle = ser.color; ctx.beginPath(); ctx.arc(cxp, cyp, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = ink3; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(cxp, py(p, p.yMax)); ctx.lineTo(cxp, py(p, p.yMin)); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }, [plan, lang]);

  // ---- 拖動 v–t 控制點（只在 draw 模式；抓取半徑 24 px ≥ 44 px 直徑）----
  const handleAt = (x: number, y: number): number | null => {
    const L = lay.current; const handles = plan.trails?.find(t => t.key === "vt-handles")?.points; if (!L || !handles) return null;
    const p = L.panes.v; let best: number | null = null, bd = 30;   // 抓取半徑 30 px（直徑 60 px ≥ 44 px）
    handles.forEach((q, i) => { const d = Math.hypot(px(p, q[0]) - x, py(p, q[1]) - y); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const local = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const onDown = (e: React.PointerEvent) => {
    if (!plan.meta?.draw) return;
    const [x, y] = local(e); const i = handleAt(x, y); if (i === null) return;
    dragging.current = i; vtRef.current = (plan.trails!.find(t => t.key === "vt-handles")!.points).map(q => q[1]);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault();
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging.current === null || !lay.current) return;
    const [, y] = local(e); const p = lay.current.panes.v;
    const v = Math.max(-5, Math.min(5, Math.round(fromPy(p, y) * 2) / 2));     // 0.5 m s⁻¹ 步進（學生試用者：太細難拖準），範圍 ±5
    const next = [...vtRef.current]; next[dragging.current] = v; vtRef.current = next;
    onInput?.("vt", next);
  };
  const onUp = () => { dragging.current = null; };

  return (
    <div className="scene2d" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ position: "absolute", inset: 0, touchAction: "none" }}>
      <Canvas2D draw={draw} frame={0} />
    </div>
  );
}
export type { RenderPlan };
