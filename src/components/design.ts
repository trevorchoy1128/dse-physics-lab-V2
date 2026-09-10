// 全站設計語言（老師 2026-09-06：所有模擬要同一個 design language）。
// 每個 Scene / Views 只可以從這裏取顏色、字體、刻度與畫圖工具；tools/designlint.mjs 會擋下自定義的版本。
// 文件：.claude/skills/new-sim/references/design-language.md
import { ARROW_STYLE } from "./arrowMath";
import type { ArrowKind } from "@/shell/types";

// ---- 主題色（跟 index.css 的 CSS 變數，支援深色模式）----
export interface Theme { ink: string; ink2: string; ink3: string; line: string; accent: string; paper: string; unit: string }
export function theme(): Theme {
  const css = getComputedStyle(document.documentElement);
  const v = (k: string, d: string) => css.getPropertyValue(k).trim() || d;
  return {
    ink: v("--ink", "#1b2530"), ink2: v("--ink-2", "#4a5563"), ink3: v("--ink-3", "#7b8591"),
    line: v("--line", "#d8ddd7"), accent: v("--accent", "#0e6f6a"), paper: v("--paper", "#ffffff"),
    unit: v("--unit", "#0e6f6a"),
  };
}

// ---- 場景調色板：只可用這些名字。物體避開向量顏色編碼（紅、藍、橙、紫、綠）----
export const SCENE = {
  skyTop: "#dbeeff", skyBottom: "#f7fbff", cloud: "rgba(255,255,255,0.9)",
  ground: "#cfe3c4", road: "#4a5568", roadDash: "#f2c94c",
  trunk: "#8a5a2b", leaf: "#3f9d5a", post: "#6b7280", flag: "#e0522d",
  objectA: "#f5a623", objectAEdge: "#8a5a00", objectAWindow: "#ffe8b3",   // 主物體：琥珀色（小車、球 A）
  objectB: "#4a6fa5", objectBEdge: "#24416b",                              // 第二物體：鋼藍（球 B、對照物）
  wheel: "#2b2f36", hub: "#c8cdd4",
  ghost: "#8a94a0", muted: "#9aa5b1",                                      // 對照／殘影／次要格線
  white: "#ffffff",
} as const;

// ---- 線圖色系：每種量一個固定顏色與底色 ----
export const SERIES = {
  s: { color: "accent" as const, tint: "rgba(14,111,106,0.08)" },          // 位移：主題色
  v: { color: ARROW_STYLE.velocity.color, tint: "rgba(26,156,75,0.08)" },  // 速度：與速度箭嘴同色
  a: { color: "#0b8f9d", tint: "rgba(11,143,157,0.08)" },                  // 加速度：青藍
  ke: { color: "#e0891c", tint: "rgba(224,137,28,0.08)" },                 // 動能：橙
  pe: { color: "#4a6fa5", tint: "rgba(74,111,165,0.08)" },                 // 勢能：鋼藍
  total: { color: "#1b2530", tint: "rgba(27,37,48,0.06)" },                // 總能量：墨色
} as const;
export const AREA_FILL = { positive: "rgba(14,111,106,0.22)", negative: "rgba(247,127,0,0.28)" } as const;

// ---- 字體：畫布內文字最少 12 px（等寬 11 px）；iPad 上不再縮小 ----
export const uiFont = (size: number, weight: "" | "700" = "") => `${weight ? weight + " " : ""}${Math.max(12, size)}px "Noto Sans TC", system-ui, sans-serif`;
export const monoFont = (size: number, weight: "" | "700" = "") => `${weight ? weight + " " : ""}${Math.max(11, size)}px "IBM Plex Mono", monospace`;
export const symbolFont = (size: number) => `italic ${uiFont(size)}`;

// ---- 數字 ----
/** 1–2–5 好看刻度：≥ m 的最小值 */
export const nice = (m: number) => { const e = 10 ** Math.floor(Math.log10(m)); const f = m / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };
/** 刻度數字：10 而非 10.0，−0 → 0 */
export const tick = (v: number) => String(Number(v.toPrecision(6)) + 0);
/** 三位有效數字後去掉小數尾零（讀數面板用 sig，畫布內用這個） */
export const trim3 = (s: string) => s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");

