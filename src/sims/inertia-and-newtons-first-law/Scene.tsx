import { useCallback, useRef } from "react";
import { Canvas2D } from "@/components";
import { theme, SCENE, SERIES, uiFont, monoFont, symbolFont, nice, tick, trim3, drawArrow2D, drawPane, px, py, type Pane } from "@/components/design";
import { ARROW_STYLE } from "@/components/arrowMath";
import { sig } from "@/shell/format";
import { useLang } from "@/i18n/lang";
import type { ArrowPlan, RenderPlan, SceneProps } from "@/shell/types";

// 2D 側視場景（規格 §9：3D 必要性低）。上方為情景（方塊／桌布／巴士／太空），下方 s–t 與 v–t 兩張線圖。
// 只畫 plan，不算物理。比例（米／像素、每 N 與每 m s⁻¹ 的像素）與軸範圍在重置時由 meta 的預測上界一次定好，運行中不變（老師規則 F）；
// 學生一直按着施力／引擎而超出預測時，軸只放大、不縮小。物體離開畫面用鏡頭跟隨（中央 40% 死區），背景在世界座標。
// 老師決定：巴士只有地面視角，沒有虛擬力。
// 第 2 輪（儀器審核員）：推手畫成手、桌面畫成桌（室內）、粗糙紋跟 μ、樽有頸、拉布的手、巴士車廂兩端開放且鏡頭跟乘客與巴士的中點、
// 受力標籤分層不重疊、水平力與垂直力各自一個像素比例（同一 kind 全場景一個係數）。

interface Frozen { t: number; viewW: number; pxH: number; pxV: number; pxVel: number; pxA: number; sAx: number; vAx: number }
const LABEL_H = 15;
const isIndoor = (scene: number) => scene === 1 || scene === 2;

// 施力物 → 受力物 標籤（規格 §6，與 S5 同格式）
function forceLabel(a: ArrowPlan, scene: number, zh: boolean, onCloth = false): string {
  const obj = scene === 1 ? (zh ? "方塊" : "block") : scene === 2 ? (zh ? "樽" : "bottle") : scene === 3 ? (zh ? "乘客" : "passenger") : zh ? "飛船" : "craft";
  const surf = scene === 3 ? (zh ? "地板" : "floor") : scene === 2 ? (onCloth ? (zh ? "布" : "cloth") : zh ? "桌" : "table") : zh ? "桌" : "table";
  if (a.kind === "weight") return `${a.label} ${zh ? "地球" : "Earth"} → ${obj}`;
  if (a.kind === "normal") return `${a.label} ${surf} → ${obj}`;
  if (a.kind === "friction") return `${a.label} ${surf} → ${obj}${zh ? "（摩擦）" : " (friction)"}`;
  if (a.layer === "applied") return `${a.label} ${scene === 1 ? (zh ? "手" : "hand") : scene === 3 ? (zh ? "扶手" : "handrail") : zh ? "引擎" : "engine"} → ${obj}`;
  if (a.kind === "net") return zh ? "淨力" : "net force";
  return a.label ?? "";
}

/** 簡化的手：手掌圓角矩形 + 四指 + 拇指；dir = +1 手在物體左方向右推，−1 在物體右方向左拉 */
function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dir: 1 | -1) {
  ctx.fillStyle = SCENE.objectAWindow; ctx.strokeStyle = SCENE.objectAEdge; ctx.lineWidth = 1.2;
  const w = size, h = size * 0.9;
  const palmX = dir > 0 ? x - w : x;
  ctx.beginPath(); ctx.roundRect(palmX, y - h / 2, w, h, size * 0.25); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 4; i++) { const fy = y - h / 2 + (i + 0.5) * (h / 4); const fx = dir > 0 ? x - 2 : x - size * 0.35 + 2; ctx.beginPath(); ctx.roundRect(fx, fy - h * 0.09, size * 0.37, h * 0.18, 3); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.roundRect(dir > 0 ? palmX + w * 0.15 : palmX + w * 0.5, y - h * 0.9, w * 0.35, h * 0.42, 3); ctx.fill(); ctx.stroke();
}

