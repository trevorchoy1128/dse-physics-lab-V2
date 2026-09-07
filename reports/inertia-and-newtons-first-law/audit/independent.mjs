// 核數員的獨立計算：只按規格 §7 方程，逐相位閉式（等加速度）＋精確事件時間，不讀 model.ts / plan.ts。
// 用法：node independent.mjs  → 印出比對摘要，並寫 independent-results.json
import fs from "node:fs";
const ROOT = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/";
const DATA = ROOT + "data/", EXTRA = ROOT + "audit/extra-data/";
const LAB = 0.75;          // 前段光滑桌面長（規格：B 點；plan.meta.LAB = 0.75）
const MP = 60;             // 乘客質量（規格外常數，manifest.beyondSpec）
const EPS = 1e-12;

// ---------- 通用 ----------
const sgn = x => (x > 0 ? 1 : x < 0 ? -1 : 0);
// 最小正根 τ：s0 + v τ + ½ a τ² = target（s0 < target）
function reachTime(s0, v, a, target) {
  const D = target - s0; // > 0
  if (Math.abs(a) < 1e-300) return v > 0 ? D / v : Infinity;
  const disc = v * v + 2 * a * D;
  if (disc < 0) return Infinity;
  const r = Math.sqrt(disc);
  const t1 = (-v - r) / a, t2 = (-v + r) / a;
  const c = [t1, t2].filter(t => t > 0);
  return c.length ? Math.min(...c) : Infinity;
}

// ---------- 情景 1：桌面方塊（每個方塊獨立） ----------
function tableObs(st, m, F, mu1, mu2, g) {
  const mu = st.s < LAB ? mu1 : mu2;
  const cap = mu * m * g;
  let a, f;
  if (st.v > 0) { f = -cap; a = (F + f) / m; }
  else if (st.v < 0) { f = cap; a = (F + f) / m; }
  else { if (Math.abs(F) <= cap) { f = -F; a = 0; } else { f = -cap * sgn(F); a = (F + f) / m; } }
  return { a, f, mu };
}
function tableStep(st, m, F, mu1, mu2, g, dt) {
  let rem = dt;
  for (let guard = 0; rem > 1e-15 && guard < 20; guard++) {
    const { a } = tableObs(st, m, F, mu1, mu2, g);
    let te = rem, ev = null;
    if (st.v > 0 && a < 0) { const ts = -st.v / a; if (ts < te) { te = ts; ev = "stop"; } }
    if (st.s < LAB && (st.v > 0 || a > 0)) { const tr = reachTime(st.s, st.v, a, LAB); if (tr < te) { te = tr; ev = "B"; } }
    st.s += st.v * te + 0.5 * a * te * te; st.v += a * te;
    if (ev === "stop") st.v = 0;
    if (ev === "B") st.s = LAB;
    rem -= te;
  }
  return st;
}

// ---------- 情景 2：桌布 ----------
function clothObs(st, p, t) {
  const m = p.mObj ?? 1, g = p.g, e = -p.L + p.vCloth * t;
  let phase, a, f;
  if (e < st.s - EPS) {
    if (st.v < p.vCloth - EPS) { phase = 0; a = p.muCloth * g; f = a * m; }
    else { phase = 1; a = 0; f = 0; }
  } else {
    if (st.v > EPS) { phase = 2; a = -p.muTable * g; f = a * m; }
    else { phase = 3; a = 0; f = 0; }
  }
  return { phase, a, f, e };
}
function clothStep(st, p, t, dt) {
  let rem = dt;
  for (let guard = 0; rem > 1e-15 && guard < 20; guard++) {
    const { phase, a, e } = clothObs(st, p, t);
    if (phase >= 2 && !st.left) { st.left = true; st.leftAt = t; st.sLeave = st.s; st.dv = st.v; }
    let te = rem, ev = null;
    if (phase === 0) {
      if (a > 0) { const tc = (p.vCloth - st.v) / a; if (tc < te) { te = tc; ev = "catch"; } }
      // 布尾邊追上物件：(e−s) + (v布−v)τ − ½aτ² = 0
      const D = st.s - e, dv = p.vCloth - st.v;
      let tl = Infinity;
      if (a > 0) { const disc = dv * dv - 2 * a * D; if (disc >= 0) tl = (dv - Math.sqrt(disc)) / a; }
      else tl = D / dv;
      if (tl < te) { te = tl; ev = "leave"; }
    } else if (phase === 2) {
      const ts = -st.v / a; if (ts < te) { te = ts; ev = "stop"; }
    }
    st.s += st.v * te + 0.5 * a * te * te; st.v += a * te; t += te;
    if (ev === "catch") st.v = p.vCloth;
    if (ev === "stop") st.v = 0;
    if (ev === "leave") { st.leftAt = t; st.sLeave = st.s; st.dv = st.v; st.left = true; }
    if (ev === "catch" && !st.left) st.stuck = true;
    rem -= te;
  }
  return st;
}
function clothExact(p) {
  const a = p.muCloth * p.g, v = p.vCloth, L = p.L, m = p.mObj ?? 1;
  const disc = v * v - 2 * a * L;
  if (disc < 0) return { stuck: true, dt: NaN, dv: NaN, J: NaN, slide: NaN };
  const dt = a > 0 ? (v - Math.sqrt(disc)) / a : L / v;
  const dv = a * dt;
  return { stuck: false, dt, dv, J: m * dv, slide: p.muTable > 0 ? dv * dv / (2 * p.muTable * p.g) : Infinity };
}