// ---- 2D 箭嘴：顏色與線型由 ARROW_STYLE 決定，不可覆寫 ----
export function drawArrow2D(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, kind: ArrowKind, label?: string) {
  const st = ARROW_STYLE[kind];
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len, uy = dy / len;
  ctx.strokeStyle = st.color; ctx.lineWidth = st.dashed ? 2.5 : 3.5; ctx.setLineDash(st.dashed ? [6, 4] : []);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  if (st.head === "open") {
    ctx.beginPath(); ctx.moveTo(x1 - ux * 9 - uy * 6, y1 - uy * 9 + ux * 6); ctx.lineTo(x1, y1); ctx.lineTo(x1 - ux * 9 + uy * 6, y1 - uy * 9 - ux * 6); ctx.stroke();
  } else {
    ctx.fillStyle = st.color; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ux * 10 - uy * 6, y1 - uy * 10 + ux * 6); ctx.lineTo(x1 - ux * 10 + uy * 6, y1 - uy * 10 - ux * 6); ctx.closePath(); ctx.fill();
  }
  if (label) { ctx.fillStyle = st.color; ctx.font = symbolFont(13); ctx.textAlign = ux > 0.3 ? "left" : ux < -0.3 ? "right" : "center"; ctx.fillText(label, x1 + ux * 6, y1 + uy * 6 + 4); }
}

// ---- 線圖框：同一種版式（底色、頂部色條、標題、y 格線、t 軸在 y = 0）----
export interface Pane { x: number; y: number; w: number; h: number; yMin: number; yMax: number; tMax: number; padY?: number }
// y 方向上下留白：格線仍畫在 yMax / yMin，但曲線到頂時距離圖框頂部仍有 padY × (yMax − yMin) 的空位
// （老師 2026-09-11：曲線緊貼頂部學生很難看）。預設 0.12。
const yRange = (p: Pane) => { const pad = (p.padY ?? 0.12) * (p.yMax - p.yMin); return { lo: p.yMin - pad, hi: p.yMax + pad }; };
export const px = (p: Pane, t: number) => p.x + 44 + ((p.w - 56) * t) / p.tMax;
export const py = (p: Pane, y: number) => { const { lo, hi } = yRange(p); return p.y + 22 + ((p.h - 44) * (hi - y)) / (hi - lo); };
export const fromPy = (p: Pane, yy: number) => { const { lo, hi } = yRange(p); return hi - ((yy - p.y - 22) * (hi - lo)) / (p.h - 44); };

export interface PaneStyle {
  title: string;            // 例：「s–t 圖（位移—時間）」
  yLabel: string;           // 例：「s / m」
  xLabel?: string;          // 預設「t / s」
  color: string; tint: string;
  xTicks?: number[];        // 不給則 0 … tMax 六格
  labelEveryPx?: number;    // 刻度數字最少相隔像素（預設 26）
}
/** 畫框、軸、格線、刻度與標題；回傳 y = 0 的像素位置與「數字在軸線下方」旗標，供後續畫曲線 */
export function drawPane(ctx: CanvasRenderingContext2D, p: Pane, st: PaneStyle, T: Theme) {
  ctx.fillStyle = st.tint; ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = st.color; ctx.fillRect(p.x, p.y, p.w, 3);   // 頂部色條
  const x0 = px(p, 0), x1 = px(p, p.tMax), y0 = py(p, 0);
  ctx.strokeStyle = T.ink3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, py(p, p.yMax)); ctx.lineTo(x0, py(p, p.yMin)); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
  ctx.font = monoFont(10); ctx.fillStyle = T.ink3; ctx.textAlign = "right";
  for (const yv of [p.yMax, p.yMax / 2, 0, p.yMin / 2, p.yMin]) { const yy = py(p, yv); ctx.fillText(tick(yv), x0 - 4, yy + 3); ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
  ctx.textAlign = "center";
  // t 軸刻度與數字放在 y = 0 的軸線上（老師要求）；軸線貼近底部時放上方
  const below = y0 + 16 < p.y + p.h - 4;
  const ticks = st.xTicks ?? Array.from({ length: 6 }, (_, i) => (i * p.tMax) / 5);
  const tickGap = ticks.length > 1 ? px(p, ticks[1]) - px(p, ticks[0]) : p.w; const labelEvery = Math.max(1, Math.ceil((st.labelEveryPx ?? 26) / tickGap));
  ticks.forEach((tv, i) => { ctx.strokeStyle = T.ink3; ctx.beginPath(); ctx.moveTo(px(p, tv), y0 - 3); ctx.lineTo(px(p, tv), y0 + 3); ctx.stroke(); if (i % labelEvery === 0) ctx.fillText(tick(tv), px(p, tv), below ? y0 + 13 : y0 - 6); });
  ctx.font = uiFont(12, "700"); ctx.fillStyle = st.color; ctx.textAlign = "left"; ctx.fillText(st.title, p.x + 6, p.y + 15);
  ctx.font = monoFont(10); ctx.fillStyle = T.ink3; ctx.textAlign = "right"; ctx.fillText(st.yLabel, p.x + p.w - 4, p.y + 12); ctx.fillText(st.xLabel ?? "t / s", p.x + p.w - 4, below ? y0 - 6 : y0 + 13);
  return { x0, x1, y0, below };
}
