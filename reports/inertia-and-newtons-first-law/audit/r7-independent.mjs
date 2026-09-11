// 第 7 輪獨立核數（v0.4 規格：摩擦力 f 取代 μ）。不讀 model.ts / plan.ts / Scene.tsx。
// 按規格 §7 方程以解析解（分段常加速度、事件驅動：越過 B、停止、追上布速、布邊離開、巴士相位、乘客與車同速）逐幀重算，
// 與 data/ 25 個運行、audit/r7-data/ 104 個運行的 observe 與 plan 箭嘴比對；並逐條計算 §10 條件 1–17。
// 用法：node reports/inertia-and-newtons-first-law/audit/r7-independent.mjs
import fs from "node:fs";
import path from "node:path";
const ROOT = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law";
const REL = 1e-9, ABS = 1e-9;          // 解析解對數值：規格條件用 1e-9；一般以 rel 1e-9 或 abs 1e-9 通過
const log = [];
const say = (...a) => { const s = a.join(" "); log.push(s); console.log(s); };

function loadDir(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith(".json") && !f.startsWith("index") && !f.endsWith("results.json"))
    .map(f => ({ file: path.join(dir, f), ...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }));
}
const runs = [...loadDir(path.join(ROOT, "data")).map(r => ({ ...r, set: "data" })), ...loadDir(path.join(ROOT, "audit/r7-data")).map(r => ({ ...r, set: "r7" }))];

// ---------- 小工具 ----------
const sgn = x => (x > 0 ? 1 : x < 0 ? -1 : 0);
function smallestPositiveRoot(A, B, C) {         // A τ² + B τ + C = 0，最小的 τ ≥ 0（容許 -1e-15）
  const eps = 1e-15;
  if (Math.abs(A) < 1e-300) { if (Math.abs(B) < 1e-300) return null; const t = -C / B; return t >= -eps ? Math.max(t, 0) : null; }
  const D = B * B - 4 * A * C; if (D < 0) return null; const q = Math.sqrt(D);
  const r = [(-B - q) / (2 * A), (-B + q) / (2 * A)].filter(t => t >= -eps).map(t => Math.max(t, 0)).sort((a, b) => a - b);
  return r.length ? r[0] : null;
}
class Err { constructor() { this.max = 0; this.t = null; this.n = 0; this.ties = 0; } add(e, t) { this.n++; if (e > this.max) { this.max = e; this.t = t; } } }
function cmp(errs, key, exp, got, t, tie) {
  if (got === undefined) { (errs["_missing:" + key] ??= new Err()).add(1, t); return; }
  const e = Math.abs(exp - got) / Math.max(1, Math.abs(exp));
  const E = errs[key] ??= new Err();
  if (tie) { if (e > 1e-9) E.ties++; return; }     // 事件恰落在幀格（平手幀）另計
  E.add(e, t);
}

// ---------- 情景 1：桌面 ----------
function tableRegime(st, lane, Fapp) {
  const f = st.s >= lane.LAB ? lane.f2 : lane.f1;
  let fric, a;
  if (st.v !== 0) { fric = -f * sgn(st.v); a = (Fapp + fric) / lane.m; }
  else if (Math.abs(Fapp) <= f) { fric = -Fapp; a = 0; }
  else { fric = -f * sgn(Fapp); a = (Fapp + fric) / lane.m; }
  return { fric, a, f };
}
function tableAdvance(st, lane, Fapp, dt) {
  let rem = dt, guard = 0;
  while (rem > 0 && guard++ < 50) {
    const { fric, a } = tableRegime(st, lane, Fapp);
    if (a === 0 && st.v === 0) { st.t += rem; break; }
    let tau = rem, ev = null;
    if (st.v !== 0 && a * st.v < 0) { const ts = -st.v / a; if (ts < tau) { tau = ts; ev = "stop"; } }
    if (st.s < lane.LAB && (st.v > 0 || a > 0)) { const tb = smallestPositiveRoot(a / 2, st.v, st.s - lane.LAB); if (tb !== null && tb < tau) { tau = tb; ev = "bound"; } }
    const ds = st.v * tau + 0.5 * a * tau * tau;
    st.s += ds; st.v += a * tau; st.work += (Fapp + fric) * ds; st.t += tau; rem -= tau;
    if (ev === "stop") st.v = 0;
    if (ev === "bound") st.s = lane.LAB;
  }
}
function checkTable(run, errs, extra) {
  const fr = run.frames, LAB = fr[0].meta.LAB, g = run.params.g;
  const lanes = [{ m: run.params.m, f1: run.params.f1, f2: run.params.f2, LAB, st: { s: 0, v: 0, t: 0, work: 0 } }];
  if (run.params.second) lanes.push({ m: run.params.mB, f1: run.params.f1, f2: run.params.f2, LAB, st: { s: 0, v: 0, t: 0, work: 0 } });
  let prevT = 0, prevP = null;
  const KE0 = 0;
  for (let i = 0; i < fr.length; i++) {
    const F = fr[i], t = F.t;
    const p = run.change && t >= run.change.t - 1e-12 ? { ...run.params, ...run.change.params } : run.params;
    if (i > 0) { const dt = t - prevT; if (dt > 0) for (const L of lanes) tableAdvance(L.st, L, prevP.push === "on" ? prevP.F : 0, dt); }
    prevT = t; prevP = p;
    const Fapp = p.push === "on" ? p.F : 0;
    const o = F.obs;
    const tie = Math.abs(lanes[0].st.s - LAB) < 1e-9 || (lanes[1] && Math.abs(lanes[1].st.s - LAB) < 1e-9);
    const A = lanes[0], rA = tableRegime(A.st, A, Fapp);
    cmp(errs, "s", A.st.s, o.s, t, tie); cmp(errs, "v", A.st.v, o.v, t, tie); cmp(errs, "a", rA.a, o.a, t, tie);
    cmp(errs, "f", rA.fric, o.f, t, tie); cmp(errs, "Fapp", Fapp, o.Fapp, t); cmp(errs, "Fnet", Fapp + rA.fric, o.Fnet, t, tie);
    cmp(errs, "W", A.m * g, o.W, t); cmp(errs, "N", A.m * g, o.N, t);
    cmp(errs, "nForces", 2 + (Fapp !== 0) + (rA.fric !== 0), o.nForces, t, tie); cmp(errs, "nHoriz", (Fapp !== 0) + (rA.fric !== 0), o.nHoriz, t, tie);
    // 能量：ΔKE = 各水平力所作的功（我的精確分段積分）
    const KE = 0.5 * A.m * o.v * o.v; cmp(errs, "energy", A.st.work, KE - KE0, t, tie);
    if (lanes[1]) {
      const B = lanes[1], rB = tableRegime(B.st, B, Fapp);
      cmp(errs, "sB", B.st.s, o.sB, t, tie); cmp(errs, "vB", B.st.v, o.vB, t, tie); cmp(errs, "aB", rB.a, o.aB, t, tie);
      cmp(errs, "energyB", B.st.work, 0.5 * B.m * o.vB * o.vB, t, tie);
    }
    // 箭嘴
    checkArrows(F, errs, [
      { z: 0, W: A.m * g, N: A.m * g, fric: o.f, app: Fapp, net: o.Fnet, v: o.v, a: o.a, vrel: o.v, tendency: -Fapp },
      ...(lanes[1] ? [{ z: 1, W: lanes[1].m * g, N: lanes[1].m * g, fric: 0, app: Fapp, net: Fapp, v: o.vB, a: o.aB, vrel: o.vB, tendency: -Fapp }] : []),
    ], t);
    extra.push({ t, o, p, exp: { s: A.st.s, v: A.st.v, a: rA.a, f: rA.fric }, tie });
  }
}