export default function Scene({ plan }: SceneProps) {
  const lang = useLang(s => s.lang);
  const frozen = useRef<Frozen>({ t: 0, viewW: 0, pxH: 0, pxV: 0, pxVel: 0, pxA: 0, sAx: 0, vAx: 0 });
  const cam = useRef({ s: [0, 0, 0] as number[], t: 0 });   // 每條泳道各自的鏡頭中心（米）

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const m = plan.meta!; const T = theme(); const { ink, ink2, ink3, accent } = T; const zh = lang === "zh";
    const scene = m.scene as 1 | 2 | 3 | 4;
    const bodyOf = (key: string) => plan.bodies!.find(b => b.key === key);

    // ---- 版面 ----
    const trackH = Math.max(240, Math.round(h * 0.56));
    const tr = { x: 0, y: 0, w, h: trackH };
    const pad = 44;
    const ty = scene === 4 ? tr.y + tr.h * 0.5 : isIndoor(scene) ? tr.y + tr.h * 0.66 : tr.y + tr.h * 0.72;   // 桌面／路面／中線
    const floorY = tr.y + tr.h - 26;
    const lanesN = scene === 1 || scene === 4 ? Math.max(1, m.lanes) : 1;
    const laneGap = scene === 4 ? tr.h * 0.3 : Math.max(90, tr.h * 0.34);
    const laneY = (lane: number) => (scene === 4 ? ty - (lane === 1 ? 1 : lane === 2 ? -1 : 0) * laneGap : ty - lane * laneGap);
    const reset = frozen.current.viewW === 0 || m.t < frozen.current.t - 1e-9 || m.t === 0;
    if (reset) {
      const f = frozen.current;
      // 視野闊度固定（老師 2026-09-08：推力一改飛船大小就變）：不隨參數預測改變，物體走遠由鏡頭跟隨處理；桌布按布長
      f.viewW = scene === 1 ? 6 : scene === 2 ? Math.max(3, nice(2 * (m.L + 1.2))) : scene === 3 ? 26 : 24;
      const maxLen = Math.min(120, 0.22 * (tr.w - 2 * pad), 0.3 * tr.h, lanesN > 1 ? laneGap * 0.4 : Infinity);
      // 垂直力另設上限：室內時重量箭頭不落到地板刻度（標籤在箭頭旁），泳道疊排時上下箭頭相隔 ≥ 0.2 倍間距
      const maxLenV = Math.min(maxLen, isIndoor(scene) ? Math.max(30, floorY - ty - 22) : Infinity);
      f.pxH = maxLen / m.FmaxH; f.pxV = maxLenV / m.FmaxV; f.pxVel = maxLen / m.vmax; f.pxA = (0.8 * maxLen) / m.amax;
      f.sAx = nice(Math.max(0.5, m.smax * 1.02)); f.vAx = nice(Math.max(0.5, m.vmax * 1.02));
      cam.current.s = [0, 0, 0];
    }
    if (m.sSeen * 1.02 > frozen.current.sAx) frozen.current.sAx = nice(m.sSeen * 1.02);
    if (m.vSeen * 1.02 > frozen.current.vAx) frozen.current.vAx = nice(m.vSeen * 1.02);
    frozen.current.t = m.t;
    const F = frozen.current; const pxPerM = (tr.w - 2 * pad) / F.viewW;
    // 鏡頭：情景 3 跟乘客與巴士的中點（地面視角；兩者都留在畫面內），其餘每條泳道跟自己的物體
    const anchors: number[] = scene === 3 ? [bodyOf("passenger")!.position[0]]   // 地面視角：鏡頭跟乘客（儀器審核員第 2 輪）；巴士離開畫面時邊緣指示
      : scene === 2 ? [bodyOf("object")!.position[0]]
      : scene === 4 ? ["ship", "shipR", "shipL"].map(k => bodyOf(k)?.position[0] ?? 0)
      : ["block", "blockB"].map(k => bodyOf(k)?.position[0] ?? 0);
    anchors.forEach((a, lane) => { const dz = F.viewW * 0.2; if (a > cam.current.s[lane] + dz) cam.current.s[lane] = a - dz; else if (a < cam.current.s[lane] - dz) cam.current.s[lane] = a + dz; });
    cam.current.t = m.t;
    const sx = (s: number, lane = 0) => tr.x + tr.w / 2 + (s - cam.current.s[lane]) * pxPerM;
    const camS = cam.current.s[0];
    const step = nice(F.viewW / 6);
    const rangeOf = (lane: number) => [cam.current.s[lane] - F.viewW * 0.6, cam.current.s[lane] + F.viewW * 0.6] as const;

    // ---- 背景 ----
    if (scene === 4) {
      ctx.fillStyle = ink; ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
      ctx.fillStyle = SCENE.white;
      for (let i = 0; i < 60; i++) { const sxStar = ((i * 173 + 31) % 1000) / 1000; const syStar = ((i * 97 + 13) % 1000) / 1000; const xx = ((sxStar * tr.w - camS * pxPerM * 0.3) % tr.w + tr.w) % tr.w; ctx.fillRect(xx, tr.y + syStar * tr.h, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1); }
    } else if (isIndoor(scene)) {
      // 室內：牆（淡色）＋ 地板（灰），桌在地板上
      ctx.fillStyle = SCENE.skyBottom; ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
      ctx.fillStyle = SCENE.hub; ctx.fillRect(tr.x, floorY, tr.w, tr.h - (floorY - tr.y));
    } else {
      const sky = ctx.createLinearGradient(0, tr.y, 0, ty); sky.addColorStop(0, SCENE.skyTop); sky.addColorStop(1, SCENE.skyBottom);
      ctx.fillStyle = sky; ctx.fillRect(tr.x, tr.y, tr.w, ty - tr.y);
      ctx.fillStyle = SCENE.cloud;
      for (let i = 0; i < 4; i++) { const cx = ((i * 271 + 60 - camS * pxPerM * 0.15) % (tr.w + 160) + tr.w + 160) % (tr.w + 160) - 80; const cy = tr.y + 22 + (i % 2) * 18; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.arc(cx + 16, cy - 6, 17, 0, Math.PI * 2); ctx.arc(cx + 34, cy, 13, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = SCENE.ground; ctx.fillRect(tr.x, ty, tr.w, tr.h - (ty - tr.y));
      ctx.fillStyle = SCENE.road; ctx.fillRect(tr.x, ty - 3, tr.w, 12);   // 路面（側視，不畫分隔線）
    }
    // 世界座標的距離標記（每 step 米）：路邊柱與樹（情景 3）、地板刻度（室內）、底部刻度（太空）
    const [sMin, sMax] = rangeOf(0);
    for (let s0 = Math.floor(sMin / step) * step; s0 <= sMax; s0 += step) {
      const x = sx(s0);
      if (scene === 3) {
        const tx = sx(s0 + step / 2); const hT = 30 + (((Math.round(s0 / step) % 3) + 3) % 3) * 10;
        ctx.strokeStyle = SCENE.trunk; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, ty - 3); ctx.lineTo(tx, ty - 3 - hT * 0.5); ctx.stroke();
        ctx.fillStyle = SCENE.leaf; ctx.beginPath(); ctx.arc(tx, ty - 5 - hT * 0.5, hT * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = SCENE.post; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, ty + 9); ctx.lineTo(x, ty + 20); ctx.stroke();
      } else if (isIndoor(scene)) {
        ctx.strokeStyle = SCENE.post; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, floorY); ctx.lineTo(x, floorY + 8); ctx.stroke();
      }
      ctx.font = monoFont(12); ctx.fillStyle = scene === 4 ? SCENE.white : ink; ctx.textAlign = "center";
      ctx.fillText(tick(s0), x, scene === 4 ? tr.y + tr.h - 10 : isIndoor(scene) ? floorY + 20 : ty + 33);
    }
    {   // 軸標題（室內時在地板上方，桌腳之間，加白底框）
      const axisTitle = zh ? "位移 s / m（向右為正 →）" : "displacement s / m (right = + →)"; const ay = scene === 4 ? tr.y + tr.h - 24 : isIndoor(scene) ? floorY - 6 : ty + 47;
      ctx.font = monoFont(11); const tw = ctx.measureText(axisTitle).width;
      if (isIndoor(scene)) { ctx.save(); ctx.globalAlpha = 0.8; ctx.fillStyle = SCENE.white; ctx.fillRect(tr.x + tr.w - 10 - tw, ay - 12, tw + 4, 15); ctx.restore(); }
      ctx.fillStyle = scene === 4 ? SCENE.muted : ink3; ctx.textAlign = "right"; ctx.fillText(axisTitle, tr.x + tr.w - 8, ay);
    }
    if (Math.abs(camS) > 1e-9) { ctx.font = uiFont(12, "700"); ctx.fillStyle = scene === 4 ? SCENE.white : ink; ctx.textAlign = "right"; ctx.fillText(zh ? "鏡頭跟着物體移動（比例不變）" : "Camera follows the object (same scale)", tr.x + tr.w - 8, tr.y + 34); }

    // ---- 桌（情景 1、2）：桌面板 + 桌腳（世界座標，每 1.5 m 一對）；桌面質感跟 μ ----
    const drawTable = (yl: number, lane: number, mu1: number, mu2: number, splitAt: number | null) => {
      const [lo, hi] = rangeOf(lane);
      ctx.fillStyle = SCENE.trunk;
      const legBottom = lane === 0 ? floorY : yl + laneGap - 26;
      const legGap = Math.max(1.5, nice(F.viewW / 8));
      for (let s0 = Math.floor(lo / legGap) * legGap; s0 <= hi; s0 += legGap) { const lx = sx(s0, lane); ctx.fillRect(lx - 4, yl + 4, 8, Math.max(0, legBottom - yl - 4)); }
      ctx.fillRect(tr.x, yl, tr.w, 12);
      const seg = (x0: number, x1: number, mu: number, text: string) => {
        if (x1 <= x0) return;
        ctx.fillStyle = mu === 0 ? SCENE.hub : SCENE.road; ctx.fillRect(x0, yl - 9, x1 - x0, 9);
        if (mu > 0) { const gapPx = Math.max(5, 22 - mu * 28); ctx.strokeStyle = SCENE.post; ctx.lineWidth = 1.5; for (let xx = x0 + 3; xx < x1; xx += gapPx) { ctx.beginPath(); ctx.moveTo(xx, yl - 9); ctx.lineTo(xx + 5, yl); ctx.stroke(); } }
        if (x1 - x0 > 54 && text) { const ly = lane === 0 ? floorY - 6 : yl + 40; ctx.font = uiFont(11); const tw = ctx.measureText(text).width; ctx.save(); ctx.globalAlpha = 0.8; ctx.fillStyle = SCENE.white; ctx.fillRect(x0 + 4, ly - 12, tw + 4, 15); ctx.restore(); ctx.fillStyle = ink2; ctx.textAlign = "left"; ctx.fillText(text, x0 + 6, ly); }   // 主泳道：地板上方；上方泳道：桌面板下（A、B 之下）；白底框令桌腳之間亦可讀
      };
      if (splitAt === null) seg(tr.x, tr.x + tr.w, mu1, zh ? (mu1 === 0 ? "桌面光滑" : `桌面 μ桌 = ${trim3(sig(mu1))}`) : mu1 === 0 ? "smooth table" : `table μ = ${trim3(sig(mu1))}`);
      else {
        const xA = sx(0, lane), xB = sx(splitAt, lane);
        seg(Math.max(tr.x, xA), Math.min(tr.x + tr.w, xB), mu1, zh ? (mu1 === 0 ? "A–B 光滑" : `A–B μ₁ = ${trim3(sig(mu1))}`) : mu1 === 0 ? "A–B smooth" : `A–B μ₁ = ${trim3(sig(mu1))}`);
        seg(Math.max(tr.x, xB), tr.x + tr.w, mu2, zh ? (mu2 === 0 ? "B 之後光滑" : `B 之後 μ₂ = ${trim3(sig(mu2))}`) : mu2 === 0 ? "beyond B smooth" : `beyond B μ₂ = ${trim3(sig(mu2))}`);
        ctx.font = uiFont(12, "700"); ctx.fillStyle = ink; ctx.textAlign = "center";
        if (xA > tr.x - 20 && xA < tr.x + tr.w + 20) ctx.fillText("A", xA + 8, yl + 24);
        if (xB > tr.x - 20 && xB < tr.x + tr.w + 20) ctx.fillText("B", xB + 8, yl + 24);
        if (lane > 0) { ctx.font = monoFont(11); ctx.fillStyle = ink2; for (let s0 = Math.floor(lo / step) * step; s0 <= hi; s0 += step) ctx.fillText(tick(s0), sx(s0, lane), yl + 26); ctx.font = uiFont(11, "700"); ctx.fillStyle = ink; ctx.textAlign = "right"; ctx.fillText(zh ? "方塊 B 的桌（各自鏡頭跟隨）" : "Table of block B (own camera)", tr.x + tr.w - 8, yl - 14); }
      }
    };

    // ---- 情景專屬幾何 ----
    if (scene === 1) {
      for (let lane = 0; lane < lanesN; lane++) drawTable(laneY(lane), lane, m.mu1, m.mu2, m.LAB);
      for (const b of plan.bodies!) {
        const lane = b.position[2]; const yl = laneY(lane); const bw = Math.max(26, b.size[0] * pxPerM); const cx = sx(b.position[0], lane);
        const main = b.key === "block";
        ctx.fillStyle = main ? SCENE.objectA : SCENE.objectB; ctx.strokeStyle = main ? SCENE.objectAEdge : SCENE.objectBEdge; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(cx - bw / 2, yl - 9 - bw, bw, bw, 3); ctx.fill(); ctx.stroke();
        ctx.font = uiFont(12, "700"); ctx.fillStyle = main ? SCENE.objectAEdge : SCENE.white; ctx.textAlign = "center"; ctx.fillText(main ? "A" : "B", cx, yl - 9 - bw / 2 + 4);
        if (m.lanes > 1) {   // 兩個方塊時各泳道左端掛固定標牌（不跟方塊走，永不與箭嘴標籤相撞；儀器審核員第 5 輪）
          const tag = main ? (zh ? `方塊 A　${trim3(sig(m.mA))} kg（琥珀色）` : `Block A  ${trim3(sig(m.mA))} kg (amber)`) : zh ? `方塊 B　${trim3(sig(m.mB))} kg（鋼藍色）` : `Block B  ${trim3(sig(m.mB))} kg (steel blue)`;
          ctx.font = uiFont(12, "700"); const tw = ctx.measureText(tag).width; const tx = tr.x + 8, tyTag = yl - 16;
          ctx.fillStyle = main ? SCENE.objectA : SCENE.objectB; ctx.fillRect(tx, tyTag - 14, tw + 10, 18); ctx.fillStyle = main ? SCENE.objectAEdge : SCENE.white; ctx.textAlign = "left"; ctx.fillText(tag, tx + 5, tyTag);
        }
        if (m.push) drawHand(ctx, cx - bw / 2 - 1, yl - 9 - bw * 0.5, Math.max(20, bw * 0.75), 1);   // 施力中：手掌貼着方塊左面；放手即消失
      }
    } else if (scene === 2) {
      drawTable(ty, 0, m.muTable, 0, null);
      const cloth = bodyOf("cloth")!; const xe = sx(cloth.position[0]); const clothW = cloth.size[0] * pxPerM;
      ctx.fillStyle = SCENE.roadDash; ctx.fillRect(xe, ty - 15, clothW, 6); ctx.strokeStyle = SCENE.objectBEdge; ctx.lineWidth = 1; ctx.strokeRect(xe, ty - 15, clothW, 6);   // 桌布：黃色（與桌面、樽分得開），尾邊在 xe，向右伸到手
      const xh = xe + clothW; drawHand(ctx, xh + 4, ty - 24, 26, -1);        // 拉布的手在布的右端
      ctx.font = monoFont(11); ctx.fillStyle = ink2; ctx.textAlign = "left"; ctx.fillText(`v布 = ${trim3(sig(m.vCloth))} m s⁻¹${zh ? "（恆速）" : " (constant)"}`, xh + 34, ty - 34);
      // 樽：樽身、樽頸、樽蓋
      const obj = bodyOf("object")!; const ow = Math.max(16, obj.size[0] * pxPerM), oh = obj.size[1] * pxPerM; const cx = sx(obj.position[0]);
      const base = m.phase === 0 || m.phase === 1 ? ty - 15 : ty - 9;
      ctx.fillStyle = SCENE.objectA; ctx.strokeStyle = SCENE.objectAEdge; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(cx - ow / 2, base - oh * 0.72, ow, oh * 0.72, 4); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(cx - ow * 0.22, base - oh * 0.94, ow * 0.44, oh * 0.24, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = SCENE.objectAEdge; ctx.fillRect(cx - ow * 0.28, base - oh, ow * 0.56, oh * 0.08);
      // 衝量條（迷思 M9）
      const bx = tr.x + 14, by = tr.y + 52, bwid = Math.min(640, tr.w * 0.5);   // 條闊一點：v布 5 → 10 的減半肉眼可辨（學生試用者第 4 輪）
      // 衝量條：高 22 px、深色外框、條內寫數值（學生試用者第 5 輪：桌面版看不到條）
      ctx.fillStyle = SCENE.white; ctx.fillRect(bx, by, bwid, 22); ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bwid, 22);
      const fillW = bwid * Math.min(1, m.J / Math.max(m.Jmax, 1e-9));
      ctx.fillStyle = SERIES.ke.color; ctx.fillRect(bx, by, fillW, 22);
      ctx.font = monoFont(12, "700"); ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.fillText(`J = ${trim3(sig(m.J))} N s`, bx + fillW + 6, by + 16);
      ctx.font = monoFont(12, "700"); ctx.fillStyle = ink; ctx.textAlign = "left";
      ctx.fillText(`${zh ? "衝量" : "impulse"} J = f·Δt = ${trim3(sig(m.J))} N s`, bx, by - 5);   // 加中點：學生試用者把斜體 f 讀成 ±
      ctx.font = monoFont(11); ctx.fillStyle = ink2;
      ctx.font = monoFont(11); ctx.fillStyle = ink2; ctx.textAlign = "left";
      ctx.fillText(`Δt = ${m.dtPull >= 0 ? trim3(sig(m.dtPull)) : "—"} s，Δv = ${trim3(sig(m.dv))} m s⁻¹`, bx, by + 38);
      ctx.fillStyle = ink3; ctx.fillText(zh ? `（滿格 = 臨界速度 √(2μ布gL) 時的衝量 ${trim3(sig(m.Jmax))} N s）` : `(full bar = impulse at the critical speed √(2μgL), ${trim3(sig(m.Jmax))} N s)`, bx, by + 54);
      if (m.stuck) { ctx.font = uiFont(13, "700"); ctx.fillStyle = SCENE.flag; ctx.fillText(zh ? "樽追上布速，隨布一起走：桌布抽不出" : "The bottle caught up with the cloth and moves with it: the cloth cannot be pulled out", bx, by + 72); }
      else if (m.phase >= 2) { ctx.font = uiFont(12); ctx.fillStyle = ink2; ctx.fillText(zh ? "桌布已抽出，樽在桌面滑行" : "Cloth out; the bottle slides on the table", bx, by + 72); }
    } else if (scene === 3) {
      const bus = bodyOf("bus")!; const bh = bus.size[1] * pxPerM; const floor = ty - 12; const busX = sx(bus.position[0]);
      // 車廂貫穿整個畫面（視為無限長）：車身、地板、扶手橫桿由左畫到右；窗框、吊桿與車輪在世界座標跟巴士走
      ctx.fillStyle = SCENE.objectA; ctx.fillRect(tr.x, floor - bh, tr.w, bh);
      ctx.strokeStyle = SCENE.objectAEdge; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tr.x, floor - bh); ctx.lineTo(tr.x + tr.w, floor - bh); ctx.moveTo(tr.x, floor); ctx.lineTo(tr.x + tr.w, floor); ctx.stroke();
      const winW = 2.2 * pxPerM, winGap = 2.8 * pxPerM; const win0 = busX - Math.ceil((busX - tr.x) / winGap) * winGap;
      ctx.fillStyle = SCENE.objectAWindow; for (let wx = win0; wx < tr.x + tr.w; wx += winGap) ctx.fillRect(wx, floor - bh + 8, winW, bh * 0.34);
      ctx.fillStyle = SCENE.trunk; ctx.fillRect(tr.x, floor, tr.w, 5);   // 地板
      const wheelGap = 7 * pxPerM; for (let wx = busX - Math.ceil((busX - tr.x) / wheelGap) * wheelGap; wx < tr.x + tr.w; wx += wheelGap) { ctx.fillStyle = SCENE.wheel; ctx.beginPath(); ctx.arc(wx, ty - 2, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = SCENE.hub; ctx.beginPath(); ctx.arc(wx, ty - 2, 4, 0, Math.PI * 2); ctx.fill(); }
      const railY = floor - bh * 0.66; ctx.strokeStyle = SCENE.post; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(tr.x, railY); ctx.lineTo(tr.x + tr.w, railY); ctx.stroke();   // 扶手橫桿
      for (let wx = win0 + winW / 2; wx < tr.x + tr.w; wx += winGap) { ctx.strokeStyle = SCENE.post; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx, floor - bh); ctx.lineTo(wx, railY); ctx.stroke(); }   // 扶手吊桿
      ctx.font = uiFont(11, "700"); ctx.fillStyle = ink2; ctx.textAlign = "left"; ctx.fillText(zh ? "扶手" : "handrail", tr.x + 8, railY - 6);
      ctx.font = uiFont(11); ctx.fillStyle = ink2; ctx.fillText(zh ? "車廂視為無限長（貫穿畫面）" : "Bus interior taken as unbounded (spans the view)", tr.x + 8, floor - bh - 6);
      if (busX < tr.x + 8 || busX > tr.x + tr.w - 8) { const left = busX < tr.x + 8; ctx.font = uiFont(12, "700"); ctx.fillStyle = ink; ctx.textAlign = left ? "left" : "right"; ctx.fillText(`${left ? "◀ " : ""}${zh ? "巴士中心在 s = " : "bus centre at s = "}${trim3(sig(bus.position[0]))} m${left ? "" : " ▶"}`, left ? tr.x + 8 : tr.x + tr.w - 8, ty - 60); }
      // 乘客（鋼藍人形）站在地板上
      const pas = bodyOf("passenger")!; const ph = pas.size[1] * pxPerM, pw = pas.size[0] * pxPerM; const cx = sx(pas.position[0]);
      ctx.fillStyle = SCENE.objectB; ctx.strokeStyle = SCENE.objectBEdge; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(cx - pw / 2, floor - ph * 0.72, pw, ph * 0.72, 5); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, floor - ph * 0.86, ph * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (m.handrail) { ctx.strokeStyle = SCENE.objectBEdge; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + pw * 0.4, floor - ph * 0.6); ctx.lineTo(cx + pw * 0.9, railY); ctx.stroke(); ctx.fillStyle = SCENE.objectB; ctx.beginPath(); ctx.arc(cx + pw * 0.9, railY, 6, 0, Math.PI * 2); ctx.fill(); }
      const phaseTxt = zh ? ["起步（勻加速）", "巡航（勻速）", "急煞（勻減速）", "已停"][m.busPhase] : ["starting (uniform acceleration)", "cruising", "braking", "stopped"][m.busPhase];
      ctx.font = uiFont(13, "700"); ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.fillText(`${zh ? "巴士" : "Bus"}：${phaseTxt}　v = ${trim3(sig(m.vBus))} m s⁻¹`, tr.x + 14, tr.y + 34);
      ctx.font = uiFont(12, "700"); ctx.fillStyle = accent; ctx.fillText(zh ? "地面（慣性）視角；考試作答一律用地面視角" : "Ground (inertial) frame — always the frame used in exam answers", tr.x + 14, tr.y + 52);
      ctx.font = monoFont(12); ctx.fillStyle = ink; ctx.fillText(`${zh ? "乘客相對巴士的位移" : "passenger rel. bus"} s_rel = ${sig(m.sRel)} m`, tr.x + 14, tr.y + 70);
      if (m.sliding && !m.handrail) { ctx.font = uiFont(12); ctx.fillStyle = ink2; ctx.fillText(zh ? "乘客相對地板滑動（地板加速超過 μg）" : "Passenger sliding on the floor (floor acceleration exceeds μg)", tr.x + 14, tr.y + 88); }
    } else {
      for (const b of plan.bodies!) {
        const lane = b.position[2]; const yl = laneY(lane); const cx = sx(b.position[0], lane); const L = Math.max(44, b.size[0] * pxPerM), H = Math.max(22, b.size[1] * pxPerM);
        const main = b.key === "ship"; const dir = b.key === "shipL" ? -1 : 1;   // 向左那艘船頭向左
        ctx.fillStyle = main ? SCENE.objectA : dir < 0 ? SCENE.ghost : SCENE.objectB; ctx.strokeStyle = main ? SCENE.objectAEdge : SCENE.objectBEdge; ctx.lineWidth = 1.5;   // 向左那艘灰色，與圖例一致
        ctx.beginPath(); ctx.moveTo(cx + dir * L / 2, yl); ctx.lineTo(cx - dir * L / 2, yl - H / 2); ctx.lineTo(cx - dir * L / 3, yl); ctx.lineTo(cx - dir * L / 2, yl + H / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (m.engineOn && m.Fe !== 0) { const back = m.Fe > 0 ? -1 : 1; ctx.fillStyle = SCENE.flag; ctx.beginPath(); ctx.moveTo(cx + back * L / 3, yl - H / 4); ctx.lineTo(cx + back * (L / 3 + Math.min(60, 12 + Math.abs(m.Fe) * 8)), yl); ctx.lineTo(cx + back * L / 3, yl + H / 4); ctx.closePath(); ctx.fill(); }
      }
      ctx.font = uiFont(13, "700"); ctx.fillStyle = SCENE.white; ctx.textAlign = "left";
      ctx.fillText(`${zh ? "引擎" : "Engine"}：${m.engineOn ? (zh ? "開" : "on") : zh ? "關" : "off"}　${zh ? "燃料消耗" : "fuel"} ${trim3(sig(m.fuel))}`, tr.x + 14, tr.y + 34);
      ctx.font = uiFont(12); ctx.fillStyle = SCENE.muted; ctx.fillText(zh ? "太空：無重量、無摩擦；關引擎後沒有任何力（船頭方向與速度方向無關）" : "Space: no weight, no friction; with the engine off no force acts (heading is independent of velocity)", tr.x + 14, tr.y + 52);
    }

    // ---- 力的支數（規格 §6）----
    if (scene !== 3 && scene !== 4) {
      const who = scene === 1 ? (zh ? "方塊" : "block") : zh ? "樽" : "bottle";
      ctx.font = uiFont(13, "700"); ctx.fillStyle = ink; ctx.textAlign = "left";
      const sMain = plan.labels.find(l => l.symbol === "s")?.value ?? 0;
      ctx.fillText(`${zh ? `作用於${who}的力` : `Forces on the ${who}`}：${m.nForces} ${zh ? "支" : ""}（${zh ? "水平" : "horizontal"} ${m.nHoriz} ${zh ? "支" : ""}）　${zh ? "淨力" : "net"} = ${trim3(sig(m.Fnet))} N　s = ${sig(sMain)} m`, tr.x + 14, tr.y + 34);
      if (scene === 1 && m.tRelease >= 0) { ctx.font = uiFont(12); ctx.fillStyle = SERIES.a.color; ctx.fillText(`${zh ? "已於 t = " : "Released at t = "}${trim3(sig(m.tRelease))} s ${zh ? "放手" : ""}`, tr.x + 14, tr.y + 52); }
    }
    if (m.netOnly) { ctx.font = uiFont(12, "700"); ctx.fillStyle = SCENE.flag; ctx.textAlign = "left"; ctx.fillText(zh ? "只看淨力：個別力已隱藏" : "Net force only: individual forces hidden", tr.x + 14, tr.y + 70); }

    // ---- 箭嘴：像素比例在重置時凍結（水平力、垂直力、速度、加速度各一個）；水平箭嘴靠邊時同步縮短 ----
    const pxOf = (a: ArrowPlan) => (a.kind === "velocity" ? F.pxVel : a.kind === "acceleration" ? F.pxA : a.vector[1] !== 0 ? F.pxV : F.pxH) * (plan.scales[a.kind] ?? 1);
    let shrink = 1;
    for (const a of plan.arrows) { if (a.vector[1] !== 0) continue; const need = Math.abs(a.vector[0]) * pxOf(a); const cx = sx(a.origin[0], a.origin[2]); const room = (a.vector[0] > 0 ? tr.x + tr.w - 8 - cx : cx - tr.x - 8) - 14; if (need > room && need > 0) shrink = Math.min(shrink, Math.max(0.05, room / need)); }
    const baseOf = (lane: number) => (scene === 1 ? laneY(lane) - 9 : scene === 2 ? ty - 15 : scene === 3 ? ty - 12 : laneY(lane));   // 物體底部（接觸面）像素
    const bodyTopOf = (lane: number) => (scene === 1 ? baseOf(lane) - Math.max(22, 0.12 * pxPerM) : scene === 2 ? baseOf(lane) - 0.22 * pxPerM : scene === 3 ? baseOf(lane) - 1.7 * pxPerM : laneY(lane) - Math.max(22, 0.5 * pxPerM) / 2);
    // 標籤底框（半透明白）：在車窗、扶手、桌腳等雜背景上仍可讀
    const label = (text: string, x: number, y: number, color: string, align: CanvasTextAlign) => {
      ctx.font = symbolFont(13); const wText = ctx.measureText(text).width; const x0 = align === "left" ? x - 2 : align === "right" ? x - wText - 2 : x - wText / 2 - 2;
      ctx.save(); ctx.globalAlpha = 0.72; ctx.fillStyle = SCENE.white; ctx.fillRect(x0, y - LABEL_H + 3, wText + 4, LABEL_H); ctx.restore();
      ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, x, y);
    };
    for (const a of plan.arrows) {
      const lane = a.origin[2]; const k = pxOf(a) * (a.vector[1] !== 0 ? 1 : shrink);
      const cx = sx(a.origin[0], lane); const base = baseOf(lane); const top = bodyTopOf(lane);
      const cy = scene === 4 ? laneY(lane) : base - a.origin[1] * pxPerM;
      const color = ARROW_STYLE[a.kind].color;
      const onCloth = scene === 2 && m.phase < 2;
      const normalArrow = plan.arrows.find(x => x.kind === "normal" && x.origin[2] === lane);
      const yRTip = normalArrow ? base - Math.abs(normalArrow.vector[1]) * pxOf(normalArrow) - 22 : Infinity;   // R 標籤（箭頭上方）之上
      if (a.kind === "velocity" || a.kind === "acceleration") { const yy = Math.min(top - 30, yRTip) - (a.kind === "velocity" ? 0 : 24); drawArrow2D(ctx, cx, yy, cx + a.vector[0] * k, yy, a.kind, a.label); continue; }
      if (a.vector[1] !== 0) {   // 垂直力：法向反作用力由接觸面向上、標籤在箭頭上方置中；重量由中心向下、標籤在箭頭旁（桿左側）
        const y0 = a.kind === "normal" ? base : cy; const y1 = y0 - a.vector[1] * k; drawArrow2D(ctx, cx, y0, cx, y1, a.kind);
        if (a.vector[1] > 0) label(forceLabel(a, scene, zh, onCloth), cx, y1 - 6, color, "center"); else label(forceLabel(a, scene, zh, onCloth), cx - 9, y1 + 4, color, "right");
        continue;
      }
      // 水平力分三層：施力在中心之上（標籤在箭嘴上方）、淨力在中心（標籤在箭嘴下方）、摩擦貼接觸面（標籤在桌面／地板之下）
      const yy = a.layer === "applied" ? cy - 14 : a.kind === "friction" ? base - 5 : cy;
      const x1 = cx + a.vector[0] * k; drawArrow2D(ctx, cx, yy, x1, yy, a.kind);
      const align: CanvasTextAlign = a.vector[0] > 0 ? "left" : "right"; const lx = x1 + (a.vector[0] > 0 ? 6 : -6);
      // 施力：箭頭外側、箭嘴上方；摩擦：箭頭外側、沿箭嘴線；淨力：沿箭嘴線，但有同向摩擦（放手後粗糙段淨力 = 摩擦，兩箭頭同 x）時改放箭嘴上方
      const frictionSameDir = a.kind === "net" && plan.arrows.some(x => x.kind === "friction" && x.origin[2] === lane && Math.sign(x.vector[0]) === Math.sign(a.vector[0]));
      label(forceLabel(a, scene, zh, onCloth), lx, a.layer === "applied" ? yy - 8 : frictionSameDir ? yy - 9 : yy + 5, color, align);
    }
    if (shrink < 1 - 1e-9) { ctx.font = uiFont(11); ctx.fillStyle = scene === 4 ? SCENE.muted : ink3; ctx.textAlign = "right"; ctx.fillText(zh ? "箭嘴已按邊緣空間同步縮短（比例不變）" : "Arrows shortened together to fit the edge (same ratio)", tr.x + tr.w - 8, tr.y + 16); }
    // 位移標籤
    // 位移標籤：只有情景 4 畫在飛船下方（情景 1、2 的 s 已併入左上資訊行；情景 3 的 s_rel 亦在資訊行）
    for (const lab of plan.labels) if (lab.symbol === "s" && scene === 4) { const cx = sx(lab.position[0]); ctx.font = monoFont(12); ctx.fillStyle = SCENE.white; ctx.textAlign = "center"; ctx.fillText(`s = ${sig(lab.value)} ${lab.unit}`, cx, laneY(0) + 40); }

    // ---- 線圖：左 s–t（巴士：相對巴士的位移），右 v–t（可多條線）----
    const gap = 12, top = trackH + 8, gh = h - top - 8, gw = (w - gap * 3) / 2;
    const mk = (i: number, yAbs: number): Pane => ({ x: gap + i * (gw + gap), y: top, w: gw, h: gh, yMin: -yAbs, yMax: yAbs, tMax: m.T });
    const sPane = mk(0, F.sAx), vPane = mk(1, F.vAx);
    const tr2 = (key: string) => plan.trails?.find(t => t.key === key)?.points ?? [];
    const line = (p: Pane, pts: [number, number, number][], color: string, width = 2.5, alpha = 1) => {
      if (pts.length < 2) return; ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      pts.forEach((q, i) => { const yy = py(p, Math.max(p.yMin, Math.min(p.yMax, q[1]))); if (i) ctx.lineTo(px(p, q[0]), yy); else ctx.moveTo(px(p, q[0]), yy); }); ctx.stroke(); ctx.restore();
    };
    const marker = (p: Pane, tMark: number, text: string) => { if (tMark < 0 || tMark > p.tMax) return; const xx = px(p, tMark); ctx.strokeStyle = ink; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xx, py(p, p.yMax)); ctx.lineTo(xx, py(p, p.yMin)); ctx.stroke(); ctx.setLineDash([]); ctx.font = uiFont(11, "700"); ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.fillText(text, xx + 3, py(p, p.yMax) + 12); };
    const tStep = nice(m.T / 6); const xTicks: number[] = []; for (let tv = 0; tv <= m.T + 1e-9; tv += tStep) xTicks.push(Number(tv.toFixed(6)));
    const sTitle = scene === 3 ? (zh ? "s_rel–t 圖（乘客相對巴士的位移）" : "s_rel–t graph") : zh ? "s–t 圖（位移—時間）" : "s–t graph";
    drawPane(ctx, sPane, { title: sTitle, yLabel: "s / m", color: accent, tint: SERIES.s.tint, xTicks }, T);
    line(sPane, tr2("s-t"), accent);
    if (scene === 1 && m.lanes > 1) line(sPane, tr2("s2-t"), SCENE.objectB, 2, 0.9);
    const { x0: vx0 } = drawPane(ctx, vPane, { title: zh ? "v–t 圖（速度—時間）" : "v–t graph", yLabel: "v / m s⁻¹", color: SERIES.v.color, tint: SERIES.v.tint, xTicks }, T);
    const second = tr2("v2-t"), third = tr2("v3-t");
    if (second.length) line(vPane, second, SCENE.objectB, 2, 0.9);
    if (third.length) line(vPane, third, SCENE.ghost, 2, 0.9);
    line(vPane, tr2("v-t"), SERIES.v.color);
    if (second.length) { ctx.font = uiFont(11); ctx.fillStyle = ink2; ctx.textAlign = "left"; const who = scene === 1 ? (zh ? "綠＝方塊 A（琥珀色），藍＝方塊 B" : "green = block A (amber), blue = block B") : scene === 2 ? (zh ? "綠＝樽，藍＝桌布" : "green = bottle, blue = cloth") : scene === 3 ? (zh ? "綠＝乘客，藍＝巴士" : "green = passenger, blue = bus") : zh ? "綠＝靜止那艘（琥珀色），藍＝向右，灰＝向左" : "green = at rest (amber), blue = right, grey = left"; ctx.fillText(who, vx0 + 6, vPane.y + vPane.h - 28); }
    if (scene === 1) marker(vPane, m.tRelease, zh ? "放手" : "released");
    if (scene === 2 && m.tLeave >= 0) marker(vPane, m.tLeave, zh ? "抽出" : "out");
    for (const [p, key] of [[sPane, "s-t"], [vPane, "v-t"]] as const) { const cur = tr2(key).at(-1); if (!cur) continue; const cxp = px(p, cur[0]), cyp = py(p, Math.max(p.yMin, Math.min(p.yMax, cur[1]))); ctx.fillStyle = key === "s-t" ? accent : SERIES.v.color; ctx.beginPath(); ctx.arc(cxp, cyp, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = ink3; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(cxp, py(p, p.yMax)); ctx.lineTo(cxp, py(p, p.yMin)); ctx.stroke(); ctx.setLineDash([]); }
  }, [plan, lang]);

  return (
    <div className="scene2d" style={{ position: "absolute", inset: 0 }}>
      <Canvas2D draw={draw} frame={0} />
    </div>
  );
}
export type { RenderPlan };
