import type { SimModel } from "@/shell/types";

// Book 2 規格 模擬器 7。方程：v = Δs/Δt（斜率）、a = Δv/Δt（斜率）、s = ∫v dt（線下面積）；
// 勻加速：v = u + at、s = ut + ½at²、v² = u² + 2as。
// 兩種模式：live = 由運動生成圖（學生即時控制 a）；draw = 由圖生成運動（v–t 折線，每秒一個控制點）。
// v 在兩種模式下都是分段線性，故本模型的積分（梯形）是精確的，不需要 RK4。

export interface P {
  mode: "live" | "draw";
  u: number;        // 初速 / m s⁻¹（live）
  a: number;        // 加速度 / m s⁻²（live，可即時改）
  T: number;        // 時間窗 / s
  vt: number[];     // draw：t = 0, 1, …, T 的 v 值（長度 T + 1）
}
export interface Sample { t: number; s: number; v: number; a: number }
export interface S {
  t: number;
  s: number;        // 位移（向右為正）
  v: number;
  dist: number;     // 路程
  done: boolean;
  hist: Sample[];   // 每 0.02 s 一個樣本，供線圖與核數
}

export const SAMPLE_DT = 0.02;

/** v–t 折線在 t 的插值（控制點在整數秒） */
export function vAt(vt: number[], t: number): number {
  const n = vt.length - 1;
  if (t <= 0) return vt[0];
  if (t >= n) return vt[n];
  const k = Math.floor(t);
  const f = t - k;
  return vt[k] + (vt[k + 1] - vt[k]) * f;
}
/** 折線在 t 的斜率（節點右側） */
export function aAt(vt: number[], t: number): number {
  const n = vt.length - 1;
  if (t < 0 || t >= n) return 0;
  const k = Math.floor(t + 1e-12);
  return vt[k + 1] - vt[k];
}

const accel = (p: P, t: number) => (p.mode === "draw" ? aAt(p.vt, t) : p.a);
const vel = (p: P, t: number, v: number) => (p.mode === "draw" ? vAt(p.vt, t) : v);

export const model: SimModel<S, P> = {
  init(p) {
    const v0 = p.mode === "draw" ? vAt(p.vt, 0) : p.u;
    return { t: 0, s: 0, v: v0, dist: 0, done: false, hist: [{ t: 0, s: 0, v: v0, a: accel(p, 0) }] };
  },

  step(s, p, dt) {
    if (s.done) return s;
    const t2 = s.t + dt;
    const a = accel(p, s.t);
    // v：live 模式 v = u + at 的逐步形式；draw 模式直接取折線（精確）
    const v2 = p.mode === "draw" ? vel(p, t2, s.v) : s.v + a * dt;
    // s：梯形法，對分段線性的 v 精確
    const ds = 0.5 * (s.v + v2) * dt;
    // 路程：若此步內 v 變號，按比例分段取絕對值
    let dd: number;
    if (s.v * v2 < 0) {
      const f = s.v / (s.v - v2);            // 變號時刻在步內的比例
      dd = 0.5 * Math.abs(s.v) * f * dt + 0.5 * Math.abs(v2) * (1 - f) * dt;
    } else dd = Math.abs(ds);
    const done = t2 >= p.T - 1e-12;
    const next: S = { t: t2, s: s.s + ds, v: v2, dist: s.dist + dd, done, hist: s.hist };
    if (Math.floor(t2 / SAMPLE_DT + 1e-9) > Math.floor(s.t / SAMPLE_DT + 1e-9) || done) {
      next.hist = [...s.hist, { t: t2, s: next.s, v: v2, a: accel(p, t2) }];
    }
    return next;
  },

  observe(s, p) {
    // 到達時間窗末端後畫面凍結，a 保持最後一段的值（核數員 F1：不得歸零令 v 與 a 自相矛盾）
    const a = accel(p, Math.min(s.t, p.T - 1e-9));
    return {
      s: s.s,
      dist: s.dist,
      v: s.v,
      a,
      speed: Math.abs(s.v),
      area: s.s,                                   // v–t 線下面積（由 0 至 t）＝ 位移
      avgSpeed: s.t > 0 ? s.dist / s.t : 0,
      avgVel: s.t > 0 ? s.s / s.t : 0,
    };
  },

  events(prev, next) {
    const ev = [];
    if (prev.v * next.v < 0) ev.push({ key: "reverse", t: next.t, label: { zh: "反向", en: "Reversed" } });
    if (!prev.done && next.done) ev.push({ key: "end", t: next.t, label: { zh: "到達時間窗末端", en: "End of time window" } });
    return ev;
  },
};