// ---------- 情景 3：巴士 ----------
function busKin(p, t) {
  const A = p.aBus, V = p.vBus;
  if (A <= 0) return { phase: 0, a: 0, v: 0, s: 0, tNext: Infinity };
  const t1 = V / A, t2 = t1 + 4, t3 = t2 + t1;
  if (t < t1 - EPS) return { phase: 0, a: A, v: A * t, s: 0.5 * A * t * t, tNext: t1 };
  if (t < t2 - EPS) return { phase: 1, a: 0, v: V, s: 0.5 * A * t1 * t1 + V * (t - t1), tNext: t2 };
  if (t < t3 - EPS) { const u = t - t2; return { phase: 2, a: -A, v: V - A * u, s: 0.5 * A * t1 * t1 + V * 4 + V * u - 0.5 * A * u * u, tNext: t3 }; }
  return { phase: 3, a: 0, v: 0, s: A * t1 * t1 + V * 4, tNext: Infinity };
}
function busObs(st, p, t) {
  const g = p.g, mu = p.muBus, cap = mu * MP * g, b = busKin(p, t);
  let a, f, Fh = 0, sliding = 0;
  if (p.handrail) { a = b.a; f = Math.max(-cap, Math.min(cap, MP * b.a)); Fh = MP * b.a - f; }
  else {
    const rel = st.v - b.v;
    if (Math.abs(rel) <= 1e-9) {
      if (Math.abs(b.a) <= mu * g + EPS) { a = b.a; f = MP * a; }
      else { a = mu * g * sgn(b.a); f = MP * a; sliding = 1; }
    } else { a = -mu * g * sgn(rel); f = MP * a; sliding = 1; }
  }
  return { a, f, Fh, bus: b, sliding };
}
function busStep(st, p, t, dt) {
  let rem = dt;
  for (let guard = 0; rem > 1e-15 && guard < 30; guard++) {
    const o = busObs(st, p, t), b = o.bus;
    let te = rem, ev = null;
    if (b.tNext - t < te) { te = b.tNext - t; ev = "phase"; }
    if (!p.handrail) {
      const rel = st.v - b.v, da = o.a - b.a;
      if (Math.abs(rel) > 1e-9 && Math.abs(da) > 0) { const tz = -rel / da; if (tz > 0 && tz < te) { te = tz; ev = "match"; } }
    }
    st.s += st.v * te + 0.5 * o.a * te * te; st.v += o.a * te; t += te;
    if (ev === "match") st.v = busKin(p, t).v;
    if (p.handrail) { const nb = busKin(p, t); st.v = nb.v; st.s = nb.s; }
    rem -= te;
  }
  return st;
}

// ---------- 情景 4：太空 ----------
function spaceA(p) { return p.engine === "on" ? (p.dir === "backward" ? -1 : 1) * p.Fe / p.mShip : 0; }

