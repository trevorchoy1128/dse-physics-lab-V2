import type { SimModel, SimEvent } from "@/shell/types";

// 規格 13_024（S15）§7 方程。四個情景共用一個模型：
//   第一定律：ΣF = 0 ⇒ v 恆定；第二定律 ΣF = ma 只用於量化不平衡力。
//   摩擦統一：與相對接觸面的運動（或運動趨勢）反向，大小上限 μR = μmg；μs = μk = μ（老師決定）。
//   接觸面本身在加速（巴士地板、桌布）時，物體加速度上限 μg：|a面| ≤ μg 跟着走，否則相對滑動。
// 每一段的加速度都是常數，所以逐步用閉式 s = s₀ + vt + ½at²、v = v₀ + at 精確積分；
// 步內的事件（v 過零、越過 B 點、桌布抽出、追上桌布、巴士換相、相對速度過零）先算出時刻再分段走，不用 RK4。

export type SceneId = "table" | "cloth" | "bus" | "space";

export interface P {
  scene: SceneId;
  g: number;
  // 情景 1 水平桌面上的方塊（2024 卷一乙部 Q3）
  m: number;            // 方塊質量 / kg
  F: number;            // 外加水平力 / N
  push: "on" | "off";   // 施力中 / 已放手（即時控制，不重置）
  mu1: number;          // 前段桌面（A→B）的摩擦係數
  mu2: number;          // 後段桌面（B 之後）的摩擦係數
  second: boolean;      // 第二個方塊
  mB: number;           // 第二個方塊質量 / kg
  // 情景 2 桌布實驗
  vCloth: number;       // 桌布抽出速率 / m s⁻¹（恆定）
  muCloth: number;      // 布與物件之間的摩擦係數
  muTable: number;      // 物件與桌面之間的摩擦係數
  L: number;            // 物件下方的桌布長度 / m
  mObj: number;         // 物件質量 / kg（不設滑桿，固定 1.0；模型內可變供驗證條件 11）
  // 情景 3 巴士上的乘客
  aBus: number;         // 起步／煞車的加速度大小 / m s⁻²
  vBus: number;         // 巡航速度 / m s⁻¹
  muBus: number;        // 乘客（鞋）與地板的摩擦係數
  handrail: boolean;    // 握扶手
  // 情景 4 太空中的飛船
  Fe: number;           // 引擎推力 / N
  engine: "on" | "off"; // 引擎開關（即時）
  dir: "forward" | "backward";   // 引擎方向（即時）
  mShip: number;        // 飛船質量 / kg
  trio: boolean;        // 三艘飛船（靜止、向右、向左）
}

export interface Body { s: number; v: number }
export interface Sample { t: number; s: number; v: number; a: number; s2: number; v2: number; s3: number; v3: number }
export interface S {
  t: number;
  done: boolean;
  a: Body;              // 主體：方塊 A / 物件 / 乘客 / 飛船
  b: Body;              // 第二體：方塊 B / 桌布 / 巴士 / 向右的飛船
  c: Body;              // 第三體：向左的飛船（其他情景不用）
  phase: number;        // 情景 2：0 布上滑動、1 隨布走（抽不出）、2 桌上滑行、3 停下；情景 3：0 與地板相對靜止、1 相對滑動
  tRelease: number;     // 情景 1：放手時刻（未放手為 NaN）
  tLeave: number;       // 情景 2：桌布抽出時刻（未抽出為 NaN）
  tStuck: number;       // 情景 2：物件追上布速的時刻（未追上為 NaN）；此後摩擦為零，Δt 凍結於此
  dv: number;           // 情景 2：抽布期間物件獲得的速度 / m s⁻¹
  sLeave: number;       // 情景 2：抽出時物件位置 / m
  hist: Sample[];       // 每 SAMPLE_DT 一個樣本，供線圖與核數
  sinceSample: number;
}

export const L_AB = 0.75;          // 前段光滑桌面長度 / m（2024 卷一乙部 Q3：A 至 B 0.75 m）
export const M_PASSENGER = 60;     // 乘客質量 / kg（規格未列，開發端定）
export const T_CRUISE = 4;         // 巴士巡航時段 / s（規格 §4）
export const T_TABLE = 12;         // 情景 1 時間窗 / s
export const T_SPACE = 12;         // 情景 4 時間窗 / s
export const TRIO_U = 2;           // 情景 4 並排飛船的初速大小 / m s⁻¹
export const FUEL_PER_N = 0.05;    // 燃料消耗率示意：kg s⁻¹ 每 N
export const SAMPLE_DT = 0.02;
const EPS = 1e-12;

