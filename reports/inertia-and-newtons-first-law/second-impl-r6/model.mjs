// 第二實作：慣性與牛頓運動第一定律（#024，S15）
// 依規格 reference/13_024_慣性與牛頓運動第一定律_模擬器規格.md v0.3 §4、§5、§7、§10、§11 獨立寫成。
// 純 JavaScript（ESM），刻意不看 src/sims/inertia-and-newtons-first-law/model.ts。
//
// 積分方法：事件分段解析積分（event-split closed-form integration）。
//   所有情景的加速度都是分段常數，故每一步 [t, t+dt] 內先找出最早的事件
//   （v 過零、越過 B、桌布抽出／追上布、巴士換相、乘客相對速度過零），
//   用 s = s + vτ + ½aτ²、v = v + aτ 精確推進到事件時刻，改變模式後再推進餘下時間。
//   不用 Euler／RK，因此除浮點捨入外沒有截斷誤差；事件時刻亦是精確解。
//
// 規格外常數（主實作 manifest.beyondSpec 提到，這裏按同一數值採用，方便比對）：
//   LAB = 0.75 m（情景 1 光滑段 A→B 長度）、M_PASS = 60 kg（乘客）、CRUISE = 4 s（規格 §4 已有）。
//   時間窗 T：情景 1、4 固定 12 s；情景 2 抽得出 3 s、抽不出 t追上 + 4 s；情景 3 由參數推得（見 busWindow）。
//
// 第 2 輪改動（2026-09-07，對照主實作 0.2.0；物理方程不變，只改離散旗標、時間窗與參數切換）：
//   - stuck：只在 phase = 1（物件已追上布速）時為 1。第 1 輪自 t = 0 起按 v布² ≤ 2aL 報 1；主實作按事件置 1，改為一致以便逐幀比對。
//   - sliding：v_rel ≠ 0，或（不握扶手且）相對靜止但 |a車| > μg 的一瞬（該瞬 a乘 已 = μg）亦報 1。
//   - 時間窗：情景 2 抽不出時 T = t追上 + 4（由 extra-cloth-stuck 的 T = 4.6796 反推）；情景 3 握扶手時 T = t₃ + 1.0
//     （由 extra-bus-handrail 的 T = 11.6667 反推；相當於 busWindow 的滑行項取 0.5）。兩者規格皆未定。
//   - run() 支援 change = {t, params}：st.t ≥ change.t（容差 1e-9）的幀起，observe 與 step 都改用新參數，之後保持。

export const LAB = 0.75;
export const M_PASS = 60;
export const CRUISE = 4;
export const T_TABLE = 12;
export const T_SPACE = 12;
export const T_CLOTH = 3;

const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
// 事件容差：事件時刻落在步末 1e-9 倍步長之內即算本步命中（免得最後一位捨入決定事件幀）
const hits = (tau, rem) => tau <= rem * (1 + 1e-9);

// 解 s0 + v τ + ½ a τ² = X 的最小 τ ≥ 0；到不了回傳 null。用 2Δ/(v+√disc) 避免相消。
function timeToReach(s0, v, a, X) {
  const d = X - s0;
  if (d <= 0) return 0;
  if (a === 0) return v > 0 ? d / v : null;
  const disc = v * v + 2 * a * d;
  if (disc < 0) return null;
  const r = Math.sqrt(disc);
  const den = v + r;
  if (den <= 0) return null;
  return (2 * d) / den;
}

// ---------- 情景 1：桌面上的方塊 ----------
function blockForces(b, p, mass) {
  const mu = b.rough ? p.mu2 : p.mu1;
  const Fapp = p.push === "on" ? p.F : 0;
  const fmax = mu * mass * p.g;
  if (b.v > 0 || Fapp > fmax) {
    // 相對滑動（或即將滑動）：f = −μmg
    return { a: (Fapp - fmax) / mass, f: -fmax, Fapp };
  }
  // 靜止且 F ≤ μmg：f = −F，不動（規格 §7 情景 1）
  return { a: 0, f: -Fapp, Fapp };
}

