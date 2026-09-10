import type { Text } from "@/shell/types";

// 拋體攻城：遊戲邏輯（純 TypeScript，不碰畫布）。
// 物理與 #033 拋體運動模擬一致（無空氣阻力）：x = u cosθ t，y = h + u sinθ t − ½gt²。
// 命中以球心計：球心進入目標圓（半徑 r）即命中；球心進入障礙（矩形內部）即撞牆；y < 0 即落地。

export interface Block { x0: number; x1: number; y0: number; y1: number }   // 障礙：軸對齊矩形 / m
export interface Target { x: number; y: number; r: number }               // 目標圓心與半徑 / m

export interface Level {
  id: string;
  name: Text;
  brief: Text;                       // 關卡說明（學生看）
  hint: Text;                        // 公式提示（按「提示」才看）
  g: number;                         // m s⁻²
  h: number;                         // 發射高度 / m（炮台在懸崖上）
  target: Target;
  blocks: Block[];
  lock?: { u?: number; theta?: number };   // 本關固定的參數
  uMax: number;                      // 初速滑桿上限
  world: { xMax: number; yMax: number };   // 畫面範圍（每關固定，播放中不變）
  goal?: "twin" | "economy";         // twin：兩個投射角都命中才滿星；economy：初速越小星越多
  start: { u: number; theta: number };     // 進入關卡時的滑桿預設（刻意不命中）
}

export type Outcome = "hit" | "ground" | "block";
export interface ShotResult {
  outcome: Outcome;
  tEnd: number;                      // 結束時刻 / s
  path: [number, number][];          // 每 PATH_DT 一點，最後一點是結束位置
  xEnd: number; yEnd: number;
  miss: number;                      // 落地點與目標的水平差 xEnd − target.x / m（命中為 0）
  R: number;                         // 射程（回到 y = 0）/ m
  T: number;                         // 飛行時間（回到 y = 0）/ s
  H: number;                         // 最高點 / m
}

export const U_STEP = 0.1, THETA_STEP = 1, U_MIN = 1;
const CHECK_DT = 0.002, PATH_DT = 0.02;
const rad = (d: number) => (d * Math.PI) / 180;

export const flightTime = (u: number, thetaDeg: number, h: number, g: number) => {
  const uy = u * Math.sin(rad(thetaDeg));
  if (h <= 0 && uy <= 0) return 0;
  return (uy + Math.sqrt(uy * uy + 2 * g * h)) / g;
};
export const range = (u: number, thetaDeg: number, h: number, g: number) => u * Math.cos(rad(thetaDeg)) * flightTime(u, thetaDeg, h, g);
export const maxHeight = (u: number, thetaDeg: number, h: number, g: number) => { const uy = u * Math.sin(rad(thetaDeg)); return uy > 0 ? h + (uy * uy) / (2 * g) : h; };
/** 由 (0, h) 射到 (x, y) 所需的最小初速：u² = g(Δy + √(Δy² + x²)) */
export const minSpeedTo = (x: number, y: number, h: number, g: number) => { const dy = y - h; return Math.sqrt(g * (dy + Math.hypot(dy, x))); };

const inside = (b: Block, x: number, y: number) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;

export function simulateShot(level: Level, u: number, thetaDeg: number): ShotResult {
  const { g, h, target } = level;
  const th = rad(thetaDeg), ux = u * Math.cos(th), uy = u * Math.sin(th);
  const T = flightTime(u, thetaDeg, h, g), R = range(u, thetaDeg, h, g), H = maxHeight(u, thetaDeg, h, g);
  const pos = (t: number): [number, number] => [ux * t, h + uy * t - 0.5 * g * t * t];
  const path: [number, number][] = [[0, h]];
  let outcome: Outcome = "ground", tEnd = T, sincePath = 0;
  for (let t = CHECK_DT; t <= T + CHECK_DT; t += CHECK_DT) {
    const [x, y] = pos(t);
    if (Math.hypot(x - target.x, y - target.y) <= target.r) { outcome = "hit"; tEnd = t; break; }
    if (level.blocks.some(b => inside(b, x, y))) { outcome = "block"; tEnd = t; break; }
    if (y < 0) { outcome = "ground"; tEnd = T; break; }
    sincePath += CHECK_DT;
    if (sincePath >= PATH_DT - 1e-9) { sincePath -= PATH_DT; path.push([x, y]); }
  }
  const [xe, ye] = pos(tEnd);
  const xEnd = outcome === "ground" ? R : xe, yEnd = outcome === "ground" ? 0 : ye;
  path.push([xEnd, yEnd]);
  return { outcome, tEnd, path, xEnd, yEnd, miss: outcome === "hit" ? 0 : xEnd - target.x, R, T, H };
}

/** 命中時的星數（1–3） */
export function starsFor(level: Level, ctx: { shots: number; u: number; theta: number; hitBothSides: boolean }): number {
  if (level.goal === "twin") return ctx.hitBothSides ? 3 : 1;
  if (level.goal === "economy") {
    const uMin = minSpeedTo(level.target.x, level.target.y, level.h, level.g);
    return ctx.u <= uMin + 0.6 ? 3 : ctx.u <= uMin * 1.2 ? 2 : 1;
  }
  return ctx.shots <= 1 ? 3 : ctx.shots <= 3 ? 2 : 1;
}

/** 滑桿格點上的全部解（測試用）：回傳 [u, θ] 列表 */
export function solutions(level: Level): [number, number][] {
  const out: [number, number][] = [];
  const us = level.lock?.u !== undefined ? [level.lock.u] : Array.from({ length: Math.round((level.uMax - U_MIN) / U_STEP) + 1 }, (_, i) => +(U_MIN + i * U_STEP).toFixed(1));
  const ths = level.lock?.theta !== undefined ? [level.lock.theta] : Array.from({ length: 90 / THETA_STEP + 1 }, (_, i) => i * THETA_STEP);
  for (const u of us) for (const th of ths) {
    if (range(u, th, level.h, level.g) < level.target.x - level.target.r) continue;   // 解析射程未到目標：不用逐步檢查
    if (simulateShot(level, u, th).outcome === "hit") out.push([u, th]);
  }
  return out;
}

// ---- 進度（localStorage，私隱模式失敗也不影響遊戲）----
const KEY = "dsepl-game-projectile-siege";
export type Progress = Record<string, number>;   // levelId → 最佳星數
export const loadProgress = (): Progress => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };
export const saveProgress = (p: Progress) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* 私隱模式 */ } };