// ---- 閉式運動學 ----
const move = (b: Body, a: number, h: number): Body => ({ s: b.s + b.v * h + 0.5 * a * h * h, v: b.v + a * h });
/** v + a t = 0 的正根（沒有則 Infinity） */
const timeToStop = (v: number, a: number) => (v !== 0 && a !== 0 && Math.sign(v) !== Math.sign(a) ? -v / a : Infinity);
/** 由 s 以 v、a 走到 s + d（d > 0）的最短正時間；到不了則 Infinity */
function timeToCover(v: number, a: number, d: number): number {
  if (d <= 0) return 0;
  if (a === 0) return v > 0 ? d / v : Infinity;
  const disc = v * v + 2 * a * d;
  if (disc < 0) return Infinity;
  const r = Math.sqrt(disc);
  const t = (2 * d) / (v + r);          // 數值穩定的最小正根（a > 0 或 v > 0 時）
  if (t > 0 && Number.isFinite(t)) return t;
  const t2 = (-v - r) / a;              // a < 0 且 v ≤ 0：不會前進
  return t2 > 0 ? t2 : Infinity;
}

// ---- 情景 1：方塊 ----
export interface BlockForces { Fapp: number; f: number; Fnet: number; a: number; mu: number }
export const muAt = (s: number, p: P) => (s < L_AB - EPS ? p.mu1 : p.mu2);
/** 方塊在 (s, v) 的受力：施力 Fapp、摩擦 f（含靜摩擦）、淨力與加速度 */
export function blockForces(b: Body, m: number, p: P): BlockForces {
  const Fapp = p.push === "on" ? p.F : 0;
  const mu = muAt(b.s, p);
  const fmax = mu * m * p.g;
  let f: number;
  if (b.v === 0) f = Math.abs(Fapp) <= fmax + EPS ? -Fapp : -fmax * Math.sign(Fapp);
  else f = -fmax * Math.sign(b.v);
  if (f === 0) f = 0;                       // 去掉 −0
  const Fnet = Fapp + f;
  return { Fapp, f, Fnet, a: Fnet / m, mu };
}
function stepBlock(b: Body, m: number, p: P, h: number): Body {
  let rem = h;
  for (let guard = 0; rem > EPS && guard < 32; guard++) {
    const { a } = blockForces(b, m, p);
    let tau = rem, ev: "stop" | "B" | null = null;
    const ts = timeToStop(b.v, a); if (ts < tau) { tau = ts; ev = "stop"; }
    if (b.s < L_AB - EPS && (b.v > 0 || a > 0)) { const tb = timeToCover(b.v, a, L_AB - b.s); if (tb < tau) { tau = tb; ev = "B"; } }
    b = move(b, a, tau);
    if (ev === "stop") b = { s: b.s, v: 0 };
    if (ev === "B") b = { s: L_AB, v: b.v };
    rem -= tau;
  }
  return b;
}