// ---------- 逐幀比對 ----------
const relErr = (x, y) => Math.abs(x - y) / Math.max(Math.abs(y), 1);
function compareRun(run, opt = {}) {
  const p0 = run.params, dt = run.dt, frames = run.frames;
  const sched = opt.sched || (() => p0);
  const errs = {}; const note = (k, e, t) => { if (!errs[k]) errs[k] = { e: 0, t: 0, n: 0, ts: [] }; if (e > errs[k].e) { errs[k].e = e; errs[k].t = t; } if (e > 1e-6) { errs[k].n++; if (errs[k].ts.length < 6) errs[k].ts.push(+t.toFixed(4)); } };
  const scene = p0.scene;
  let st, stB, stC, t = 0;
  if (scene === "table") { st = { s: 0, v: 0 }; stB = { s: 0, v: 0 }; }
  if (scene === "cloth") st = { s: 0, v: 0, left: false, stuck: false, dv: 0 };
  if (scene === "bus") st = { s: 0, v: 0 };
  const stride = opt.stride || 1;
  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i]; if (fr.meta && fr.meta.done === 1) break; t = fr.t; const o = fr.obs; const p = sched(t, p0);
    const chk = (k, mine, theirs, rel = true) => { const e = rel ? relErr(theirs, mine) : Math.abs(theirs - mine); note(k, e, t); if (!Number.isFinite(theirs)) note(k + ":NaN", Infinity, t); };
    if (scene === "table") {
      const F = p.push === "on" ? p.F : 0;
      const ob = tableObs(st, p.m, F, p.mu1, p.mu2, p.g);
      chk("s", st.s, o.s); chk("v", st.v, o.v); chk("a", ob.a, o.a); chk("f", ob.f, o.f);
      chk("Fnet", F + ob.f, o.Fnet); chk("Fapp", F, o.Fapp); chk("W", p.m * p.g, o.W); chk("N", p.m * p.g, o.N);
      const nF = 2 + (F !== 0 ? 1 : 0) + (ob.f !== 0 ? 1 : 0);
      chk("nForces", nF, o.nForces, false); chk("nHoriz", nF - 2, o.nHoriz, false);
      if (p.second) {
        const obB = tableObs(stB, p.mB, F, p.mu1, p.mu2, p.g);
        chk("sB", stB.s, o.sB); chk("vB", stB.v, o.vB); chk("aB", obB.a, o.aB);
      }
      for (let k = 0; k < stride; k++) {
        const pk = sched(t + k * dt, p0); const Fk = pk.push === "on" ? pk.F : 0;
        tableStep(st, pk.m, Fk, pk.mu1, pk.mu2, pk.g, dt);
        if (pk.second) tableStep(stB, pk.mB, Fk, pk.mu1, pk.mu2, pk.g, dt);
      }
    } else if (scene === "cloth") {
      const ob = clothObs(st, p, t); const m = p.mObj ?? 1;
      chk("s", st.s, o.s); chk("v", st.v, o.v); chk("a", ob.a, o.a); chk("f", ob.f, o.f); chk("Fnet", ob.f, o.Fnet);
      chk("W", m * p.g, o.W); chk("N", m * p.g, o.N); chk("sCloth", ob.e, o.sCloth); chk("vCloth", p.vCloth, o.vCloth);
      chk("phase", ob.phase, o.phase, false);
      const nF = 2 + (ob.f !== 0 ? 1 : 0); chk("nForces", nF, o.nForces, false); chk("nHoriz", nF - 2, o.nHoriz, false);
      chk("stuck", st.stuck ? 1 : 0, o.stuck, false);
      const dtPull = st.left ? st.leftAt : (st.stuck ? NaN : t);
      if (!st.stuck) chk("dtPull", dtPull, o.dtPull);
      const dv = st.left ? st.dv : st.v; chk("dv", dv, o.dv); chk("J", m * dv, o.J);
      if (st.left) chk("slide", st.s - st.sLeave, o.slide);
      clothStep(st, p, t, dt);
    } else if (scene === "bus") {
      const ob = busObs(st, p, t), b = ob.bus;
      chk("s", st.s, o.s); chk("v", st.v, o.v); chk("a", ob.a, o.a); chk("f", ob.f, o.f); chk("Fhand", ob.Fh, o.Fhand);
      chk("Fnet", ob.f + ob.Fh, o.Fnet); chk("W", MP * p.g, o.W); chk("N", MP * p.g, o.N);
      chk("vBus", b.v, o.vBus); chk("aBusNow", b.a, o.aBusNow); chk("sBus", b.s, o.sBus); chk("sRel", st.s - b.s, o.sRel);
      chk("busPhase", b.phase, o.busPhase, false); chk("sliding", ob.sliding, o.sliding, false);
      const nF = 2 + (ob.f !== 0 ? 1 : 0) + (ob.Fh !== 0 ? 1 : 0); chk("nForces", nF, o.nForces, false); chk("nHoriz", nF - 2, o.nHoriz, false);
      busStep(st, p, t, dt);
    } else if (scene === "space") {
      const a = spaceA(p), Fe = p.engine === "on" ? (p.dir === "backward" ? -1 : 1) * p.Fe : 0;
      chk("s", 0.5 * a * t * t, o.s); chk("v", a * t, o.v); chk("a", a, o.a); chk("Fe", Fe, o.Fe); chk("Fnet", Fe, o.Fnet);
      chk("W", 0, o.W, false); chk("N", 0, o.N, false); chk("fuel", p.engine === "on" ? 0.05 * p.Fe : 0, o.fuel);
      chk("engineOn", p.engine === "on" ? 1 : 0, o.engineOn, false);
      const nF = Fe !== 0 ? 1 : 0; chk("nForces", nF, o.nForces, false); chk("nHoriz", nF, o.nHoriz, false);
      if (p.trio) { chk("sB", 2 * t + 0.5 * a * t * t, o.sB); chk("vB", 2 + a * t, o.vB); chk("sC", -2 * t + 0.5 * a * t * t, o.sC); chk("vC", -2 + a * t, o.vC); }
    }
  }
  return errs;
}

