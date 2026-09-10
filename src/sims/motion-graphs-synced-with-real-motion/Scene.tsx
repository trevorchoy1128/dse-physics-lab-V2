import { useCallback, useRef } from "react";
import { Canvas2D } from "@/components";
import { theme, SCENE, SERIES, AREA_FILL, uiFont, monoFont, nice, tick, trim3, drawArrow2D, drawPane, px, py, fromPy, type Pane } from "@/components/design";
import { sig } from "@/shell/format";
import { useLang } from "@/i18n/lang";
import type { RenderPlan, SceneProps } from "@/shell/types";
import { axesFor, type Axes } from "./plan";

// 2D 場景：上方直線軌道與小車，下方 s–t、v–t、a–t 三張線圖。只畫 plan，不算物理。
// 「由圖生成運動」時 v–t 圖上每秒一個可拖的控制點（拖動範圍 ≥ 44 px），拖動結果經 onInput("vt", …) 交回。

interface Layout { track: { x: number; y: number; w: number; h: number; smax: number }; panes: Record<"s" | "v" | "a", Pane> }


// 軸範圍政策（axesFor）在 plan.ts：重置時由參數預測一次定好，播放期間不變，有測試保證每一幀相同。

function layoutOf(w: number, h: number, meta: Record<string, number>, axes: Axes): Layout {
  const trackH = Math.max(170, Math.round(h * 0.34));   // 最少 170 px：天空要放得下 s 標籤、a 箭嘴、v 箭嘴三行（iPad 直向）
  const gap = 12, top = trackH + 8, gh = h - top - 8;
  const gw = (w - gap * 4) / 3;
  const T = meta.T;
  const mk = (i: number, yAbs: number): Pane => ({ x: gap + i * (gw + gap), y: top, w: gw, h: gh, yMin: -yAbs, yMax: yAbs, tMax: T });
  return {
    track: { x: 0, y: 0, w, h: trackH, smax: axes.s },   // 軌道與 s 軸同一範圍
    panes: { s: mk(0, axes.s), v: mk(1, axes.v), a: mk(2, axes.a) },
  };
}