function advanceBlock(b, p, mass, h) {
  let rem = h;
  for (let guard = 0; rem > 0 && guard < 8; guard++) {
    const { a } = blockForces(b, p, mass);
    if (b.v === 0 && a === 0) return;
    let tau = rem, ev = null;
    if (a < 0) {
      const tz = -b.v / a;
      if (hits(tz, tau)) { tau = Math.min(tz, tau); ev = "stop"; }
    }
    if (!b.rough) {
      const tb = timeToReach(b.s, b.v, a, LAB);
      if (tb !== null && hits(tb, tau)) { tau = Math.min(tb, tau); ev = "B"; }
    }
    b.s += b.v * tau + 0.5 * a * tau * tau;
    b.v += a * tau;
    rem -= tau;
    if (ev === "stop") b.v = 0;
    if (ev === "B") { b.s = LAB; b.rough = true; }
  }
}

// ---------- 情景 2：桌布 ----------
function clothSetup(p) {
  const a0 = p.muCloth * p.g;
  const vc = p.vCloth, L = p.L;
  // 規格 §7 臨界條件：v布² ≤ 2aL → 物件在抽出前已達布速，桌布抽不出
  const stuck = a0 > 0 && vc * vc <= 2 * a0 * L;   // 由參數即可預測；但 observe 的 stuck 旗標只在追上後才報 1
  let tLeave = null, tStick = null;
  if (stuck) tStick = vc / a0;
  else tLeave = a0 === 0 ? L / vc : (vc - Math.sqrt(vc * vc - 2 * a0 * L)) / a0;
  return { a0, stuck, tLeave, tStick };
}

function advanceCloth(st, p, h) {
  const { a0, stuck } = st.cfg;
  const vc = p.vCloth, L = p.L;
  let rem = h;
  for (let guard = 0; rem > 0 && guard < 8; guard++) {
    if (st.phase === 0) {
      let tau;
      if (stuck) {
        tau = (vc - st.v) / a0;                       // 物件達布速
      } else {
        const g0 = (-L + vc * st.t) - st.s;           // 布尾邊相對物件的位置（負 = 仍在物件下）
        const vrel = vc - st.v;
        if (a0 === 0) tau = -g0 / vrel;
        else {
          const disc = Math.max(0, vrel * vrel + 2 * a0 * g0);
          tau = (2 * -g0) / (vrel + Math.sqrt(disc)); // 布尾邊追到物件
        }
      }
      if (hits(tau, rem)) { tau = Math.min(tau, rem);
        st.s += st.v * tau + 0.5 * a0 * tau * tau;
        st.v += a0 * tau;
        st.t += tau; rem -= tau;
        st.tPull = st.t;
        if (stuck) { st.v = vc; st.phase = 1; st.dv = vc; }
        else { st.phase = 2; st.dv = st.v; st.sLeave = st.s; }
      } else {
        st.s += st.v * rem + 0.5 * a0 * rem * rem;
        st.v += a0 * rem;
        st.t += rem; rem = 0;
      }
    } else if (st.phase === 1) {
      st.s += vc * rem; st.t += rem; rem = 0;
    } else if (st.phase === 2) {
      const ad = p.muTable * p.g;
      if (ad === 0) { st.s += st.v * rem; st.t += rem; rem = 0; continue; }
      let tz = st.v / ad;
      if (hits(tz, rem)) { tz = Math.min(tz, rem);
        st.s += st.v * tz - 0.5 * ad * tz * tz;
        st.v = 0; st.t += tz; rem -= tz; st.phase = 3;
      } else {
        st.s += st.v * rem - 0.5 * ad * rem * rem;
        st.v -= ad * rem; st.t += rem; rem = 0;
      }
    } else { st.t += rem; rem = 0; }
  }
}

// ---------- 情景 3：巴士 ----------
function busSetup(p) {
  const a = p.aBus, v = p.vBus;
  if (a <= 0) return { t1: Infinity, t2: Infinity, t3: Infinity, S1: 0, S3: 0 };
  const t1 = v / a;
  return { t1, t2: t1 + CRUISE, t3: 2 * t1 + CRUISE, S1: 0.5 * a * t1 * t1, S3: a * t1 * t1 + v * CRUISE };
}

// 巴士在時刻 t 的相位、加速度、速度、位移（閉式）
function busAt(t, p, cfg) {
  const a = p.aBus, v = p.vBus;
  if (a <= 0) return { phase: 0, aBus: 0, vBus: 0, sBus: 0, tEnd: Infinity };
  if (t < cfg.t1) return { phase: 0, aBus: a, vBus: a * t, sBus: 0.5 * a * t * t, tEnd: cfg.t1 };
  if (t < cfg.t2) return { phase: 1, aBus: 0, vBus: v, sBus: cfg.S1 + v * (t - cfg.t1), tEnd: cfg.t2 };
  if (t < cfg.t3) {
    const u = t - cfg.t2;
    return { phase: 2, aBus: -a, vBus: v - a * u, sBus: cfg.S1 + v * CRUISE + v * u - 0.5 * a * u * u, tEnd: cfg.t3 };
  }
  return { phase: 3, aBus: 0, vBus: 0, sBus: cfg.S3, tEnd: Infinity };
}