// ---------- 畫面向量檢查 ----------
const KINDS = new Set(["weight", "normal", "friction", "tension", "net", "velocity", "acceleration"]);
function arrowCheck(run, opt = {}) {
  const p0 = run.params, sched = opt.sched || (() => p0);
  const res = { badKind: 0, pseudoLabel: 0, netSumErr: 0, aVsFnet: 0, weightErr: 0, normalErr: 0, frictionErr: 0, appliedErr: 0, velErr: 0, accErr: 0,
    presence: [], normalNotPerp: 0, frictionDir: 0, scaleBad: 0, offAxis: 0, laneBad: 0, appliedCount: { on: 0, off: 0, offFrames: 0 }, ex: {} };
  const scaleSeen = {};
  for (const fr of run.frames) {
    if (fr.meta && fr.meta.done === 1) break;
    const o = fr.obs, t = fr.t, p = sched(t, p0);
    for (const [k, v] of Object.entries(fr.scales)) { scaleSeen[k] = scaleSeen[k] ?? v; if (scaleSeen[k] !== v || v !== 1) res.scaleBad++; }
    const lanes = {};
    for (const a of fr.arrows) {
      if (!KINDS.has(a.kind)) { res.badKind++; res.ex.badKind = a; }
      if (/慣性|pseudo|virtual|fictitious/i.test(a.label ?? "")) res.pseudoLabel++;
      const z = a.origin[2]; if (!Number.isInteger(z) || z < 0 || z > 2) res.laneBad++;
      (lanes[z] ??= []).push(a);
      if (Math.abs(a.vector[2]) > 0) res.offAxis++;
      if (["friction", "tension", "net", "velocity", "acceleration"].includes(a.kind) && Math.abs(a.vector[1]) > 0) res.offAxis++;
      if (["weight", "normal"].includes(a.kind) && (Math.abs(a.vector[0]) > 0 || Math.abs(a.vector[2]) > 0)) res.normalNotPerp++;
    }
    const scene = o.scene;
    for (const [zs, arr] of Object.entries(lanes)) {
      const z = Number(zs);
      const get = k => arr.filter(x => x.kind === k);
      const forces = arr.filter(x => ["weight", "normal", "friction", "tension"].includes(x.kind));
      const sum = [0, 0, 0]; for (const f of forces) for (let i = 0; i < 3; i++) sum[i] += f.vector[i];
      const net = get("net");
      if (net.length) { for (let i = 0; i < 3; i++) res.netSumErr = Math.max(res.netSumErr, Math.abs(net[0].vector[i] - sum[i])); }
      else { const e = Math.hypot(...sum); if (e > 1e-9) { res.netSumErr = Math.max(res.netSumErr, e); res.ex.netMissing = { t, z, sum }; } }
      // 期望值（按泳道）
      let m, v, acc, f, Fapp, W;
      if (scene === 1) { if (z === 0) { m = p.m; v = o.v; acc = o.a; f = o.f; Fapp = o.Fapp; W = o.W; } else { m = p.mB; v = o.vB; acc = o.aB; f = 0; Fapp = o.Fapp; W = p.mB * p.g; } }
      else if (scene === 2) { m = p.mObj ?? 1; v = o.v; acc = o.a; f = o.f; Fapp = 0; W = o.W; }
      else if (scene === 3) { m = MP; v = o.v; acc = o.a; f = o.f; Fapp = o.Fhand; W = o.W; }
      else { m = p.mShip; v = z === 0 ? o.v : z === 1 ? o.vB : o.vC; acc = o.a; f = 0; Fapp = o.Fe; W = 0; }
      const expectPresent = (k, val) => { const g = get(k); if (val !== 0 && g.length !== 1) res.presence.push({ t, z, k, val, n: g.length }); if (val === 0 && g.length !== 0) res.presence.push({ t, z, k, val, n: g.length }); return g[0]; };
      const w = expectPresent("weight", W); if (w) res.weightErr = Math.max(res.weightErr, Math.abs(w.vector[1] + W));
      const n = expectPresent("normal", W); if (n) res.normalErr = Math.max(res.normalErr, Math.abs(n.vector[1] - W));
      const fr_ = expectPresent("friction", f); if (fr_) res.frictionErr = Math.max(res.frictionErr, Math.abs(fr_.vector[0] - f));
      const ap = expectPresent("tension", Fapp); if (ap) res.appliedErr = Math.max(res.appliedErr, Math.abs(ap.vector[0] - Fapp));
      const vl = expectPresent("velocity", v); if (vl) res.velErr = Math.max(res.velErr, Math.abs(vl.vector[0] - v));
      const ac = expectPresent("acceleration", acc); if (ac) res.accErr = Math.max(res.accErr, Math.abs(ac.vector[0] - acc));
      const Fnet = sum[0]; res.aVsFnet = Math.max(res.aVsFnet, Math.abs(acc - Fnet / m));
      if (net.length !== (Fnet !== 0 ? 1 : 0)) res.presence.push({ t, z, k: "net", val: Fnet, n: net.length });
      // 摩擦方向：與相對運動（趨勢）反向
      if (fr_) {
        let vrel = null;
        if (scene === 1) vrel = v; else if (scene === 2) vrel = o.phase === 0 || o.phase === 1 ? v - o.vCloth : v; else if (scene === 3) vrel = v - o.vBus;
        if (vrel !== null && Math.abs(vrel) > 1e-9 && sgn(fr_.vector[0]) !== -sgn(vrel)) { res.frictionDir++; res.ex.frictionDir = { t, z, f: fr_.vector[0], vrel }; }
        if (vrel !== null && Math.abs(vrel) <= 1e-9) { // 靜止：f 反向於「所需力」= 反向於其他水平力（桌面），或同向於接觸面加速度（巴士／桌布）
          if (scene === 1 && Fapp !== 0 && sgn(fr_.vector[0]) !== -sgn(Fapp)) res.frictionDir++;
          if (scene === 3 && o.aBusNow !== 0 && sgn(fr_.vector[0]) !== sgn(o.aBusNow)) res.frictionDir++;
        }
      }
      if (scene === 1 || scene === 3 || scene === 4) { const on = ap ? 1 : 0; if (Fapp !== 0) res.appliedCount.on += on; else { res.appliedCount.offFrames++; res.appliedCount.off += on; } }
    }
  }
  res.presence = res.presence.slice(0, 5).concat(res.presence.length > 5 ? [`… 共 ${res.presence.length}`] : []);
  return res;
}

