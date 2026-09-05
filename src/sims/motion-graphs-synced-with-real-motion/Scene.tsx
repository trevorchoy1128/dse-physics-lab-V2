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

// 軸範圍「只放大、不縮小、不因滑桿跳動」：按至今出現過的最大值取好看刻度，重置（t 回到 0）時歸零重算。
// 畫圖模式的 v、a 軸固定為拖動範圍 ±5、±10。（學生試用者第 2、3 輪）
interface Axes { s: number; v: number; a: number; t: number }
function growAxes(prev: Axes, meta: Record<string, number>): Axes {
  const fresh = meta.t < prev.t - 1e-9;   // 重置
  const base = fresh ? { s: 0, v: 0, a: 0 } : prev;
  const grow = (cur: number, need: number, min: number) => Math.max(cur, nice(Math.max(min, need)));
  return {
    s: grow(base.s, meta.sGraph * 1.15, 5),
    v: meta.draw ? 5 : grow(base.v, meta.vSeen * 1.2, 1),
    a: meta.draw ? 10 : grow(base.a, meta.aSeen * 1.2, 1),
    t: meta.t,
  };
}

function layoutOf(w: number, h: number, meta: Record<string, number>, axes: Axes): Layout {
  const trackH = Math.max(120, Math.round(h * 0.34));
  const gap = 12, top = trackH + 8, gh = h - top - 8;
  const gw = (w - gap * 4) / 3;
  const T = meta.T;
  const mk = (i: number, yAbs: number): Pane => ({ x: gap + i * (gw + gap), y: top, w: gw, h: gh, yMin: -yAbs, yMax: yAbs, tMax: T });
  return {
    track: { x: 0, y: 0, w, h: trackH, smax: axes.s },   // 軌道與 s 軸同一範圍
    panes: { s: mk(0, axes.s), v: mk(1, axes.v), a: mk(2, axes.a) },
  };
}
const px = (p: Pane, t: number) => p.x + 44 + ((p.w - 56) * t) / p.tMax;
const py = (p: Pane, y: number) => p.y + 22 + ((p.h - 44) * (p.yMax - y)) / (p.yMax - p.yMin);
const fromPy = (p: Pane, yy: number) => p.yMax - ((yy - p.y - 22) * (p.yMax - p.yMin)) / (p.h - 44);