// 乘客加速度（規格 §7 情景 3）。locked = 與地板相對靜止且維持得住。
function passengerAccel(st, p, bus) {
  const muG = p.muBus * p.g;
  if (p.handrail) return { aP: bus.aBus, locked: true };
  const vrel = st.v - bus.vBus;
  if (vrel === 0) {
    if (Math.abs(bus.aBus) <= muG) return { aP: bus.aBus, locked: true };
    return { aP: sgn(bus.aBus) * muG, locked: false };
  }
  return { aP: -sgn(vrel) * muG, locked: false };
}

function advanceBus(st, p, h) {
  let rem = h;
  for (let guard = 0; rem > 0 && guard < 12; guard++) {
    const bus = busAt(st.t, p, st.cfg);
    let tau = Math.min(rem, bus.tEnd - st.t);
    const { aP, locked } = passengerAccel(st, p, bus);
    if (locked) {
      // 鎖定：乘客與地板一起走，相對位移不變（避免各自積分的捨入漂移令 vrel ≠ 0）
      const sRel = st.s - bus.sBus;
      st.t += tau; rem -= tau;
      const b2 = busAt(st.t, p, st.cfg);
      st.s = b2.sBus + sRel; st.v = b2.vBus;
      continue;
    }
    const vrel = st.v - bus.vBus;
    const aRel = aP - bus.aBus;
    let ev = false;
    if (vrel !== 0 && aRel !== 0 && sgn(aRel) === -sgn(vrel)) {
      const tz = -vrel / aRel;
      if (hits(tz, tau)) { tau = Math.min(tz, tau); ev = true; }
    }
    st.s += st.v * tau + 0.5 * aP * tau * tau;
    st.v += aP * tau;
    st.t += tau; rem -= tau;
    if (ev) st.v = busAt(st.t, p, st.cfg).vBus;   // 相對速度精確歸零
  }
}

function busWindow(p, cfg) {
  // 推得的顯示時間窗：巴士停定後再看乘客滑行（上限 6 s）加 0.5 s 緩衝；握扶手時滑行項取 0.5（即 T = t₃ + 1）
  if (p.aBus <= 0) return 12;
  const muG = p.muBus * p.g;
  const slide = p.handrail ? 0.5 : muG > 0 ? Math.min(p.vBus / muG, 6) : 6;
  return cfg.t3 + 0.5 + slide;
}

// ---------- 情景 4：太空 ----------
function thrust(p) {
  if (p.engine !== "on") return 0;
  return (p.dir === "backward" ? -1 : 1) * p.Fe;
}

// ---------- 公用介面 ----------
export function init(p) {
  const st = { t: 0, scene: p.scene, done: false };
  if (p.scene === "table") {
    st.A = { s: 0, v: 0, rough: LAB <= 0 };
    if (p.second) st.B = { s: 0, v: 0, rough: LAB <= 0 };
    st.T = T_TABLE;
  } else if (p.scene === "cloth") {
    st.cfg = clothSetup(p);
    Object.assign(st, { s: 0, v: 0, phase: 0, tPull: 0, dv: 0, sLeave: 0 });
    st.T = st.cfg.stuck ? st.cfg.tStick + 4 : T_CLOTH;
  } else if (p.scene === "bus") {
    st.cfg = busSetup(p);
    Object.assign(st, { s: 0, v: 0 });
    st.T = busWindow(p, st.cfg);
  } else {
    st.ships = [{ s: 0, v: 0 }, { s: 0, v: 2 }, { s: 0, v: -2 }];
    st.T = T_SPACE;
  }
  return st;
}