// ---------- 情景 2：桌布 ----------
function clothInit(p) { return { s: 0, v: 0, t: 0, phase: 0, dtPull: 0, dv: 0, J: 0, sLeave: 0, stuck: 0, work: 0 }; }
function clothRegime(st, p) {
  const m = p.mObj;
  if (st.phase === 0) return { fric: p.fCloth, a: p.fCloth / m };
  if (st.phase === 1) return { fric: 0, a: 0 };
  if (st.phase === 2) return { fric: -p.fTable * sgn(st.v), a: -p.fTable * sgn(st.v) / m };
  return { fric: 0, a: 0 };
}
function clothAdvance(st, p, dt) {
  const m = p.mObj; let rem = dt, guard = 0;
  while (rem > 0 && guard++ < 50) {
    const { fric, a } = clothRegime(st, p);
    let tau = rem, ev = null;
    if (st.phase === 0) {
      const sCloth = p.vCloth * st.t - p.L;                       // 布邊位置
      if (a > 0) { const t1 = (p.vCloth - st.v) / a; if (t1 <= tau) { tau = t1; ev = "stuck"; } }
      const t2 = smallestPositiveRoot(a / 2, st.v - p.vCloth, st.s - sCloth);
      if (t2 !== null && t2 < tau) { tau = t2; ev = "leave"; }
      else if (t2 !== null && ev === "stuck" && Math.abs(t2 - tau) < 1e-15) ev = "stuck";   // 同時：規格 ≤ → 卡住
    } else if (st.phase === 2 && a !== 0) { const ts = -st.v / a; if (ts < tau) { tau = ts; ev = "stop"; } }
    const ds = st.v * tau + 0.5 * a * tau * tau;
    st.s += ds; st.v += a * tau; st.work += fric * ds; st.t += tau; rem -= tau;
    if (ev === "stuck") { st.v = p.vCloth; st.phase = 1; st.stuck = 1; st.dtPull = st.t; st.dv = p.vCloth; st.J = m * p.vCloth; }
    if (ev === "leave") { st.phase = 2; st.dtPull = st.t; st.dv = st.v; st.J = p.fCloth * st.t; st.sLeave = st.s; if (st.v === 0) st.phase = 3; }
    if (ev === "stop") { st.v = 0; st.phase = 3; }
  }
}
function checkCloth(run, errs, extra) {
  const fr = run.frames, p = run.params, m = p.mObj, g = p.g;
  const st = clothInit(p); let prevT = 0;
  for (let i = 0; i < fr.length; i++) {
    const F = fr[i], t = F.t, o = F.obs;
    if (i > 0) { const dt = t - prevT; if (dt > 0) clothAdvance(st, p, dt); }
    prevT = t;
    const r = clothRegime(st, p);
    const dtPull = st.phase === 0 ? t : st.dtPull, dv = st.phase === 0 ? st.v : st.dv, J = st.phase === 0 ? p.fCloth * t : st.J;
    const slide = st.phase >= 2 ? st.s - st.sLeave : 0;
    cmp(errs, "s", st.s, o.s, t); cmp(errs, "v", st.v, o.v, t); cmp(errs, "a", r.a, o.a, t); cmp(errs, "f", r.fric, o.f, t);
    cmp(errs, "Fnet", r.fric, o.Fnet, t); cmp(errs, "W", m * g, o.W, t); cmp(errs, "N", m * g, o.N, t);
    cmp(errs, "nForces", 2 + (r.fric !== 0), o.nForces, t); cmp(errs, "nHoriz", (r.fric !== 0), o.nHoriz, t);
    cmp(errs, "vCloth", p.vCloth, o.vCloth, t); cmp(errs, "sCloth", p.vCloth * t - p.L, o.sCloth, t);
    cmp(errs, "phase", st.phase, o.phase, t); cmp(errs, "stuck", st.stuck, o.stuck, t);
    cmp(errs, "dtPull", dtPull, o.dtPull, t); cmp(errs, "dv", dv, o.dv, t); cmp(errs, "J", J, o.J, t); cmp(errs, "slide", slide, o.slide, t);
    cmp(errs, "energy", st.work, 0.5 * m * o.v * o.v, t);
    const vSurf = o.phase <= 1 ? p.vCloth : 0;
    checkArrows(F, errs, [{ z: 0, W: m * g, N: m * g, fric: o.f, app: 0, net: o.Fnet, v: o.v, a: o.a, vrel: o.v - vSurf, tendency: st.phase === 0 ? +1 : 0 }], t);
    extra.push({ t, o, exp: { s: st.s, v: st.v, a: r.a, dtPull, dv, J, phase: st.phase, stuck: st.stuck } });
  }
}