// ---------- 主程序 ----------
const load = f => JSON.parse(fs.readFileSync(f, "utf8"));
const out = { frameCompare: {}, arrows: {}, conditions: {} };
const rel = tr => (t, b) => (t >= tr - 1e-12 ? { ...b, push: "off" } : b);
const SCHED = { "release-0.8": rel(0.8), "release-1.5": rel(1.5), "release-1.5-mu0.05": rel(1.5), "release-two-blocks": rel(0.5), "long-table": rel(0.8) };
for (const f of fs.readdirSync(EXTRA)) if (f.startsWith("mass-")) SCHED[f.replace(".json", "")] = rel(1.0);

// A. 原 17 個運行（data/）：obs 比對；同時核對 extra-data 同名運行的 obs 完全一致
const idx = load(DATA + "index.json");
for (const r of idx.runs) {
  const run = load(DATA + r.name + ".json");
  out.frameCompare[r.name] = compareRun(run);
  const run2 = load(EXTRA + r.name + ".json");
  let same = run2.frames.length === run.frames.length;
  for (let i = 0; same && i < run.frames.length; i++) same = JSON.stringify(run.frames[i].obs) === JSON.stringify(run2.frames[i].obs);
  out.frameCompare[r.name]._sameAsRerun = same;
  out.arrows[r.name] = arrowCheck(run2);
}
// B. 補跑運行
const extraNames = fs.readdirSync(EXTRA).filter(f => f.endsWith(".json")).map(f => f.replace(".json", "")).filter(n => !idx.runs.some(r => r.name === n));
for (const n of extraNames) {
  const run = load(EXTRA + n + ".json");
  const opt = { sched: SCHED[n], stride: n.startsWith("long-") ? 1000 : 1 };
  out.frameCompare[n] = compareRun(run, opt);
  out.arrows[n] = arrowCheck(run, opt);
}
fs.writeFileSync(ROOT + "audit/independent-results.json", JSON.stringify(out, null, 1));