export function step(st, p, dt) {
  if (st.done) return st;
  let h = dt;
  if (st.t + h >= st.T) { h = st.T - st.t; st.done = true; }
  if (h <= 0) { st.t = st.T; return st; }
  if (p.scene === "table") {
    advanceBlock(st.A, p, p.m, h);
    if (st.B) advanceBlock(st.B, p, p.mB, h);
    st.t += h;
  } else if (p.scene === "cloth") {
    advanceCloth(st, p, h);           // 內部自行推進 st.t
  } else if (p.scene === "bus") {
    advanceBus(st, p, h);             // 內部自行推進 st.t
  } else {
    const a = thrust(p) / p.mShip;
    for (const sh of st.ships) { sh.s += sh.v * h + 0.5 * a * h * h; sh.v += a * h; }
    st.t += h;
  }
  if (st.done) st.t = st.T;
  return st;
}

export function observe(st, p) {
  const t = st.t;
  if (p.scene === "table") {
    const A = st.A, fa = blockForces(A, p, p.m);
    const W = p.m * p.g;
    const Fnet = fa.Fapp + fa.f;
    const nH = (fa.Fapp > 0 ? 1 : 0) + (fa.f !== 0 ? 1 : 0);
    const o = { scene: 1, s: A.s, v: A.v, T: st.T, a: fa.a, f: fa.f, Fapp: fa.Fapp, Fnet, W, N: W, nForces: 2 + nH, nHoriz: nH };
    if (st.B) { const fb = blockForces(st.B, p, p.mB); Object.assign(o, { sB: st.B.s, vB: st.B.v, aB: fb.a }); }
    return o;
  }
  if (p.scene === "cloth") {
    const m = p.mObj ?? 1;
    const W = m * p.g;
    let a = 0, f = 0;
    if (st.phase === 0) { a = st.cfg.a0; f = m * a; }
    else if (st.phase === 2) { a = -p.muTable * p.g; f = m * a; }
    const dtPull = st.phase === 0 ? t : st.tPull;
    const dv = st.phase === 0 ? st.v : st.dv;
    const nH = f !== 0 ? 1 : 0;
    return {
      scene: 2, s: st.s, v: st.v, T: st.T, a, f, Fnet: f, W, N: W, nForces: 2 + nH, nHoriz: nH,
      vCloth: p.vCloth, sCloth: -p.L + p.vCloth * t, phase: st.phase, dtPull, dv, J: m * dv,
      slide: st.phase >= 2 ? st.s - st.sLeave : 0, stuck: st.phase === 1 ? 1 : 0,
    };
  }
  if (p.scene === "bus") {
    const bus = busAt(t, p, st.cfg);
    const { aP } = passengerAccel(st, p, bus);
    const m = M_PASS, W = m * p.g, muG = p.muBus * p.g;
    let f, Fhand = 0;
    if (p.handrail) { f = clamp(m * bus.aBus, -p.muBus * W, p.muBus * W); Fhand = m * bus.aBus - f; }
    else f = m * aP;
    const nH = (f !== 0 ? 1 : 0) + (Fhand !== 0 ? 1 : 0);
    return {
      scene: 3, s: st.s, v: st.v, T: st.T, a: aP, f, Fhand, Fnet: f + Fhand, W, N: W, nForces: 2 + nH, nHoriz: nH,
      vBus: bus.vBus, aBusNow: bus.aBus, sBus: bus.sBus, sRel: st.s - bus.sBus, busPhase: bus.phase,
      sliding: st.v !== bus.vBus || (!p.handrail && Math.abs(bus.aBus) > muG) ? 1 : 0,
    };
  }
  const Fe = thrust(p), on = p.engine === "on";
  const [A, B, C] = st.ships;
  const nH = Fe !== 0 ? 1 : 0;
  const o = { scene: 4, s: A.s, v: A.v, T: st.T, a: Fe / p.mShip, Fe, Fnet: Fe, W: 0, N: 0, nForces: nH, nHoriz: nH, fuel: on ? 0.05 * Math.abs(Fe) : 0, engineOn: on ? 1 : 0 };
  if (p.trio) Object.assign(o, { sB: B.s, vB: B.v, sC: C.s, vC: C.v });
  return o;
}

// change = {t, params}：由 t 起把 params 換成該值（放手／關引擎），之後保持。
export function run(p0, frames, dt, change = null) {
  let st = init(p0);
  const out = [];
  const pChanged = change ? { ...p0, ...change.params } : null;
  for (let i = 0; i < frames; i++) {
    const p = change && st.t >= change.t - 1e-9 ? pChanged : p0;
    out.push({ t: st.t, obs: observe(st, p) });
    st = step(st, p, dt);
  }
  return out;
}