// ---------- 情景 3：巴士 ----------
function busKin(p, t) {
  const a = p.aBus, V = p.vBus;
  if (a === 0) return { v: 0, s: 0, a: 0, phase: 0 };
  const t1 = V / a, t2 = t1 + 4, t3 = t2 + t1;
  if (t < t1) return { v: a * t, s: 0.5 * a * t * t, a, phase: 0 };
  if (t < t2) return { v: V, s: 0.5 * a * t1 * t1 + V * (t - t1), a: 0, phase: 1 };
  if (t < t3) { const u = t - t2; return { v: V - a * u, s: 0.5 * a * t1 * t1 + 4 * V + V * u - 0.5 * a * u * u, a: -a, phase: 2 }; }
  return { v: 0, s: a * t1 * t1 + 4 * V, a: 0, phase: 3 };
}
function busEvents(p) { const a = p.aBus, V = p.vBus; if (a === 0) return []; const t1 = V / a; return [t1, t1 + 4, 2 * t1 + 4]; }
function paxRegime(st, p, bus, m) {       // 不握扶手
  const fmax = p.fBus;
  if (!st.sliding) return { fric: m * bus.a, a: bus.a };
  const vrel = st.v - bus.v;
  if (vrel !== 0) { const fric = -fmax * sgn(vrel); return { fric, a: fric / m }; }
  const fric = fmax * sgn(bus.a); return { fric, a: fric / m };      // 剛開始滑：趨勢與車加速度相反
}
function paxAdvance(st, p, m, t0, dt) {
  let t = t0, rem = dt, guard = 0; const evs = busEvents(p);
  while (rem > 1e-15 && guard++ < 100) {
    const bus = busKin(p, t);
    if (!st.sliding && Math.abs(bus.a) > p.fBus / m + 1e-15) st.sliding = true;
    const r = paxRegime(st, p, bus, m);
    let tau = rem, ev = null;
    for (const te of evs) { const d = te - t; if (d > 0 && d < tau) { tau = d; ev = "phase"; } }
    if (st.sliding) { const ra = r.a - bus.a, rv = st.v - bus.v; if (ra !== 0) { const te = -rv / ra; if (te > 1e-15 && te < tau) { tau = te; ev = "equal"; } else if (rv === 0 && ra === 0) { /* 同步 */ } } }
    if (!st.sliding) { const b0 = busKin(p, t), b1 = busKin(p, t + tau); st.work += 0.5 * m * (b1.v * b1.v - st.v * st.v); st.s += b1.s - b0.s; st.v = b1.v; t += tau; rem -= tau; }
    else { const ds = st.v * tau + 0.5 * r.a * tau * tau; st.s += ds; st.v += r.a * tau; st.work += r.fric * ds; t += tau; rem -= tau; }
    for (const te of evs) if (Math.abs(t - te) < 1e-12) t = te;
    if (ev === "equal") { const b2 = busKin(p, t); st.v = b2.v; if (Math.abs(b2.a) <= p.fBus / m + 1e-15) st.sliding = false; }
    if (ev === "phase") { const b2 = busKin(p, t + 1e-12); if (!st.sliding && Math.abs(b2.a) > p.fBus / m + 1e-15) st.sliding = true; }
  }
}
function checkBus(run, errs, extra) {
  const fr = run.frames, p = run.params, g = p.g, m = fr[0].obs.W / g;   // 乘客質量由 W 反推（規格 §5 註：f/m = 120/60 → 60 kg）
  (errs["m_passenger"] ??= new Err()).add(Math.abs(m - 60) / 60, 0);
  const st = { s: 0, v: 0, sliding: false, work: 0 }; let prevT = 0;
  const evs = busEvents(p);
  for (let i = 0; i < fr.length; i++) {
    const F = fr[i], t = F.t, o = F.obs;
    if (i > 0) { const dt = t - prevT; if (dt > 0) { if (p.handrail) { /* 鎖定 */ } else paxAdvance(st, p, m, prevT, dt); } }
    prevT = t;
    const bus = busKin(p, t);
    const tie = evs.some(te => Math.abs(te - t) < 1e-9) || (!p.handrail && st.sliding && Math.abs(st.v - bus.v) < 1e-9) || (!p.handrail && Math.abs(st.v) < 1e-9 && bus.v === 0 && bus.phase === 3);
    let exp;
    if (p.handrail) {
      const fric = bus.a !== 0 ? p.fBus * sgn(bus.a) : 0;           // 規格 §7：扶手力 = m a車 − f（f 取設定值、方向同 a）
      exp = { s: bus.s, v: bus.v, a: bus.a, f: fric, Fhand: m * bus.a - fric, sliding: 0 };
      // 另一種讀法（|ma| ≤ f 時摩擦 = ma、扶手 0）——記錄以供 §7 待釐清
      if (Math.abs(m * bus.a) <= p.fBus && bus.a !== 0) { const alt = { f: m * bus.a, Fhand: 0 }; (errs["handrail_alt_f"] ??= new Err()).add(Math.abs(alt.f - o.f) / Math.max(1, Math.abs(alt.f)), t); (errs["handrail_alt_Fhand"] ??= new Err()).add(Math.abs(alt.Fhand - o.Fhand) / Math.max(1, Math.abs(o.Fhand)), t); }
    } else {
      if (!st.sliding && Math.abs(bus.a) > p.fBus / m + 1e-15) st.sliding = true;
      const r = paxRegime(st, p, bus, m);
      exp = { s: st.s, v: st.v, a: r.a, f: r.fric, Fhand: 0, sliding: st.sliding ? 1 : 0 };
    }
    cmp(errs, "s", exp.s, o.s, t, tie); cmp(errs, "v", exp.v, o.v, t, tie); cmp(errs, "a", exp.a, o.a, t, tie); cmp(errs, "f", exp.f, o.f, t, tie);
    cmp(errs, "Fhand", exp.Fhand, o.Fhand, t, tie); cmp(errs, "Fnet", exp.f + exp.Fhand, o.Fnet, t, tie);
    cmp(errs, "W", m * g, o.W, t); cmp(errs, "N", m * g, o.N, t);
    cmp(errs, "nForces", 2 + (exp.f !== 0) + (exp.Fhand !== 0), o.nForces, t, tie); cmp(errs, "nHoriz", (exp.f !== 0) + (exp.Fhand !== 0), o.nHoriz, t, tie);
    cmp(errs, "vBus", bus.v, o.vBus, t, tie); cmp(errs, "aBusNow", bus.a, o.aBusNow, t, tie); cmp(errs, "sBus", bus.s, o.sBus, t, tie);
    cmp(errs, "sRel", exp.s - bus.s, o.sRel, t, tie); cmp(errs, "busPhase", bus.phase, o.busPhase, t, tie); cmp(errs, "sliding", exp.sliding, o.sliding, t, tie);
    if (!p.handrail) cmp(errs, "energy", st.work, 0.5 * m * o.v * o.v, t, tie);
    checkArrows(F, errs, [{ z: 0, W: m * g, N: m * g, fric: o.f, app: o.Fhand, net: o.Fnet, v: o.v, a: o.a, vrel: o.v - o.vBus, tendency: sgn(o.aBusNow) }], t);
    extra.push({ t, o, exp, bus, tie });
  }
}