export default function Scene({ plan, onInput }: SceneProps) {
  const lang = useLang(s => s.lang);
  const lay = useRef<Layout | null>(null);
  const axes = useRef<Axes>({ s: 0, v: 0, a: 0, t: 0 });   // 軸範圍：見 plan.ts axesFor
  const cam = useRef({ s: 0, t: 0 });   // 鏡頭中心（米）；小車離開中央 40% 區域時跟隨
  // 軌道米數與箭嘴像素比例在重置時凍結；即時改加速度不得令畫面比例跳動（老師 2026-09-06：改 a 時畫面抖動）
  const frozen = useRef({ t: 0, viewW: 0, maxMag: 0 });
  const dragging = useRef<number | null>(null);
  const vtRef = useRef<number[]>([]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const m = plan.meta!;
    axes.current = axesFor(axes.current, m);
    const L = layoutOf(w, h, m, axes.current); lay.current = L;
    const T = theme(); const { ink, ink3, accent } = T;
    const zh = lang === "zh";

    // ---- 軌道：固定比例 + 鏡頭跟隨 ----（老師：比例重新映射令小車「瞬移」，改為鏡頭跟車、背景流動）
    const tr = L.track; const ty = tr.y + tr.h * 0.62; const pad = 40;
    if (frozen.current.viewW === 0 || m.t < frozen.current.t - 1e-9 || m.t === 0) {   // 重置時才重算
      frozen.current.viewW = Math.min(100, Math.max(10, nice(3 * m.vmax)));
      frozen.current.maxMag = Math.max(1, m.vmax * (plan.scales.velocity ?? 1), m.amax * (plan.scales.acceleration ?? 1));
    }
    frozen.current.t = m.t;
    const viewW = frozen.current.viewW;      // 畫面橫跨的米數：重置時由參數預測定好，運行中（包括即時改 a）不變
    const pxPerM = (tr.w - 2 * pad) / viewW;
    const body = plan.bodies?.[0]; const carS = body?.position[0] ?? 0;
    if (m.t < cam.current.t - 1e-9 || m.t === 0) cam.current.s = 0;   // 重置：鏡頭回到起點
    { const dz = viewW * 0.2; if (carS > cam.current.s + dz) cam.current.s = carS - dz; else if (carS < cam.current.s - dz) cam.current.s = carS + dz; }
    cam.current.t = m.t;
    const sx = (s: number) => tr.x + tr.w / 2 + (s - cam.current.s) * pxPerM;
    // 天空、雲（視差 0.15）、草地
    const sky = ctx.createLinearGradient(0, tr.y, 0, ty); sky.addColorStop(0, SCENE.skyTop); sky.addColorStop(1, SCENE.skyBottom);
    ctx.fillStyle = sky; ctx.fillRect(tr.x, tr.y, tr.w, ty - tr.y);
    ctx.fillStyle = SCENE.cloud;
    for (let i = 0; i < 4; i++) {
      const cxCloud = ((i * 271 + 60 - cam.current.s * pxPerM * 0.15) % (tr.w + 160) + tr.w + 160) % (tr.w + 160) - 80;
      const cy = tr.y + 22 + (i % 2) * 18;
      ctx.beginPath(); ctx.arc(cxCloud, cy, 14, 0, Math.PI * 2); ctx.arc(cxCloud + 16, cy - 6, 17, 0, Math.PI * 2); ctx.arc(cxCloud + 34, cy, 13, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = SCENE.ground; ctx.fillRect(tr.x, ty, tr.w, tr.h - (ty - tr.y));
    // 世界座標中的背景物：距離柱（每 step 米，附數字）、樹（柱與柱之間）、路面中線（世界座標的虛線，跟車移動）
    const step = nice(viewW / 6);
    const sMin = cam.current.s - viewW * 0.6, sMax = cam.current.s + viewW * 0.6;
    ctx.fillStyle = SCENE.road; ctx.fillRect(tr.x, ty - 7, tr.w, 14);
    ctx.strokeStyle = SCENE.roadDash; ctx.lineWidth = 2; ctx.beginPath();
    // 路面虛線：短線長 step/12、週期 step/4（線：空 ≈ 1：2，像真實路面；老師：黃線太長）
    for (let s0 = Math.floor(sMin / (step / 4)) * (step / 4); s0 < sMax; s0 += step / 4) { ctx.moveTo(sx(s0), ty); ctx.lineTo(sx(s0 + step / 12), ty); }
    ctx.stroke();
    for (let s0 = Math.floor(sMin / step) * step; s0 <= sMax; s0 += step) {
      const x = sx(s0);
      // 樹（在兩柱之間）
      const tx = sx(s0 + step / 2); const hTree = 26 + ((Math.round(s0 / step) % 3) + 3) % 3 * 8;
      ctx.strokeStyle = SCENE.trunk; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, ty - 8); ctx.lineTo(tx, ty - 8 - hTree * 0.5); ctx.stroke();
      ctx.fillStyle = SCENE.leaf; ctx.beginPath(); ctx.arc(tx, ty - 10 - hTree * 0.5, hTree * 0.45, 0, Math.PI * 2); ctx.fill();
      // 距離柱
      ctx.strokeStyle = SCENE.post; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, ty + 7); ctx.lineTo(x, ty + 18); ctx.stroke();
      ctx.font = monoFont(12); ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.fillText(tick(s0), x, ty + 31);
    }
    ctx.font = monoFont(11); ctx.fillStyle = ink3; ctx.textAlign = "center"; ctx.fillText(zh ? "位移 s / m（向右為正 →）" : "displacement s / m (right = + →)", tr.x + tr.w / 2, ty + 46);
    // 鏡頭偏離起點時說明「鏡頭跟着小車移動，比例不變」（學生試用者第 7 輪：地面刻度範圍變了，以為是縮放）
    if (Math.abs(cam.current.s) > 1e-9) { ctx.font = uiFont(12, "700"); ctx.fillStyle = ink; ctx.textAlign = "right"; ctx.fillText(zh ? "鏡頭跟着小車移動（比例不變）" : "Camera follows the trolley (same scale)", tr.x + tr.w - 8, tr.y + 14); }
    // 起點旗（原點，在畫面內才畫）
    const x0 = sx(0);
    if (x0 > tr.x - 20 && x0 < tr.x + tr.w + 20) {
      ctx.strokeStyle = SCENE.post; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, ty - 7); ctx.lineTo(x0, ty - 46); ctx.stroke();
      ctx.fillStyle = SCENE.flag; ctx.beginPath(); ctx.moveTo(x0, ty - 46); ctx.lineTo(x0 + 16, ty - 40); ctx.lineTo(x0, ty - 34); ctx.closePath(); ctx.fill();
    }
    // 小車：琥珀色車身、深色車輪（避開向量顏色編碼的紅、藍、橙、紫、綠）
    const cx = sx(carS);
    const bw = 48, bh = 22;
    ctx.fillStyle = SCENE.objectA; ctx.strokeStyle = SCENE.objectAEdge; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(cx - bw / 2, ty - bh - 10, bw, bh, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = SCENE.objectAWindow; ctx.fillRect(cx - bw / 2 + 6, ty - bh - 6, 14, 9);
    ctx.fillStyle = SCENE.wheel; ctx.beginPath(); ctx.arc(cx - bw / 3, ty - 7, 6, 0, Math.PI * 2); ctx.arc(cx + bw / 3, ty - 7, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SCENE.hub; ctx.beginPath(); ctx.arc(cx - bw / 3, ty - 7, 2, 0, Math.PI * 2); ctx.arc(cx + bw / 3, ty - 7, 2, 0, Math.PI * 2); ctx.fill();
    // 箭嘴（顏色與線型由 ARROW_STYLE 決定）。像素比例由參數預測的最大 |v|、|a| 決定，運行中不變（核數員 F8），
    // 兩支箭嘴共用，最長不超過軌道闊度的 30%；再按小車與邊緣的距離同步縮短，箭頭永遠在畫布內（F3、F5）
    const maxMag = frozen.current.maxMag;
    let pxPerUnit = Math.min(88, (0.3 * (tr.w - 2 * pad)) / maxMag);
    const room = (dir: number) => (dir > 0 ? tr.x + tr.w - 8 - cx : cx - tr.x - 8);
    for (const a of plan.arrows) {
      const need = Math.abs(a.vector[0] * (plan.scales[a.kind] ?? 1) * pxPerUnit);
      const r = room(Math.sign(a.vector[0]) || 1);
      if (need > r - 14) pxPerUnit *= Math.max(0.05, (r - 14) / need);
    }
    let shrunk = false;
    for (const a of plan.arrows) {
      const len = a.vector[0] * (plan.scales[a.kind] ?? 1) * pxPerUnit;
      if (Math.abs(len) < 1) continue;
      if (pxPerUnit < Math.min(88, (0.3 * (tr.w - 2 * pad)) / maxMag) - 1e-9) shrunk = true;
      const yA = ty - bh - 12 - (a.kind === "velocity" ? 16 : 40);
      drawArrow2D(ctx, cx, yA, cx + len, yA, a.kind, a.label);
    }
    // 位移標籤
    const lab = plan.labels[0];
    if (lab) { ctx.font = monoFont(12); ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.fillText(`s = ${sig(lab.value)} ${lab.unit}`, cx, Math.max(tr.y + 14, ty - bh - 62)); }
    if (shrunk) { ctx.font = uiFont(11); ctx.fillStyle = ink3; ctx.textAlign = "left"; ctx.fillText(zh ? "箭嘴已按邊緣空間同步縮短（比例不變）" : "Arrows shortened together to fit the edge (same ratio)", tr.x + pad, tr.y + 14); }

    // ---- 三張線圖 ----
    // 三張圖各有自己的色系：s 藍綠、v 綠（與速度箭嘴同色）、a 青藍；圖名用彩色標題條
    const series: Record<"s" | "v" | "a", { key: string; title: string; unit: string; color: string; tint: string }> = {
      s: { key: "s-t", title: zh ? "s–t 圖（位移—時間）" : "s–t graph", unit: "m", color: accent, tint: SERIES.s.tint },
      v: { key: "v-t", title: zh ? "v–t 圖（速度—時間）" : "v–t graph", unit: "m s⁻¹", color: SERIES.v.color, tint: SERIES.v.tint },
      a: { key: "a-t", title: zh ? "a–t 圖（加速度—時間）" : "a–t graph", unit: "m s⁻²", color: SERIES.a.color, tint: SERIES.a.tint },
    };
    for (const k of ["s", "v", "a"] as const) {
      const p = L.panes[k]; const ser = series[k];
      const pts = plan.trails?.find(t => t.key === ser.key)?.points ?? [];
      // 畫圖模式：t 刻度落在圓點的時間上（第 9 輪）；框、軸、格線、標題由全站的 drawPane 畫
      const handlesT = k === "v" ? plan.trails?.find(t => t.key === "vt-handles")?.points.map(q => q[0]) : undefined;
      const { x0, y0 } = drawPane(ctx, p, { title: ser.title, yLabel: `${k} / ${ser.unit}`, color: ser.color, tint: ser.tint, xTicks: handlesT }, T);
      // 線下面積（只在 v–t，由 0 至 t）
      if (k === "v" && m.area && pts.length > 1) {
        for (let i = 1; i < pts.length; i++) {
          const [ta, va] = pts[i - 1], [tb, vb] = pts[i];
          ctx.fillStyle = (va + vb) / 2 >= 0 ? AREA_FILL.positive : AREA_FILL.negative;
          ctx.beginPath(); ctx.moveTo(px(p, ta), y0); ctx.lineTo(px(p, ta), py(p, va)); ctx.lineTo(px(p, tb), py(p, vb)); ctx.lineTo(px(p, tb), y0); ctx.closePath(); ctx.fill();
        }
        ctx.font = monoFont(11); ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.fillText(`${zh ? "面積" : "area"} = ${sig(m.s)} m`, x0 + 6, py(p, p.yMax) + 12);
      }
      // 由圖生成運動：完整折線（淡）與控制點
      const handles = plan.trails?.find(t => t.key === "vt-handles")?.points;
      if (k === "v" && handles) {
        ctx.strokeStyle = ser.color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath();
        handles.forEach((q, i) => (i ? ctx.lineTo(px(p, q[0]), py(p, q[1])) : ctx.moveTo(px(p, q[0]), py(p, q[1])))); ctx.stroke(); ctx.globalAlpha = 1;
        // 時間窗長（最多 60 s）時控制點密：半徑隨間距縮小（最少 4 px），秒數標籤只在相隔 ≥ 22 px 時標
        const spacing = handles.length > 1 ? px(p, handles[1][0]) - px(p, handles[0][0]) : p.w; const rad = Math.max(4, Math.min(8, spacing * 0.35));
        handles.forEach((q, i) => {
          const on = dragging.current === i; const hx = px(p, q[0]), hy = py(p, q[1]);
          ctx.fillStyle = on ? SCENE.objectA : SCENE.white; ctx.strokeStyle = on ? SCENE.objectAEdge : ser.color; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(hx, hy, on ? rad + 2 : rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          // 圓點的時間由 y = 0 軸線上的刻度讀出（第 8 輪：底部另一行秒數與軸刻度重複，學生以為刻度在底部）
          if (on) {   // 拖動中即時顯示數值（第 3 輪）
            ctx.font = monoFont(12, "700"); ctx.fillStyle = ink; ctx.textAlign = "center";
            ctx.fillText(`t = ${q[0]} s，v = ${trim3(sig(q[1]))} m s⁻¹`, hx, hy - 18);
          }
        });
        ctx.font = uiFont(11); ctx.fillStyle = ink3; ctx.textAlign = "left"; ctx.fillText(zh ? "在圖框內按住並左右掃過，經過的圓點就跟着你的高度（v 由 −5 至 5，每格 0.5）" : "Press and sweep across the graph: each dot you pass takes your height (v from −5 to 5, steps of 0.5)", x0 + 6, p.y + p.h - 44);
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
          ctx.font = monoFont(11); ctx.fillStyle = ink; ctx.textAlign = "left";
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
    const [x, y] = local(e); const p = lay.current.panes.v;
    const v = Math.max(-5, Math.min(5, Math.round(fromPy(p, y) * 2) / 2));     // 0.5 m s⁻¹ 步進（學生試用者：太細難拖準），範圍 ±5
    const i = handleAt(x, y) ?? dragging.current; dragging.current = i;         // 掃掠：橫向掃過哪粒點就改哪粒點，一筆可畫整條折線（第 9 輪）
    const next = [...vtRef.current]; next[i] = v; vtRef.current = next;
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
