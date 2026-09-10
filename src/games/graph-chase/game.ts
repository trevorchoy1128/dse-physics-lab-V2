import type { Text } from "@/shell/types";

// v–t 圖追車：遊戲邏輯（純 TypeScript，不碰畫布）。
// 目標車按一條折線 v–t 圖行駛；學生用「油門桿」設定自己的加速度 a（v–t 圖的斜率），
// 令自己的 v–t 圖貼住目標線。物理與 #023 運動線圖一致：a 分段恆定，v = u + at，s = ut + ½at²。
// 評分：每個時間樣本 |v − v目標| ≤ TOL 即「在帶內」；在帶內的樣本比例決定星數。

export interface Level {
  id: string;
  name: Text;
  brief: Text;                       // 關卡說明（學生看）
  hint: Text;                        // 物理提示（按「提示」才看）
  points: [number, number][];        // 目標 v–t 折線頂點 (t, v)：t 由 0 遞增，末點的 t 就是本關時長
  aMax: number;                      // 油門桿範圍 ±aMax / m s⁻²
  vMax: number; vMin: number;        // v 軸範圍（每關固定，播放中不變）
  view: number;                      // 路面畫面寬度 / m（每關固定）
}

export const A_STEP = 0.5;           // 油門桿格距 / m s⁻²（目標斜率全是它的倍數，所以每關都可以完全貼線）
export const DT = 0.01;              // 積分步長 / s
export const TOL = 0.8;              // 容差 / m s⁻¹（圖上的陰影帶）
export const STAR_MIN = [0.5, 0.7, 0.9] as const;   // 1★ 2★ 3★ 的最低帶內比例

export const durationOf = (L: Level) => L.points[L.points.length - 1][0];
export const v0Of = (L: Level) => L.points[0][1];
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** t 所在的線段序號（右連續：頂點時刻屬於之後的一段；t ≥ T 屬最後一段） */
function segAt(L: Level, t: number) {
  const p = L.points; let i = 0;
  while (i < p.length - 2 && t >= p[i + 1][0]) i++;
  return i;
}
export function targetV(L: Level, t: number) {
  t = clamp(t, 0, durationOf(L));
  const i = segAt(L, t), [t0, v0] = L.points[i], [t1, v1] = L.points[i + 1];
  return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
}
/** 目標線在 t 的斜率 = 目標車的加速度 */
export function targetA(L: Level, t: number) {
  const i = segAt(L, clamp(t, 0, durationOf(L))), [t0, v0] = L.points[i], [t1, v1] = L.points[i + 1];
  return (v1 - v0) / (t1 - t0);
}
/** 目標線由 0 到 t 的線下面積 = 目標車的位移（梯形逐段相加） */
export function targetS(L: Level, t: number) {
  t = clamp(t, 0, durationOf(L));
  let s = 0;
  for (let i = 0; i < L.points.length - 1; i++) {
    const [t0, v0] = L.points[i], [t1, v1] = L.points[i + 1];
    if (t <= t0) break;
    const te = Math.min(t, t1), ve = v0 + ((v1 - v0) * (te - t0)) / (t1 - t0);
    s += 0.5 * (v0 + ve) * (te - t0);
  }
  return s;
}
/** 油門桿只可停在格點上，且不超出 ±aMax */
export const quantA = (a: number, L: Level) => clamp(Math.round(a / A_STEP) * A_STEP, -L.aMax, L.aMax) + 0;   // +0：去掉 −0

// ---- 一次行駛 ----
export interface Run {
  t: number; v: number; s: number;   // 現在時刻、學生車速度、學生車位移
  n: number;                         // 已走的步數
  inBand: number;                    // 在帶內的樣本數（含 t = 0）
  maxErr: number;                    // 最大 |v − v目標|
  ts: number[]; vs: number[]; ss: number[]; as: number[];   // 逐步樣本（畫線用）；as[k] 是第 k 步用的 a
}
export const newRun = (L: Level): Run => ({ t: 0, v: v0Of(L), s: 0, n: 0, inBand: 1, maxErr: 0, ts: [0], vs: [v0Of(L)], ss: [0], as: [] });

/** 以加速度 a 走一步；回傳是否已到終點。步長固定，t 由步數計算，不累積浮點誤差。 */
export function step(L: Level, run: Run, a: number): boolean {
  const T = durationOf(L);
  if (run.t >= T - 1e-9) return true;
  const dt = Math.min(DT, T - run.t);
  run.s += run.v * dt + 0.5 * a * dt * dt;   // 恆加速度一步的精確解
  run.v += a * dt;
  run.n++; run.t = Math.min(T, run.n * DT);
  const err = Math.abs(run.v - targetV(L, run.t));
  if (err <= TOL + 1e-9) run.inBand++;
  if (err > run.maxErr) run.maxErr = err;
  run.ts.push(run.t); run.vs.push(run.v); run.ss.push(run.s); run.as.push(a);
  return run.t >= T - 1e-9;
}

export interface Score {
  fraction: number;                  // 在帶內的樣本比例 0–1
  stars: number;                     // 0–3（0 = 未過關）
  gap: number;                       // 終點時 學生車位移 − 目標車位移 / m（正 = 領先）
  maxErr: number;
}
export function score(L: Level, run: Run): Score {
  const fraction = run.inBand / (run.n + 1);
  const stars = fraction >= STAR_MIN[2] ? 3 : fraction >= STAR_MIN[1] ? 2 : fraction >= STAR_MIN[0] ? 1 : 0;
  return { fraction, stars, gap: run.s - targetS(L, run.t), maxErr: run.maxErr };
}

/** 用一個策略（每步看 t 與現況決定 a）行駛整關；測試與示範用 */
export function play(L: Level, policy: (t: number, run: Run) => number): Run {
  const run = newRun(L);
  while (!step(L, run, quantA(policy(run.t, run), L))) { /* 直到終點 */ }
  return run;
}

// ---- 進度（localStorage，私隱模式失敗也不影響遊戲）----
const KEY = "dsepl-game-graph-chase";
export type Progress = Record<string, number>;   // levelId → 最佳星數
export const loadProgress = (): Progress => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };
export const saveProgress = (p: Progress) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* 私隱模式 */ } };