// ---------- 情景 4：太空 ----------
function checkSpace(run, errs, extra) {
  const fr = run.frames, TRIO_U = 2;
  let prevT = 0, prevP = null;
  const ships = [{ s: 0, v: 0 }, { s: 0, v: TRIO_U }, { s: 0, v: -TRIO_U }];
  for (let i = 0; i < fr.length; i++) {
    const F = fr[i], t = F.t, o = F.obs;
    const p = run.change && t >= run.change.t - 1e-12 ? { ...run.params, ...run.change.params } : run.params;
    if (i > 0) { const dt = t - prevT; if (dt > 0) { const a = prevP.engine === "on" ? (prevP.dir === "backward" ? -1 : 1) * prevP.Fe / prevP.mShip : 0; for (const sh of ships) { sh.s += sh.v * dt + 0.5 * a * dt * dt; sh.v += a * dt; } } }
    prevT = t; prevP = p;
    const on = p.engine === "on", Fe = on ? (p.dir === "backward" ? -1 : 1) * p.Fe : 0, a = Fe / p.mShip;
    cmp(errs, "s", ships[0].s, o.s, t); cmp(errs, "v", ships[0].v, o.v, t); cmp(errs, "a", a, o.a, t);
    cmp(errs, "Fe", Fe, o.Fe, t); cmp(errs, "Fnet", Fe, o.Fnet, t); cmp(errs, "W", 0, o.W, t); cmp(errs, "N", 0, o.N, t);
    cmp(errs, "nForces", Fe !== 0 ? 1 : 0, o.nForces, t); cmp(errs, "nHoriz", Fe !== 0 ? 1 : 0, o.nHoriz, t);
    cmp(errs, "engineOn", on ? 1 : 0, o.engineOn, t); if (!on) cmp(errs, "fuel_off", 0, o.fuel, t); else if (p.Fe > 0) (errs["fuel_on_positive"] ??= new Err()).add(o.fuel > 0 ? 0 : 1, t);
    if (on) cmp(errs, "fuel=0.05Fe(推測)", 0.05 * p.Fe, o.fuel, t);
    if (p.trio) { cmp(errs, "sB", ships[1].s, o.sB, t); cmp(errs, "vB", ships[1].v, o.vB, t); cmp(errs, "sC", ships[2].s, o.sC, t); cmp(errs, "vC", ships[2].v, o.vC, t); }
    const lanes = [{ z: 0, W: 0, N: 0, fric: 0, app: Fe, net: Fe, v: o.v, a: o.a, vrel: 0, tendency: 0 }];
    if (p.trio) { lanes.push({ z: 1, W: 0, N: 0, fric: 0, app: Fe, net: Fe, v: o.vB, a: o.a, vrel: 0, tendency: 0 }); lanes.push({ z: 2, W: 0, N: 0, fric: 0, app: Fe, net: Fe, v: o.vC, a: o.a, vrel: 0, tendency: 0 }); }
    checkArrows(F, errs, lanes, t);
    extra.push({ t, o, p, exp: { s: ships[0].s, v: ships[0].v, a } });
  }
  // 能量：KE(t) − KE(0) = Σ Fe·Δs（引擎恆力，逐幀精確）
  let W = 0; const m = run.params.mShip; let maxE = 0;
  for (let i = 1; i < fr.length; i++) { const p = run.change && fr[i - 1].t >= run.change.t - 1e-12 ? { ...run.params, ...run.change.params } : run.params; const Fe = p.engine === "on" ? (p.dir === "backward" ? -1 : 1) * p.Fe : 0; W += Fe * (fr[i].obs.s - fr[i - 1].obs.s); const e = Math.abs(0.5 * m * fr[i].obs.v ** 2 - W); if (e > maxE) maxE = e; }
  (errs["energy_space_abs"] ??= new Err()).add(maxE, 0);
}
function workSpace() { return 0; }

// ---------- 箭嘴（plan）檢查 ----------
const KINDS = new Set(["weight", "normal", "friction", "tension", "net", "velocity", "acceleration"]);
let scalesRef = null; const scaleViol = [], kindViol = [], presenceViol = [], dirViol = [];
function checkArrows(F, errs, lanes, t) {
  for (const k of Object.keys(F.scales)) { if (scalesRef === null) scalesRef = { ...F.scales }; else if (F.scales[k] !== scalesRef[k]) scaleViol.push({ t, k, v: F.scales[k] }); }
  for (const a of F.arrows) if (!KINDS.has(a.kind)) kindViol.push({ t, kind: a.kind });
  for (const L of lanes) {
    const A = F.arrows.filter(a => Math.round(a.origin[2]) === L.z);
    const by = k => A.filter(a => a.kind === k);
    const vec = k => by(k).reduce((acc, a) => [acc[0] + a.vector[0], acc[1] + a.vector[1], acc[2] + a.vector[2]], [0, 0, 0]);
    const sum = ["weight", "normal", "friction", "tension"].map(vec).reduce((acc, v) => [acc[0] + v[0], acc[1] + v[1], acc[2] + v[2]], [0, 0, 0]);
    const net = vec("net");
    (errs["arrow_net=sum"] ??= new Err()).add(Math.hypot(sum[0] - net[0], sum[1] - net[1], sum[2] - net[2]), t);
    (errs["arrow_net=Fnet"] ??= new Err()).add(Math.abs(net[0] - L.net), t);
    const w = vec("weight"), n = vec("normal"), fr = vec("friction"), ap = vec("tension"), vv = vec("velocity"), aa = vec("acceleration");
    (errs["arrow_W"] ??= new Err()).add(Math.hypot(w[0], w[1] + L.W, w[2]), t);
    (errs["arrow_N"] ??= new Err()).add(Math.hypot(n[0], n[1] - L.N, n[2]), t);
    (errs["arrow_f"] ??= new Err()).add(Math.hypot(fr[0] - L.fric, fr[1], fr[2]), t);
    (errs["arrow_app"] ??= new Err()).add(Math.hypot(ap[0] - L.app, ap[1], ap[2]), t);
    (errs["arrow_v"] ??= new Err()).add(Math.hypot(vv[0] - (Math.abs(L.v) >= 1e-9 ? L.v : 0), vv[1], vv[2]), t);
    (errs["arrow_a"] ??= new Err()).add(Math.hypot(aa[0] - (Math.abs(L.a) >= 1e-9 ? L.a : 0), aa[1], aa[2]), t);
    // 出現規則：非零量必有箭嘴；零量不畫
    for (const [k, val] of [["velocity", L.v], ["acceleration", L.a], ["friction", L.fric], ["tension", L.app], ["net", L.net]]) { const cnt = by(k).length; if ((Math.abs(val) >= 1e-9) !== (cnt === 1)) presenceViol.push({ t, z: L.z, k, val, cnt }); }
    if (by("weight").length !== (L.W > 0 ? 1 : 0) || by("normal").length !== (L.N > 0 ? 1 : 0)) presenceViol.push({ t, z: L.z, k: "weight/normal" });
    // 摩擦方向：與相對運動（或趨勢）相反；法向反作用力 ⊥ 接觸面（x = z = 0）；a ∥ F_net
    if (fr[0] !== 0) { if (L.vrel !== 0) { if (fr[0] * L.vrel > 0) dirViol.push({ t, z: L.z, f: fr[0], vrel: L.vrel }); } else if (L.tendency !== 0 && fr[0] * L.tendency < 0) dirViol.push({ t, z: L.z, f: fr[0], tendency: L.tendency }); }
  }
}