// 摘要
const tol = { default: 1e-6 };
console.log("=== 逐幀比對（最大相對誤差；整數量為絕對誤差） ===");
for (const [n, e] of Object.entries(out.frameCompare)) {
  const worst = Object.entries(e).filter(([k]) => k !== "_sameAsRerun").sort((a, b) => b[1].e - a[1].e).slice(0, 4).map(([k, v]) => `${k}=${v.e.toExponential(2)}@t=${v.t.toFixed(3)}${v.n ? "(n=" + v.n + " " + JSON.stringify(v.ts) + ")" : ""}`).join("  ");
  console.log(n.padEnd(28), e._sameAsRerun === undefined ? "" : (e._sameAsRerun ? "obs同" : "obs異!"), worst);
}
console.log("\n=== 畫面向量 ===");
for (const [n, r] of Object.entries(out.arrows)) {
  const flags = [];
  if (r.badKind) flags.push("badKind=" + r.badKind); if (r.pseudoLabel) flags.push("pseudo=" + r.pseudoLabel);
  if (r.netSumErr > 1e-9) flags.push("netSum=" + r.netSumErr.toExponential(1)); if (r.aVsFnet > 1e-9) flags.push("a≠F/m=" + r.aVsFnet.toExponential(1));
  for (const k of ["weightErr", "normalErr", "frictionErr", "appliedErr", "velErr", "accErr"]) if (r[k] > 1e-12) flags.push(k + "=" + r[k].toExponential(1));
  if (r.presence.length) flags.push("presence=" + JSON.stringify(r.presence[0]) + (r.presence.length > 1 ? "…" : ""));
  if (r.normalNotPerp) flags.push("normal!perp"); if (r.frictionDir) flags.push("frictionDir=" + r.frictionDir + JSON.stringify(r.ex.frictionDir));
  if (r.scaleBad) flags.push("scale"); if (r.offAxis) flags.push("offAxis"); if (r.laneBad) flags.push("lane");
  if (r.appliedCount.off) flags.push("applied while F=0:" + r.appliedCount.off);
  console.log(n.padEnd(28), flags.length ? flags.join(" ") : "OK");
}