// ---- 情景 2：桌布 ----
/** 桌布尾邊位置 / m（物件起點為 0，尾邊起於 −L，以 vCloth 向右） */
export const clothEdge = (p: P, t: number) => -p.L + p.vCloth * t;
/** 解析解：抽出時刻、Δv 與是否抽不出（規格 §7）。a = μ布 g；v布² ≤ 2aL 時根式無實解 → 抽不出 */
export function clothAnalytic(p: P): { stuck: boolean; tLeave: number; dv: number; tStuck: number } {
  const a = p.muCloth * p.g;
  if (a === 0) return { stuck: false, tLeave: p.L / p.vCloth, dv: 0, tStuck: Infinity };
  const disc = p.vCloth * p.vCloth - 2 * a * p.L;
  if (disc < 0) return { stuck: true, tLeave: NaN, dv: NaN, tStuck: p.vCloth / a };
  const tLeave = (p.vCloth - Math.sqrt(disc)) / a;
  return { stuck: false, tLeave, dv: a * tLeave, tStuck: p.vCloth / a };
}
function stepCloth(st: S, p: P, h: number): S {
  let { a: o, phase, tLeave, dv, sLeave, tStuck } = st; let t = st.t; let rem = h;
  for (let guard = 0; rem > EPS && guard < 32; guard++) {
    let tau = rem;
    if (phase === 0) {
      const acc = p.muCloth * p.g;
      const w = p.vCloth - o.v;                                  // 布相對物件的速度（≥ 0）
      const d = o.s - clothEdge(p, t);                           // 尾邊還差多少才到物件下方
      let ev: "stuck" | "leave" | null = null;
      if (acc > 0 && w > EPS) { const tc = w / acc; if (tc < tau) { tau = tc; ev = "stuck"; } }   // 物件追上布速
      // 相對位移 wτ − ½ acc τ² = d
      let tl = Infinity;
      if (d <= EPS) tl = 0;
      else if (acc === 0) tl = w > 0 ? d / w : Infinity;
      else { const disc = w * w - 2 * acc * d; if (disc >= 0) tl = (2 * d) / (w + Math.sqrt(disc)); }
      if (tl < tau) { tau = tl; ev = "leave"; }
      o = move(o, acc, tau); t += tau; rem -= tau;
      if (ev === "stuck") { o = { s: o.s, v: p.vCloth }; phase = 1; tStuck = t; }
      if (ev === "leave") { phase = 2; tLeave = t; dv = o.v; sLeave = o.s; }
    } else if (phase === 1) {
      o = move(o, 0, tau); t += tau; rem -= tau;
    } else if (phase === 2) {
      const acc = -p.muTable * p.g;
      const ts = timeToStop(o.v, acc); let ev = false;
      if (ts < tau) { tau = ts; ev = true; }
      o = move(o, acc, tau); t += tau; rem -= tau;
      if (ev || o.v <= 0) { o = { s: o.s, v: 0 }; phase = 3; }
    } else { t += tau; rem -= tau; }
  }
  return { ...st, t, a: o, b: { s: clothEdge(p, t), v: p.vCloth }, phase, tLeave, dv, sLeave, tStuck };
}
export function clothForces(st: S, p: P): { f: number; a: number; Fnet: number } {
  const m = p.mObj;
  let f = 0;
  if (st.phase === 0) f = p.muCloth * m * p.g;                  // 布拖物件向前（物件相對布向後滑）
  else if (st.phase === 2) f = -p.muTable * m * p.g;            // 桌面阻物件
  return { f, a: f / m, Fnet: f };
}