// ---------- 主迴圈 ----------
const results = {}; const perRun = {};
for (const run of runs) {
  const scene = run.params.scene; const errs = {}; const extra = [];
  try {
    if (scene === "table") checkTable(run, errs, extra); else if (scene === "cloth") checkCloth(run, errs, extra); else if (scene === "bus") checkBus(run, errs, extra); else checkSpace(run, errs, extra);
  } catch (e) { errs["_exception"] = { max: 1, t: null, msg: String(e.stack) }; }
  perRun[run.name] = extra;
  const worst = Object.entries(errs).filter(([k]) => !k.startsWith("handrail_alt") && !k.startsWith("fuel=")).sort((a, b) => b[1].max - a[1].max)[0];
  results[run.name] = { set: run.set, scene, frames: run.frames.length, tEnd: run.frames.at(-1).t, errs: Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, { max: v.max, t: v.t, ties: v.ties }])), worst: worst ? { key: worst[0], max: worst[1].max, t: worst[1].t } : null };
}
say("== 逐幀比對（最差量） ==");
for (const [n, r] of Object.entries(results)) say(`${r.set}\t${n}\tscene=${r.scene}\tframes=${r.frames}\ttEnd=${r.tEnd.toFixed(3)}\tworst=${r.worst ? `${r.worst.key} ${r.worst.max.toExponential(2)} @t=${r.worst.t}` : "-"}\tties=${Object.values(r.errs).reduce((a, e) => a + (e.ties || 0), 0)}`);
say(`scales 違規 ${scaleViol.length}；kind 違規 ${kindViol.length}；出現規則違規 ${presenceViol.length}；摩擦方向違規 ${dirViol.length}`);
if (presenceViol.length) say("presence 例：" + JSON.stringify(presenceViol.slice(0, 5)));
if (dirViol.length) say("dir 例：" + JSON.stringify(dirViol.slice(0, 5)));
say("scales 參考：" + JSON.stringify(scalesRef));