export default function Scene({ plan, onInput }: SceneProps) {
  const lang = useLang(s => s.lang);
  const lay = useRef<Layout | null>(null);
  const axes = useRef<Axes>({ s: 0, v: 0, a: 0, t: 0 });
  const dragging = useRef<number | null>(null);
  const vtRef = useRef<number[]>([]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const m = plan.meta!;
    axes.current = growAxes(axes.current, m);
    const L = layoutOf(w, h, m, axes.current); lay.current = L;
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ink").trim() || "#1b2530", ink3 = css.getPropertyValue("--ink-3").trim() || "#7b8591", line = css.getPropertyValue("--line").trim() || "#d8ddd7", accent = css.getPropertyValue("--accent").trim() || "#0e6f6a";
    // 窄畫面（iPad）字體不再縮小：最少 12 px（學生試用者：圖內文字太細）
    const font = (size: number) => `${Math.max(12, size)}px "Noto Sans TC", system-ui, sans-serif`;
    const mono = (size: number) => `${Math.max(11, size)}px "IBM Plex Mono", monospace`;
    const zh = lang === "zh";

    // ---- 軌道：天空漸層 + 路面 + 黃色中線 + 起點旗 ----（配色只影響畫面，向量顏色仍由 ARROW_STYLE 決定）
    const tr = L.track; const ty = tr.y + tr.h * 0.62; const pad = 40;
    const sx = (s: number) => tr.x + pad + ((tr.w - 2 * pad) * (s + tr.smax)) / (2 * tr.smax);
    const sky = ctx.createLinearGradient(0, tr.y, 0, ty); sky.addColorStop(0, "#e8f4ff"); sky.addColorStop(1, "#f7fbff");
    ctx.fillStyle = sky; ctx.fillRect(tr.x, tr.y, tr.w, ty - tr.y);
    ctx.fillStyle = "#dfe9d8"; ctx.fillRect(tr.x, ty, tr.w, tr.h - (ty - tr.y));            // 草地
    ctx.fillStyle = "#4a5568"; ctx.fillRect(tr.x + pad - 6, ty - 7, tr.w - 2 * pad + 12, 14);   // 路面
    ctx.strokeStyle = "#f2c94c"; ctx.lineWidth = 2; ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.moveTo(tr.x + pad, ty); ctx.lineTo(tr.x + tr.w - pad, ty); ctx.stroke(); ctx.setLineDash([]);
    const step = nice(tr.smax / 5);
    ctx.font = mono(11); ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.strokeStyle = ink3; ctx.lineWidth = 1;
    for (let s = -tr.smax; s <= tr.smax + 1e-9; s += step) { const x = sx(s); ctx.beginPath(); ctx.moveTo(x, ty + 7); ctx.lineTo(x, ty + 13); ctx.stroke(); ctx.fillText(`${sig(s, 3).replace(/\.00$/, "")}`, x, ty + 26); }
    ctx.fillStyle = ink3; ctx.fillText(zh ? "位移 s / m（向右為正 →）" : "displacement s / m (right = + →)", tr.x + tr.w / 2, ty + 42);
    // 起點旗（原點）
    const x0 = sx(0);
    ctx.strokeStyle = "#6b7280"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, ty - 7); ctx.lineTo(x0, ty - 46); ctx.stroke();
    ctx.fillStyle = "#e0522d"; ctx.beginPath(); ctx.moveTo(x0, ty - 46); ctx.lineTo(x0 + 16, ty - 40); ctx.lineTo(x0, ty - 34); ctx.closePath(); ctx.fill();
    // 小車：琥珀色車身、深色車輪（避開向量顏色編碼的紅、藍、橙、紫、綠）
    const body = plan.bodies?.[0]; const cx = sx(body?.position[0] ?? 0);
    const bw = 48, bh = 22;
    ctx.fillStyle = "#f5a623"; ctx.strokeStyle = "#8a5a00"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(cx - bw / 2, ty - bh - 10, bw, bh, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffe8b3"; ctx.fillRect(cx - bw / 2 + 6, ty - bh - 6, 14, 9);                 // 車窗
    ctx.fillStyle = "#2b2f36"; ctx.beginPath(); ctx.arc(cx - bw / 3, ty - 7, 6, 0, Math.PI * 2); ctx.arc(cx + bw / 3, ty - 7, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c8cdd4"; ctx.beginPath(); ctx.arc(cx - bw / 3, ty - 7, 2, 0, Math.PI * 2); ctx.arc(cx + bw / 3, ty - 7, 2, 0, Math.PI * 2); ctx.fill();
    // 箭嘴（顏色與線型由 ARROW_STYLE 決定）。像素比例由參數預測的最大 |v|、|a| 決定，運行中不變（核數員 F8），
    // 兩支箭嘴共用，最長不超過軌道闊度的 30%；再按小車與邊緣的距離同步縮短，箭頭永遠在畫布內（F3、F5）
    const maxMag = Math.max(1, m.vmax * (plan.scales.velocity ?? 1), m.amax * (plan.scales.acceleration ?? 1));
    let pxPerUnit = Math.min(88, (0.3 * (tr.w - 2 * pad)) / maxMag);
    const room = (dir: number) => (dir > 0 ? tr.x + tr.w - 8 - cx : cx - tr.x - 8);
    for (const a of plan.arrows) {
      const need = Math.abs(a.vector[0] * (plan.scales[a.kind] ?? 1) * pxPerUnit);
      const r = room(Math.sign(a.vector[0]) || 1);
      if (need > r - 14) pxPerUnit *= Math.max(0.05, (r - 14) / need);
    }
    let shrunk = false;
    for (const a of plan.arrows) {
      const st = ARROW_STYLE[a.kind]; const len = a.vector[0] * (plan.scales[a.kind] ?? 1) * pxPerUnit;
      if (Math.abs(len) < 1) continue;
      if (pxPerUnit < Math.min(88, (0.3 * (tr.w - 2 * pad)) / maxMag) - 1e-9) shrunk = true;
      const yA = ty - bh - 12 - (a.kind === "velocity" ? 16 : 40); const xs = cx, x1 = cx + len;
      ctx.strokeStyle = st.color; ctx.lineWidth = st.dashed ? 2.5 : 3.5; ctx.setLineDash(st.dashed ? [6, 4] : []);
      ctx.beginPath(); ctx.moveTo(xs, yA); ctx.lineTo(x1, yA); ctx.stroke(); ctx.setLineDash([]);
      const dir = Math.sign(len);
      if (st.head === "open") { ctx.beginPath(); ctx.moveTo(x1 - dir * 9, yA - 6); ctx.lineTo(x1, yA); ctx.lineTo(x1 - dir * 9, yA + 6); ctx.stroke(); }
      else { ctx.fillStyle = st.color; ctx.beginPath(); ctx.moveTo(x1, yA); ctx.lineTo(x1 - dir * 10, yA - 6); ctx.lineTo(x1 - dir * 10, yA + 6); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = st.color; ctx.font = `italic ${font(13)}`; ctx.textAlign = dir > 0 ? "left" : "right"; ctx.fillText(a.label ?? "", x1 + dir * 6, yA + 4);
    }
    // 位移標籤
    const lab = plan.labels[0];
    if (lab) { ctx.font = mono(12); ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.fillText(`s = ${sig(lab.value)} ${lab.unit}`, cx, ty - bh - 62); }
    if (shrunk) { ctx.font = font(11); ctx.fillStyle = ink3; ctx.textAlign = "left"; ctx.fillText(zh ? "箭嘴已按邊緣空間同步縮短（比例不變）" : "Arrows shortened together to fit the edge (same ratio)", tr.x + pad, tr.y + 14); }

    // ---- 三張線圖 ----
    // 三張圖各有自己的色系：s 藍綠、v 綠（與速度箭嘴同色）、a 青藍；圖名用彩色標題條
    const series: Record<"s" | "v" | "a", { key: string; title: string; unit: string; color: string; tint: string }> = {
      s: { key: "s-t", title: zh ? "s–t 圖（位移—時間）" : "s–t graph", unit: "m", color: accent, tint: "rgba(14,111,106,0.08)" },
      v: { key: "v-t", title: zh ? "v–t 圖（速度—時間）" : "v–t graph", unit: "m s⁻¹", color: ARROW_STYLE.velocity.color, tint: "rgba(26,156,75,0.08)" },
      a: { key: "a-t", title: zh ? "a–t 圖（加速度—時間）" : "a–t graph", unit: "m s⁻²", color: "#0b8f9d", tint: "rgba(11,143,157,0.08)" },
    };
    for (const k of ["s", "v", "a"] as const) {
      const p = L.panes[k]; const ser = series[k];
      const pts = plan.trails?.find(t => t.key === ser.key)?.points ?? [];
      ctx.fillStyle = ser.tint; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = ser.color; ctx.fillRect(p.x, p.y, p.w, 3);   // 頂部色條
      // 軸
      const x0 = px(p, 0), x1 = px(p, p.tMax), y0 = py(p, 0);
      ctx.strokeStyle = ink3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, py(p, p.yMax)); ctx.lineTo(x0, py(p, p.yMin)); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      ctx.font = mono(10); ctx.fillStyle = ink3; ctx.textAlign = "right";
      for (const yv of [p.yMax, p.yMax / 2, 0, p.yMin / 2, p.yMin]) { const yy = py(p, yv); ctx.fillText(sig(yv).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1"), x0 - 4, yy + 3); ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
      ctx.textAlign = "center";
      for (let tv = 0; tv <= p.tMax; tv += p.tMax / 5) ctx.fillText(String(tv), px(p, tv), py(p, p.yMin) + 12);
      ctx.font = `700 ${font(12)}`; ctx.fillStyle = ser.color; ctx.textAlign = "left"; ctx.fillText(ser.title, p.x + 6, p.y + 15);
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
        handles.forEach((q, i) => {
          const on = dragging.current === i; const hx = px(p, q[0]), hy = py(p, q[1]);
          ctx.fillStyle = on ? "#f5a623" : "#fff"; ctx.strokeStyle = on ? "#8a5a00" : ser.color; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(hx, hy, on ? 10 : 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          // 每粒圓點下方標明它是第幾秒（學生試用者第 6 輪：唔知邊粒對應邊個 t）
          if (handles.length <= 12 || i % 2 === 0) { ctx.font = mono(10); ctx.fillStyle = ser.color; ctx.textAlign = "center"; ctx.fillText(`${q[0]}s`, hx, py(p, p.yMin) - 6); }
          if (on) {   // 拖動中即時顯示數值（第 3 輪）
            ctx.font = `700 ${mono(12)}`; ctx.fillStyle = ink; ctx.textAlign = "center";
            ctx.fillText(`t = ${q[0]} s，v = ${sig(q[1]).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")} m s⁻¹`, hx, hy - 18);
          }
        });
        ctx.font = font(11); ctx.fillStyle = ink3; ctx.textAlign = "left"; ctx.fillText(zh ? "在圖框內按住任何一秒的位置上下拖，就改變該秒的 v（每格 0.5）" : "Press anywhere in the graph and drag up/down to set v at that second (steps of 0.5)", x0 + 6, p.y + p.h - 44);
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
  // 在 v–t 圖框內任何位置按下，即拖動時間最接近的那個控制點，不必命中圓點（學生試用者第 5 輪）
  const handleAt = (x: number, y: number): number | null => {
    const L = lay.current; const handles = plan.trails?.find(t => t.key === "vt-handles")?.points; if (!L || !handles) return null;
    const p = L.panes.v;
    if (x < p.x || x > p.x + p.w || y < p.y || y > p.y + p.h) return null;
    let best: number | null = null, bd = Infinity;
    handles.forEach((q, i) => { const d = Math.abs(px(p, q[0]) - x); if (d < bd) { bd = d; best = i; } });
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