// ---- 情景 3：巴士 ----
export interface BusState { s: number; v: number; a: number; phase: number }   // phase 0 起步、1 巡航、2 煞車、3 停
export const busT1 = (p: P) => (p.aBus > 0 ? p.vBus / p.aBus : Infinity);
/** 巴士的解析運動：起步（勻加速 a）→ 巡航 4 s → 急煞（勻減速 a）→ 停 */
export function busAt(p: P, t: number): BusState {
  if (p.aBus <= 0) return { s: 0, v: 0, a: 0, phase: 3 };
  const t1 = busT1(p), t2 = t1 + T_CRUISE, t3 = t2 + t1;
  if (t < t1) return { s: 0.5 * p.aBus * t * t, v: p.aBus * t, a: p.aBus, phase: 0 };
  const s1 = 0.5 * p.aBus * t1 * t1;
  if (t < t2) return { s: s1 + p.vBus * (t - t1), v: p.vBus, a: 0, phase: 1 };
  const s2 = s1 + p.vBus * T_CRUISE;
  if (t < t3) { const tau = t - t2; return { s: s2 + p.vBus * tau - 0.5 * p.aBus * tau * tau, v: p.vBus - p.aBus * tau, a: -p.aBus, phase: 2 }; }
  return { s: s2 + 0.5 * p.vBus * t1, v: 0, a: 0, phase: 3 };
}
/** 乘客在 (v, 相對狀態) 下的加速度與摩擦（老師決定：全部以地面座標系計算，不引入虛擬力） */
export function passengerForces(st: S, p: P): { f: number; Fhand: number; a: number; Fnet: number } {
  const m = M_PASSENGER, bus = busAt(p, st.t), fmax = p.muBus * m * p.g;
  if (p.handrail) { const need = m * bus.a; const f = Math.max(-fmax, Math.min(fmax, need)); return { f, Fhand: need - f, a: bus.a, Fnet: need }; }
  const vRel = st.a.v - bus.v;
  if (st.phase === 0) {                                          // 相對靜止：|a車| ≤ μg 才跟得上
    if (Math.abs(bus.a) <= p.muBus * p.g + EPS) return { f: m * bus.a, Fhand: 0, a: bus.a, Fnet: m * bus.a };
    const f = fmax * Math.sign(bus.a); return { f, Fhand: 0, a: f / m, Fnet: f };
  }
  const f = Math.abs(vRel) > EPS ? -fmax * Math.sign(vRel) : fmax * Math.sign(bus.a);
  return { f, Fhand: 0, a: f / m, Fnet: f };
}
function stepBus(st: S, p: P, h: number): S {
  let pas = st.a, phase = st.phase; let t = st.t; let rem = h;
  const t1 = busT1(p), bounds = Number.isFinite(t1) ? [t1, t1 + T_CRUISE, 2 * t1 + T_CRUISE] : [];
  for (let guard = 0; rem > EPS && guard < 64; guard++) {
    const bus = busAt(p, t);
    let tau = rem;
    for (const tb of bounds) if (tb > t + EPS && tb - t < tau) tau = tb - t;     // 巴士換相
    if (p.handrail) { pas = { s: busAt(p, t + tau).s + (pas.s - bus.s), v: busAt(p, t + tau).v }; t += tau; rem -= tau; phase = 0; continue; }
    const muG = p.muBus * p.g;
    if (phase === 0 && Math.abs(bus.a) > muG + EPS) phase = 1;                     // 地板加速太快，開始滑
    if (phase === 0) { pas = { s: busAt(p, t + tau).s + (pas.s - bus.s), v: busAt(p, t + tau).v }; t += tau; rem -= tau; continue; }
    // 相對滑動：乘客 a = −μg·sgn(v_rel)；相對加速度 (a_p − a_bus) 令 v_rel 過零時停止滑動
    const vRel = pas.v - bus.v;
    if (Math.abs(vRel) <= EPS && Math.abs(bus.a) <= muG + EPS) { phase = 0; pas = { s: pas.s, v: bus.v }; continue; }   // 已同速且地板加速不超限：回到相對靜止
    const aP = Math.abs(vRel) > EPS ? -muG * Math.sign(vRel) : muG * Math.sign(bus.a);
    const aRel = aP - bus.a; let ev = false;
    if (Math.abs(vRel) > EPS && aRel !== 0 && Math.sign(aRel) !== Math.sign(vRel)) { const tz = -vRel / aRel; if (tz < tau) { tau = tz; ev = true; } }
    pas = move(pas, aP, tau); t += tau; rem -= tau;
    if (ev) { pas = { s: pas.s, v: busAt(p, t).v }; if (Math.abs(busAt(p, t).a) <= muG + EPS) phase = 0; }
  }
  const bus = busAt(p, t);
  return { ...st, t, a: pas, b: { s: bus.s, v: bus.v }, phase };
}

// ---- 情景 4：太空 ----
export const shipAccel = (p: P) => (p.engine === "on" ? ((p.dir === "forward" ? 1 : -1) * p.Fe) / p.mShip : 0);

// ---- 時間窗 ----
/** 運行總時長 / s：情景 1、4 固定；情景 2、3 由參數算出（含物件／乘客停下的餘裕），供時間拉桿與凍結 */
export function duration(p: P): number {
  if (p.scene === "table") return T_TABLE;
  if (p.scene === "space") return T_SPACE;
  if (p.scene === "cloth") {
    const c = clothAnalytic(p);
    if (c.stuck) return Math.min(30, Math.max(3, c.tStuck + 4));
    const slide = p.muTable > 0 ? c.dv / (p.muTable * p.g) : 6;
    return Math.min(30, Math.max(3, c.tLeave + Math.min(6, slide) + 1));
  }
  if (p.aBus <= 0) return 8;
  const t3 = 2 * busT1(p) + T_CRUISE;
  const settle = p.handrail ? 1 : Math.min(6, p.muBus > 0 ? p.vBus / (p.muBus * p.g) : 6) + 0.5;
  return Math.min(60, t3 + settle);
}