// ---------- 條件逐條 ----------
const R = n => runs.find(r => r.name === n); const cond = {};
const uniq = arr => [...new Set(arr.map(x => +x.toPrecision(12)))];
{ // 1
  const r = R("extra-release-smooth"); const after = r.frames.filter(f => f.t >= 0.5); const vs = uniq(after.map(f => f.obs.v));
  const ls = R("long-space-dt0.5"); const lt = R("long-table-dt0.5");
  cond[1] = { release_smooth_v_values: vs, n: after.length, long_space_tEnd: ls.frames.at(-1).t, long_space_v: uniq(ls.frames.map(f => f.obs.v)), long_space_vB: uniq(ls.frames.map(f => f.obs.vB)), long_space_vC: uniq(ls.frames.map(f => f.obs.vC)), long_table_v: uniq(lt.frames.map(f => f.obs.v)) };
}
{ // 2, 3
  const r = R("extra-release-smooth"); const after = r.frames.filter(f => f.t >= 0.5);
  cond[2] = { maxFnet: Math.max(...after.map(f => Math.abs(f.obs.Fnet))), maxA: Math.max(...after.map(f => Math.abs(f.obs.a))), n: after.length };
  const cnt = k => uniq(after.map(f => f.arrows.filter(a => a.kind === k).length));
  cond[3] = { tension_after: cnt("tension"), weight_after: cnt("weight"), normal_after: cnt("normal"), nForces_after: uniq(after.map(f => f.obs.nForces)), nHoriz_after: uniq(after.map(f => f.obs.nHoriz)), tension_before: uniq(r.frames.filter(f => f.t < 0.5).map(f => f.arrows.filter(a => a.kind === "tension").length)) };
}
{ // 4
  const r = R("scenario-rest-not-no-force"); let maxMag = 0, maxDot = 0; const kinds = new Set();
  for (const f of r.frames) { const w = f.arrows.find(a => a.kind === "weight"), n = f.arrows.find(a => a.kind === "normal"); f.arrows.forEach(a => kinds.add(a.kind)); const mw = Math.hypot(...w.vector), mn = Math.hypot(...n.vector); maxMag = Math.max(maxMag, Math.abs(mw - mn) / mw); const dot = (w.vector[0] * n.vector[0] + w.vector[1] * n.vector[1] + w.vector[2] * n.vector[2]) / (mw * mn); maxDot = Math.max(maxDot, Math.abs(dot + 1)); }
  cond[4] = { kinds: [...kinds], maxMagRel: maxMag, maxDotErr: maxDot, Fnet: uniq(r.frames.map(f => f.obs.Fnet)), v: uniq(r.frames.map(f => f.obs.v)) };
}
{ // 5
  cond[5] = {};
  for (const n of ["static-F0.3", "static-F0.39", "static-F0.4", "static-F0.4001", "static-F0.45", "static-F3", "static-F3-f3", "static-F0-f0"]) { const r = R(n); const last = r.frames.at(-1).obs; cond[5][n] = { F: r.params.F, f1: r.params.f1, a_values: uniq(r.frames.map(f => f.obs.a)), f_values: uniq(r.frames.map(f => f.obs.f)), s_end: last.s, v_end: last.v, a_exp: r.params.F > r.params.f1 ? (r.params.F - r.params.f1) / r.params.m : 0 }; }
}
{ // 6
  const r = R("scenario-constant-v-zero-net"); const after = r.frames.filter(f => f.obs.s >= 0.75 + 1e-9); const vB = Math.sqrt(2 * (1 / 0.5) * 0.75);
  cond[6] = { n: after.length, Fnet: uniq(after.map(f => f.obs.Fnet)), f: uniq(after.map(f => f.obs.f)), Fapp: uniq(after.map(f => f.obs.Fapp)), vmin: Math.min(...after.map(f => f.obs.v)), vmax: Math.max(...after.map(f => f.obs.v)), v_exp: vB, net_arrow: uniq(after.map(f => (f.arrows.find(a => a.kind === "net") || { vector: [0] }).vector[0])) };
}
{ // 7
  cond[7] = {};
  for (const n of ["extra-release-1s", "release-1.5-f2-0.4", "release-1.5-f2-0.05", "release-1.5-f2-3"]) {
    const r = R(n); const tc = r.change.t; const i0 = r.frames.findIndex(f => f.t >= tc - 1e-12); const f0 = r.frames[i0]; const m = r.params.m, f2 = r.params.f2;
    const rough = r.frames.slice(i0).filter(f => f.obs.s >= 0.75 && f.obs.v > 0); const aErr = Math.max(...rough.map(f => Math.abs(f.obs.a + f2 / m) / (f2 / m)));
    // 滑行距離：由進入粗糙段（或放手時已在粗糙段）的速度算
    const sRoughStart = Math.max(f0.obs.s, 0.75); const vAtRough = f0.obs.s >= 0.75 ? f0.obs.v : f0.obs.v; // 光滑段放手後速度不變
    const dExp = m * vAtRough * vAtRough / (2 * f2); const sEnd = r.frames.at(-1).obs.s; const stopped = r.frames.filter(f => f.t > tc && f.obs.v === 0);
    cond[7][n] = { t_release: f0.t, v_release: f0.obs.v, s_release: f0.obs.s, a_relErr: aErr, d_exp: dExp, d_got: sEnd - sRoughStart, d_relErr: Math.abs(sEnd - sRoughStart - dExp) / dExp, vmin: Math.min(...r.frames.map(f => f.obs.v)), f_after_stop: uniq(stopped.map(f => f.obs.f)), friction_arrows_after_stop: uniq(stopped.map(f => f.arrows.filter(a => a.kind === "friction").length)) };
  }
}
{ // 8
  const am = []; let maxDvAfter = 0; const ms = [];
  for (let k = 0; k < 20; k++) { const r = R(`mass-${k}`); const before = r.frames.filter(f => f.t < 0.5 - 1e-12), after = r.frames.filter(f => f.t >= 0.5 - 1e-12); am.push(...before.map(f => f.obs.a * r.params.m)); const vs = after.map(f => f.obs.v); maxDvAfter = Math.max(maxDvAfter, Math.max(...vs) - Math.min(...vs)); ms.push(r.params.m); }
  const mean = am.reduce((a, b) => a + b) / am.length, sd = Math.sqrt(am.reduce((a, b) => a + (b - mean) ** 2, 0) / am.length);
  const two = R("extra-release-two-blocks"); const fA = two.frames.find(f => f.t >= 0.5 - 1e-12);
  cond[8] = { masses: [ms[0], ms[19]], am_min: Math.min(...am), am_max: Math.max(...am), am_relSD: sd / mean, maxDvAfterRelease: maxDvAfter, twoBlocks: { t: fA.t, vA: fA.obs.v, vB: fA.obs.vB, ratio: fA.obs.v / fA.obs.vB, exp: two.params.mB / two.params.m } };
}
const clothExact = (p) => { const a = p.fCloth / p.mObj; const D = p.vCloth ** 2 - 2 * a * p.L; if (D < 0 || (D === 0)) return { stuck: true, dv: p.vCloth, t: p.vCloth / a }; const t = a === 0 ? p.L / p.vCloth : (p.vCloth - Math.sqrt(D)) / a; return { stuck: false, t, dv: a * t }; };
{ // 9
  const rows = []; let maxErr = 0, mono = true;
  for (let k = 0; k < 20; k++) { const r = R(`cloth-v-${k}`); const e = clothExact(r.params); const got = r.frames.at(-1).obs; rows.push({ v: r.params.vCloth, dv: got.dv, dv_exp: e.dv, dt: got.dtPull, stuck: got.stuck }); maxErr = Math.max(maxErr, Math.abs(got.dv - e.dv) / e.dv); if (k > 0 && !(rows[k].dv < rows[k - 1].dv)) mono = false; }
  const s5 = R("scenario-cloth-impulse").frames.at(-1).obs, s10 = R("cloth-v-19").frames.at(-1).obs;
  cond[9] = { strictlyDecreasing: mono, maxRelErr: maxErr, first: rows[0], last: rows[19], dv5: s5.dv, dv5_exp: clothExact(R("scenario-cloth-impulse").params).dv, dv10: s10.dv, dv10_exp: clothExact(R("cloth-v-19").params).dv };
}
{ // 10
  const vc = Math.sqrt(2 * 1.5 * 0.4 / 1); const rows = {};
  for (const n of [...[-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].map(k => `cloth-crit-${k}`), "cloth-crit-exact", "extra-cloth-stuck", "extra-cloth-critical-above"]) { const r = R(n); const last = r.frames.at(-1).obs; const e = clothExact(r.params); rows[n] = { vCloth: r.params.vCloth, stuck_got: last.stuck, stuck_exp: e.stuck ? 1 : 0, v_end: last.v, v_end_relErr: e.stuck ? Math.abs(last.v - r.params.vCloth) / r.params.vCloth : null, dv: last.dv, dv_exp: e.dv, dtPull: last.dtPull, dt_exp: e.t }; }
  cond[10] = { vCrit: vc, rows };
}
{ // 11
  const rows = []; let maxAOnCloth = 0, maxVexcess = -Infinity, monoUp = true, maxErr = 0, literalViol = 0;
  for (let k = 0; k < 20; k++) { const r = R(`cloth-f-${k}`); const lim = r.params.fCloth / r.params.mObj; const onCloth = r.frames.filter(f => f.obs.phase <= 1); const aOn = Math.max(...onCloth.map(f => Math.abs(f.obs.a))); maxAOnCloth = Math.max(maxAOnCloth, aOn - lim); literalViol += r.frames.filter(f => Math.abs(f.obs.a) > lim + 1e-12).length; maxVexcess = Math.max(maxVexcess, Math.max(...r.frames.map(f => f.obs.v)) - r.params.vCloth); const got = r.frames.at(-1).obs; const e = clothExact(r.params); rows.push({ f: r.params.fCloth, dv: got.dv, dv_exp: e.dv, stuck: got.stuck, aOnClothMax: aOn, lim }); if (!e.stuck) maxErr = Math.max(maxErr, Math.abs(got.dv - e.dv) / Math.max(e.dv, 1e-300)); if (k > 0 && !got.stuck && !(rows[k].dv > rows[k - 1].dv)) monoUp = false; }
  cond[11] = { maxAExcessOnCloth: maxAOnCloth, framesViolatingLiteral_anyTime: literalViol, maxVexcess, strictlyIncreasing_notStuck: monoUp, maxRelErr: maxErr, first: rows[0], k1: rows[1], last: rows[19] };
}
{ // 12
  let maxE1 = 0, maxE2 = 0; const names = [];
  for (const r of runs.filter(r => r.params.scene === "cloth")) { for (const f of r.frames) { const o = f.obs; const fEff = o.stuck ? r.params.fCloth : r.params.fCloth; const e1 = Math.abs(o.J - fEff * o.dtPull) / Math.max(1e-12, Math.abs(o.J)); const e2 = Math.abs(o.J - r.params.mObj * o.dv) / Math.max(1e-12, Math.abs(o.J)); if (o.J > 0) { maxE1 = Math.max(maxE1, e1); maxE2 = Math.max(maxE2, e2); } } names.push(r.name); }
  cond[12] = { runs: names.length, maxRel_J_vs_fdt: maxE1, maxRel_J_vs_mdv: maxE2 };
}
{ // 13
  const b = R("bus-brake-f120"); const m = 60; const lim = b.params.fBus / m; const sl = b.frames.filter(f => f.obs.sliding === 1 && f.t < b.frames.at(-1).t);
  const brake = b.frames.filter(f => f.obs.busPhase === 2); const startSlide = b.frames.filter(f => f.obs.busPhase === 0);
  const stopSlideTimes = []; for (let i = 1; i < b.frames.length; i++) if (b.frames[i - 1].obs.sliding === 1 && b.frames[i].obs.sliding === 0) stopSlideTimes.push(b.frames[i].t);
  const noslide = {}; for (const n of ["bus-f180-boundary", "bus-a1-f120", "bus-a5-v2-f300"]) { const r = R(n); noslide[n] = { a: r.params.aBus, f: r.params.fBus, lim: r.params.fBus / 60, maxAbsSRel: Math.max(...r.frames.map(f => Math.abs(f.obs.sRel))), maxAbs_f_minus_ma: Math.max(...r.frames.map(f => Math.abs(f.obs.f - 60 * f.obs.aBusNow))), sliding: uniq(r.frames.map(f => f.obs.sliding)), nHoriz: uniq(r.frames.map(f => f.obs.nHoriz)) }; }
  const f170 = R("bus-f170"); const f240 = R("bus-start-f240");
  const hr = R("bus-brake-handrail-f120"); const hr1 = R("bus-a1-f120-handrail");
  cond[13] = {
    default_f120: { lim, sliding_frames: sl.length, max_abs_a_minus_lim_sliding: Math.max(...sl.map(f => Math.abs(Math.abs(f.obs.a) - lim))), brake_min_v_minus_vBus: Math.min(...brake.map(f => f.obs.v - f.obs.vBus)), start_max_v_minus_vBus: Math.max(...startSlide.map(f => f.obs.v - f.obs.vBus)), stopSlideTimes, sRel_min: Math.min(...b.frames.map(f => f.obs.sRel)), sRel_end: b.frames.at(-1).obs.sRel, nHoriz_max: Math.max(...b.frames.map(f => f.obs.nHoriz)), forward_horizontal_arrows_in_brake: brake.filter(f => f.arrows.some(a => (a.kind === "friction" || a.kind === "tension") && a.vector[0] > 0)).length, brake_a_values: uniq(brake.map(f => f.obs.a)), start_a_values: uniq(startSlide.map(f => f.obs.a)) },
    noslide,
    f170: { lim: 170 / 60, sliding: uniq(f170.frames.map(f => f.obs.sliding)), sRel_min: Math.min(...f170.frames.map(f => f.obs.sRel)), a_values: uniq(f170.frames.map(f => f.obs.a)) },
    f240: { lim: 4, sliding: uniq(f240.frames.map(f => f.obs.sliding)), maxAbsSRel: Math.max(...f240.frames.map(f => Math.abs(f.obs.sRel))), f_values: uniq(f240.frames.map(f => f.obs.f)), Fnet_values: uniq(f240.frames.map(f => f.obs.Fnet)), backward_arrows: f240.frames.filter(f => f.arrows.some(a => (a.kind === "friction" || a.kind === "tension") && a.vector[0] < 0)).length },
    f0: { v: uniq(R("extra-bus-f0").frames.map(f => f.obs.v)), sRel_end: R("extra-bus-f0").frames.at(-1).obs.sRel, s_end: R("extra-bus-f0").frames.at(-1).obs.s },
    handrail: { maxAbsSRel: Math.max(...hr.frames.map(f => Math.abs(f.obs.sRel))), max_abs_Fhand_plus_f_minus_ma: Math.max(...hr.frames.map(f => Math.abs(f.obs.Fhand + f.obs.f - 60 * f.obs.aBusNow))), f_values: uniq(hr.frames.map(f => f.obs.f)), Fhand_values: uniq(hr.frames.map(f => f.obs.Fhand)), a1_f_values: uniq(hr1.frames.map(f => f.obs.f)), a1_Fhand_values: uniq(hr1.frames.map(f => f.obs.Fhand)), a1_Fnet_values: uniq(hr1.frames.map(f => f.obs.Fnet)) },
  };
}
{ // 14
  const kinds = new Set(), labels = new Set(); let frames = 0, busHorizMax = 0;
  for (const r of runs) for (const f of r.frames) { frames++; f.arrows.forEach(a => { kinds.add(a.kind); labels.add(a.label); }); if (r.params.scene === "bus" && !r.params.handrail) busHorizMax = Math.max(busHorizMax, f.obs.nHoriz); }
  cond[14] = { runs: runs.length, frames, kinds: [...kinds], labels: [...labels], busNoHandrail_nHoriz_max: busHorizMax };
}
{ // 15  由逐幀 energy 鍵取
  const pick = {}; for (const [n, r] of Object.entries(results)) { for (const k of ["energy", "energyB", "energy_space_abs"]) if (r.errs[k]) (pick[k] ??= []).push([n, r.errs[k].max]); }
  const worst = {}; for (const [k, arr] of Object.entries(pick)) { arr.sort((a, b) => b[1] - a[1]); worst[k] = arr.slice(0, 3); }
  const two = R("extra-release-two-blocks"); const after = two.frames.filter(f => f.t >= 0.5); const KE = after.map(f => 0.5 * 0.2 * f.obs.v ** 2 + 0.5 * 1 * f.obs.vB ** 2);
  cond[15] = { worst, twoBlocks_KE_drift: Math.max(...KE) - Math.min(...KE) };
}
{ // 16
  const agg = { net_sum: 0, net_Fnet: 0, a_vs_Fnet_over_m: 0, arrow_a: 0, arrow_v: 0, arrow_f: 0, arrow_app: 0, arrow_W: 0, arrow_N: 0 };
  for (const r of Object.values(results)) for (const k of ["arrow_net=sum", "arrow_net=Fnet", "arrow_a", "arrow_v", "arrow_f", "arrow_app", "arrow_W", "arrow_N"]) if (r.errs[k]) agg[k] = Math.max(agg[k] || 0, r.errs[k].max);
  let aF = 0; for (const r of runs) { const m = r.params.scene === "table" ? r.params.m : r.params.scene === "cloth" ? r.params.mObj : r.params.scene === "bus" ? 60 : r.params.mShip; for (const f of r.frames) aF = Math.max(aF, Math.abs(f.obs.a - f.obs.Fnet / m)); }
  cond[16] = { ...agg, a_minus_Fnet_over_m_max: aF, scaleViol: scaleViol.length, kindViol: kindViol.length, presenceViol: presenceViol.length, dirViol: dirViol.length, scales: scalesRef };
}
{ // 17
  const h = R("scenario-heavy-not-farther").frames[1000]; const w = h.arrows.find(a => a.kind === "weight"), v = h.arrows.find(a => a.kind === "velocity"); const zs = uniq(h.arrows.map(a => a.origin[2]));
  const bb = R("bus-brake-f120").frames.find(f => f.obs.busPhase === 2 && f.obs.sliding === 1); const bf = bb.arrows.find(a => a.kind === "friction");
  cond[17] = { weight_dir: w.vector.map(x => Math.sign(x)), velocity_dir: v.vector.map(x => Math.sign(x)), lanes_z: zs, brake_friction_dir: bf.vector.map(x => Math.sign(x)), trio_z: uniq(R("scenario-inertia-not-speed").frames[100].arrows.map(a => a.origin[2])) };
}
// 邊界：NaN / Infinity
{ let bad = []; for (const r of runs) for (const f of r.frames) { for (const [k, v] of Object.entries(f.obs)) if (typeof v === "number" && !Number.isFinite(v)) bad.push({ run: r.name, t: f.t, k }); for (const a of f.arrows) if (!a.vector.every(Number.isFinite)) bad.push({ run: r.name, t: f.t, arrow: a.kind }); } cond.edge = { nonFinite: bad.length, examples: bad.slice(0, 5) };
  const ed = {}; for (const n of ["edge-cloth-fT0", "edge-cloth-f0-fT0", "edge-cloth-v0.1-L1-f3", "edge-cloth-v10-L0.1-f3-fT0.05", "edge-table-m0.1-F10-f3", "edge-table-m5-F10-f0", "edge-table-m5-F0", "edge-space-Fe5-m0.5", "edge-space-Fe5-m5-back", "edge-space-g10", "bus-a0", "bus-a5-v15-f0-handrail"]) { const r = R(n); const last = r.frames.at(-1).obs; ed[n] = { tEnd: r.frames.at(-1).t, s: last.s, v: last.v, a: last.a, phase: last.phase, stuck: last.stuck, dv: last.dv, slide: last.slide, sRel: last.sRel, Fhand: last.Fhand, sB: last.sB, vB: last.vB, vC: last.vC, worst: results[n].worst }; } cond.edgeRuns = ed; }