// ---- 觀察量 ----
const z = (x: number) => (Math.abs(x) < 1e-9 ? 0 : x);
export const sceneCode = (s: SceneId) => ({ table: 1, cloth: 2, bus: 3, space: 4 })[s];

export const model: SimModel<S, P> = {
  init(p) {
    const zero: Body = { s: 0, v: 0 };
    let b: Body = zero, c: Body = zero;
    if (p.scene === "cloth") b = { s: clothEdge(p, 0), v: p.vCloth };
    if (p.scene === "space") { b = { s: 0, v: TRIO_U }; c = { s: 0, v: -TRIO_U }; }
    const st: S = { t: 0, done: false, a: zero, b, c, phase: 0, tRelease: NaN, tLeave: NaN, tStuck: NaN, dv: NaN, sLeave: NaN, hist: [], sinceSample: 0 };
    st.hist = [sample(st, p)];
    return st;
  },

  step(st, p, dt) {
    if (st.done) return st;
    const T = duration(p);
    let h = dt, done = false;
    if (st.t + h >= T - EPS) { h = T - st.t; done = true; }
    let next: S;
    if (p.scene === "table") {
      const a = stepBlock(st.a, p.m, p, h);
      const b = p.second ? stepBlock(st.b, p.mB, p, h) : st.b;
      const tRelease = p.push === "off" && Number.isNaN(st.tRelease) ? st.t : p.push === "on" ? NaN : st.tRelease;
      next = { ...st, t: st.t + h, a, b, tRelease };
    } else if (p.scene === "cloth") next = stepCloth(st, p, h);
    else if (p.scene === "bus") next = stepBus(st, p, h);
    else {
      const acc = shipAccel(p);
      next = { ...st, t: st.t + h, a: move(st.a, acc, h), b: move(st.b, acc, h), c: move(st.c, acc, h) };
    }
    if (done) next.t = T;
    next.done = done;
    next.sinceSample = st.sinceSample + h;
    if (next.sinceSample >= SAMPLE_DT - 1e-9 || done) { next.sinceSample = done ? 0 : next.sinceSample - SAMPLE_DT; next.hist = [...st.hist, sample(next, p)]; }
    return next;
  },

  observe(st, p) {
    const o: Record<string, number> = { scene: sceneCode(p.scene), s: z(st.a.s), v: z(st.a.v), T: duration(p) };
    if (p.scene === "table") {
      const fA = blockForces(st.a, p.m, p);
      o.a = z(fA.a); o.f = z(fA.f); o.Fapp = fA.Fapp; o.Fnet = z(fA.Fnet); o.W = p.m * p.g; o.N = p.m * p.g;
      o.nForces = 2 + (fA.Fapp !== 0 ? 1 : 0) + (fA.f !== 0 ? 1 : 0);
      o.nHoriz = (fA.Fapp !== 0 ? 1 : 0) + (fA.f !== 0 ? 1 : 0);
      if (p.second) { const fB = blockForces(st.b, p.mB, p); o.sB = z(st.b.s); o.vB = z(st.b.v); o.aB = z(fB.a); }
    } else if (p.scene === "cloth") {
      const fo = clothForces(st, p);
      o.a = z(fo.a); o.f = z(fo.f); o.Fnet = z(fo.Fnet); o.W = p.mObj * p.g; o.N = p.mObj * p.g;
      o.nForces = 2 + (fo.f !== 0 ? 1 : 0); o.nHoriz = fo.f !== 0 ? 1 : 0;
      o.vCloth = p.vCloth; o.sCloth = z(st.b.s); o.phase = st.phase;
      const left = st.phase >= 2;
      o.dtPull = left ? st.tLeave : st.phase === 1 ? st.tStuck : st.t;           // 摩擦作用時間 Δt：抽出後凍結於抽出時刻；追上布速後摩擦為零，凍結於追上時刻（核數員第 1 輪 B）
      o.dv = left ? st.dv : st.a.v;                                              // 物件獲得的 Δv
      o.J = p.mObj * o.dv;                                                       // 衝量 J = fΔt = mΔv
      o.slide = left ? z(st.a.s - st.sLeave) : 0;
      o.stuck = st.phase === 1 ? 1 : 0;
    } else if (p.scene === "bus") {
      const bus = busAt(p, st.t); const fp = passengerForces(st, p);
      o.a = z(fp.a); o.f = z(fp.f); o.Fhand = z(fp.Fhand); o.Fnet = z(fp.Fnet); o.W = M_PASSENGER * p.g; o.N = M_PASSENGER * p.g;
      o.nForces = 2 + (fp.f !== 0 ? 1 : 0) + (fp.Fhand !== 0 ? 1 : 0); o.nHoriz = (fp.f !== 0 ? 1 : 0) + (fp.Fhand !== 0 ? 1 : 0);
      o.vBus = z(bus.v); o.aBusNow = bus.a; o.sBus = z(bus.s); o.sRel = z(st.a.s - bus.s); o.busPhase = bus.phase;
      o.sliding = !p.handrail && (st.phase === 1 || Math.abs(bus.a) > p.muBus * p.g + EPS) ? 1 : 0;   // 滑動開始的一瞬（a 已 = μg）亦報 1（第二實作者第 1 輪）
    } else {
      const acc = shipAccel(p); const Fe = p.engine === "on" ? p.Fe : 0;
      o.a = z(acc); o.Fe = Fe * (p.dir === "forward" ? 1 : -1); o.Fnet = o.Fe; o.W = 0; o.N = 0;
      o.nForces = Fe !== 0 ? 1 : 0; o.nHoriz = o.nForces;
      o.fuel = FUEL_PER_N * Fe; o.engineOn = p.engine === "on" ? 1 : 0;
      if (p.trio) { o.sB = z(st.b.s); o.vB = z(st.b.v); o.sC = z(st.c.s); o.vC = z(st.c.v); }
    }
    return o;
  },

  done: st => st.done,

  events(prev, next, p) {
    const ev: SimEvent[] = [];
    if (p.scene === "table") {
      if (Number.isNaN(prev.tRelease) && !Number.isNaN(next.tRelease)) ev.push({ key: "release", t: next.tRelease, label: { zh: "放手", en: "Released" } });
      if (prev.a.s < L_AB - EPS && next.a.s >= L_AB - EPS) ev.push({ key: "B", t: next.t, label: { zh: "到達 B（粗糙段）", en: "Reached B (rough section)" } });
      if (prev.a.v > 0 && next.a.v === 0) ev.push({ key: "stop", t: next.t, label: { zh: "停下", en: "Stopped" } });
    } else if (p.scene === "cloth") {
      if (prev.phase < 2 && next.phase >= 2) ev.push({ key: "leave", t: next.tLeave, label: { zh: "桌布抽出", en: "Cloth pulled out" } });
      if (prev.phase === 0 && next.phase === 1) ev.push({ key: "stuck", t: next.t, label: { zh: "物件隨布走：桌布抽不出", en: "Object moves with the cloth: it cannot be pulled out" } });
      if (prev.phase === 2 && next.phase === 3) ev.push({ key: "stop", t: next.t, label: { zh: "停下", en: "Stopped" } });
    } else if (p.scene === "bus") {
      const b0 = busAt(p, prev.t).phase, b1 = busAt(p, next.t).phase;
      if (b0 === 0 && b1 >= 1) ev.push({ key: "cruise", t: next.t, label: { zh: "巡航", en: "Cruising" } });
      if (b0 <= 1 && b1 >= 2) ev.push({ key: "brake", t: next.t, label: { zh: "急煞", en: "Braking" } });
      if (b0 <= 2 && b1 === 3) ev.push({ key: "busStop", t: next.t, label: { zh: "巴士停下", en: "Bus stopped" } });
      if (prev.phase === 0 && next.phase === 1) ev.push({ key: "slide", t: next.t, label: { zh: "乘客相對地板滑動", en: "Passenger slides on the floor" } });
    }
    if (!prev.done && next.done) ev.push({ key: "end", t: next.t, label: { zh: "到達時間窗末端", en: "End of time window" } });
    return ev;
  },
};

function sample(st: S, p: P): Sample {
  const o = model.observe(st, p);
  return { t: st.t, s: st.a.s, v: st.a.v, a: o.a, s2: st.b.s, v2: st.b.v, s3: st.c.s, v3: st.c.v };
}