// 靜摩擦 ≤ 設定值、滑動時 |f| = 設定值（全部桌面／桌布／巴士運行）
{ let maxStaticExcess = -Infinity, slidingMismatch = 0, n = 0; for (const r of runs) { const p = r.params; for (const f of r.frames) { const o = f.obs; let fset, vrel; if (p.scene === "table") { fset = o.s >= 0.75 ? p.f2 : p.f1; vrel = o.v; } else if (p.scene === "cloth") { fset = o.phase <= 1 ? p.fCloth : p.fTable; vrel = o.phase <= 1 ? o.v - o.vCloth : o.v; } else if (p.scene === "bus") { fset = p.fBus; vrel = o.v - o.vBus; } else continue; n++; if (Math.abs(vrel) > 1e-12) { if (Math.abs(Math.abs(o.f) - fset) > 1e-9) slidingMismatch++; } else maxStaticExcess = Math.max(maxStaticExcess, Math.abs(o.f) - fset); } } cond.frictionBound = { frames: n, maxStaticExcess, slidingMismatch };
  const d = R("default"); const stopped = d.frames.filter(f => f.obs.v === 0 && f.obs.s > 1); const e1 = R("extra-release-1s"); cond.defaultAfterStop = { default_2s_no_stop: stopped.length, extra_release_1s_stop_t: e1.frames.find(f => f.t > 1 && f.obs.v === 0)?.t, s_stop: e1.frames.at(-1).obs.s, d_exp: 1 + 0.2 * 1.5 * 1.5 / (2 * 0.4) - 0.25 };
  const dd = R("scenario-stop-is-friction"); const dec = dd.frames.filter(f => f.obs.s >= 0.75 + 1e-9 && f.obs.v > 0); cond.defaultRough = { a_values: uniq(dec.map(f => f.obs.a)), f_values: uniq(dec.map(f => f.obs.f)), Fnet_values: uniq(dec.map(f => f.obs.Fnet)), n: dec.length, a_exp: (0.3 - 0.4) / 0.2 };
}
{ const bad = []; for (const r of runs) { const p = r.params; for (const f of r.frames) { const o = f.obs; if (p.scene === "table" && o.v === 0 && Math.abs(o.Fapp) <= (o.s >= 0.75 - 1e-9 ? p.f2 : p.f1) && Math.abs(o.f + o.Fapp) > 1e-12) bad.push({ run: r.name, t: f.t, v: o.v, f: o.f, a: o.a, Fapp: o.Fapp }); if (p.scene === "cloth" && o.phase >= 2 && o.v === 0 && o.f !== 0) bad.push({ run: r.name, t: f.t, f: o.f, a: o.a, phase: o.phase }); if (p.scene === "bus" && !p.handrail && o.v === o.vBus && o.vBus === 0 && o.aBusNow === 0 && o.f !== 0) bad.push({ run: r.name, t: f.t, f: o.f, a: o.a }); } } cond.restFrictionInconsistent = { count: bad.length, frames: bad }; }
{ const d = R("bus-start-f240"); const st = d.frames.filter(f => f.obs.busPhase === 0); cond.f240start = { frames: st.length, backwardHorizArrows: st.filter(f => f.arrows.some(a => (a.kind === "friction" || a.kind === "tension") && a.vector[0] < 0)).length, f_values: uniq(st.map(f => f.obs.f)), sRelMax: Math.max(...st.map(f => Math.abs(f.obs.sRel))) }; }
say("== 條件 ==");
for (const [k, v] of Object.entries(cond)) say(`[${k}] ${JSON.stringify(v)}`);
fs.writeFileSync(path.join(ROOT, "audit/r7-results.json"), JSON.stringify({ results, cond, scaleViol: scaleViol.slice(0, 20), kindViol, presenceViol: presenceViol.slice(0, 50), dirViol: dirViol.slice(0, 50) }, null, 1));
fs.writeFileSync(path.join(ROOT, "audit/r7-independent.log"), log.join("\n"));
