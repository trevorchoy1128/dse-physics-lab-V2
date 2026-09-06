// 物理核數 第 4 輪（v0.3.0：空氣阻力 F = −k v、k = 0.3；質量 m；預設無第二顆球；photo 圖層）
// 只用規格方程 + 線性阻力解析解 + 自寫 RK4；不讀 model.ts / plan.ts。用法：node --max-old-space-size=12000 audit-r4.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data"), EXTRA = join(HERE, "extra-data-r4");
const K = 0.3, DEG = Math.PI / 180;
const TOL_AN = 1e-6;
const Z_ACC = 0.8, LABEL_Y_X = -3.6, LABEL_X_Y = 0.05, LABEL_X_Z = 1.4, A_LEN = 3.2, F_LEN = 2.4, V_LEN = 4, YCOL_X = -0.9, STROBE = 0.1;
const fmt = (x) => (x === 0 ? "0" : x == null ? "—" : Number.isFinite(x) ? x.toExponential(2) : String(x));
// ---------- 規格方程（無阻力） ----------
const initial = (p) => ({ ux: p.u * Math.cos(p.theta * DEG), uy: p.u * Math.sin(p.theta * DEG) });
const tfNoAir = (uy, h, g) => { const tf = (uy + Math.sqrt(uy * uy + 2 * g * h)) / g; return tf > 0 ? tf : 0; };
const stNoAir = (ux, uy, h, g, t) => ({ x: ux * t, y: h + uy * t - 0.5 * g * t * t, vx: ux, vy: uy - g * t, ax: 0, ay: -g });
// ---------- 線性阻力解析解：m dv/dt = −k v − m g ŷ ----------
function stAir(ux, uy, h, g, m, t) { const b = K / m, vT = g / b, e = Math.exp(-b * t); const vx = ux * e, vy = (uy + vT) * e - vT; return { x: ux / b * (1 - e), y: h + (uy + vT) / b * (1 - e) - vT * t, vx, vy, ax: -b * vx, ay: -g - b * vy }; }
function tfAir(ux, uy, h, g, m) { if (h <= 0 && uy <= 0) return 0; let T = 1; while (stAir(ux, uy, h, g, m, T).y > 0) { T *= 2; if (T > 1e6) return Infinity; } let lo = 0, hi = T; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (stAir(ux, uy, h, g, m, mid).y <= 0) hi = mid; else lo = mid; if (hi - lo < 1e-14 * Math.max(1, hi)) break; } return hi; }
// ---------- 自寫 RK4（交叉核對） ----------
function accel(s, g, m) { return [-(K / m) * s.vx, -g - (K / m) * s.vy]; }
function rk4(s, g, m, h) { const f = (st) => { const a = accel(st, g, m); return [st.vx, st.vy, a[0], a[1]]; }; const add = (st, k, c) => ({ x: st.x + c * k[0], y: st.y + c * k[1], vx: st.vx + c * k[2], vy: st.vy + c * k[3] }); const k1 = f(s), k2 = f(add(s, k1, h / 2)), k3 = f(add(s, k2, h / 2)), k4 = f(add(s, k3, h)); return { x: s.x + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y: s.y + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]), vx: s.vx + h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]), vy: s.vy + h / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]) }; }
function rk4Frames(init, g, m, times, sub = 1e-4) { const out = []; let s = { ...init }, t = 0, landed = init.y <= 0 && init.vy <= 0, tf = landed ? 0 : null; for (const T of times) { while (!landed && t < T - 1e-15) { const h = Math.min(sub, T - t); const s2 = rk4(s, g, m, h); if (s2.y <= 0) { let lo = 0, hi = h; for (let it = 0; it < 80; it++) { const mid = (lo + hi) / 2; if (rk4(s, g, m, mid).y <= 0) hi = mid; else lo = mid; if (hi - lo < 1e-14) break; } s = { ...rk4(s, g, m, hi), y: 0 }; tf = t + hi; t = tf; landed = true; break; } s = s2; t += h; } out.push({ ...s, t: landed ? tf : t }); } return { frames: out, tf }; }
function loadRuns(dir) { const idx = JSON.parse(readFileSync(join(dir, "index.json"), "utf8")); return idx.runs.map((r) => r.name); }
const loadRun = (dir, name) => JSON.parse(readFileSync(join(dir, name + ".json"), "utf8"));
class Err { constructor(name, scale = 1) { this.name = name; this.scale = scale; this.max = 0; this.at = null; this.maxRel = 0; }
  add(obs, exp, t) { const e = Math.abs(obs - exp); const rel = e / Math.max(Math.abs(exp), this.scale); if (!Number.isFinite(e)) { this.max = NaN; this.maxRel = NaN; this.at = t; return; } if (rel > this.maxRel || this.at === null) { this.maxRel = rel; this.max = e; this.at = t; } }
  row(tol) { return { q: this.name, absMax: this.max, relMax: this.maxRel, at: this.at, pass: Number.isFinite(this.maxRel) && this.maxRel <= tol }; } }
const d3 = (u, w) => Math.max(Math.abs(u[0] - w[0]), Math.abs(u[1] - w[1]), Math.abs(u[2] - w[2]));

function auditRun(run, source) {
  const p = run.params, g = p.g, m = p.m ?? 1, air = !!p.air, dt = run.dt, fr = run.frames, N = fr.length;
  const { ux, uy } = initial(p); const times = fr.map((_, i) => i * dt);
  const hasB = p.companion !== "none"; const initB = p.companion === "drop" ? { x: 0, y: p.h, vx: 0, vy: 0 } : { x: 0, y: p.h, vx: 2 * ux, vy: uy };
  const mk = (ini) => { const tf = air ? tfAir(ini.vx, ini.vy, ini.y, g, m) : tfNoAir(ini.vy, ini.y, g); return { tf, frames: times.map((t) => { const tt = Math.min(t, tf); const s = air ? stAir(ini.vx, ini.vy, ini.y, g, m, tt) : stNoAir(ini.vx, ini.vy, ini.y, g, tt); if (t >= tf) s.y = 0; return { ...s, t: tt }; }) }; };
  const A = mk({ x: 0, y: p.h, vx: ux, vy: uy }), B = hasB ? mk(initB) : null;
  const RK = air ? rk4Frames({ x: 0, y: p.h, vx: ux, vy: uy }, g, m, times) : null;
  const tfAll = Math.max(A.tf, B ? B.tf : 0);
  const tol = TOL_AN;
  const vRef = Math.sqrt(p.u * p.u + 2 * g * p.h), aMax = g + (air ? (K / m) * vRef : 0);
  const sV = p.u, sL = Math.max(p.h, p.u * p.u / g, 1), sA = g, sE = 0.5 * m * vRef * vRef;
  const E = { t: new Err("t", 1), tf: new Err("tf", 1), x: new Err("x", sL), y: new Err("y", sL), vx: new Err("vx", sV), vy: new Err("vy", sV), v: new Err("v", sV), ax: new Err("ax", sA), ay: new Err("ay", sA), Ek: new Err("Ek", sE), H: new Err("H", sL), xB: new Err("xB", sL), yB: new Err("yB", sL), EkB: new Err("EkB", sE), rkx: new Err("x(RK4)", sL), rky: new Err("y(RK4)", sL), rkvx: new Err("vx(RK4)", sV), rkvy: new Err("vy(RK4)", sV) };
  const vec = {}; const vmax = (k, v) => { vec[k] = Math.max(vec[k] ?? 0, v); };
  const issues = []; const issue = (s) => issues.push(s);
  let accLenMin = Infinity, accLenMax = -Infinity, vxMin = Infinity, vxMax = -Infinity, vxMonoBad = 0;
  let arrowsAfterLandA = 0, arrowsAfterLandB = 0, missingArrowsBeforeLand = 0; const unexpectedKinds = new Set();
  const scales0 = JSON.stringify(fr[0].scales); let scaleChanges = 0, kChanges = 0; const k0 = fr[0].meta.k;
  let nonFinite = 0, Emin = Infinity, Emax = -Infinity, EmaxRise = 0, Eprev = null, Wdrag = 0, Wprev = null, E0 = null, EmaxWorkErr = 0;
  let ayAfterLanding = null, axAfterLanding = null, firstFrozen = null, doneFirst = null, tAfterDoneChanges = 0, doneBeforeLanded = 0, metaLandedBad = 0, metaMBad = 0;
  const strobe = []; let topFrame = null; let EkMinData = Infinity, EkMaxData = -Infinity;
  const bod = {}; const bmax = (k, v) => { bod[k] = Math.max(bod[k] ?? 0, v); }; let strobeCountBad = 0, bodyFrames = 0; const bodyKindsUnexpected = new Set(); let ghostChecked = false;
  for (let i = 0; i < N; i++) {
    const f = fr[i], o = f.obs, t = i * dt; const eA = A.frames[i], eB = B ? B.frames[i] : null;
    const tExp = Math.min(t, tfAll);
    const landedA = t >= A.tf - 1e-12, landedB = B ? t >= B.tf - 1e-12 : true;
    const scan = (v) => { if (typeof v === "number") { if (!Number.isFinite(v)) nonFinite++; } else if (Array.isArray(v)) v.forEach(scan); else if (v && typeof v === "object") Object.values(v).forEach(scan); };
    scan(o); scan(f.arrows); scan(f.scales); scan(f.meta); scan(f.labels); if (f.bodies) scan(f.bodies);
    E.t.add(o.t, tExp, t); E.tf.add(o.tf, Math.min(t, A.tf), t);
    if (Math.abs(f.t - o.t) > 1e-12) issue("frame " + i + ": frame.t != obs.t");
    E.x.add(o.x, eA.x, t); E.y.add(o.y, eA.y, t); E.vx.add(o.vx, eA.vx, t); E.vy.add(o.vy, eA.vy, t); E.v.add(o.v, Math.hypot(eA.vx, eA.vy), t); E.Ek.add(o.Ek, 0.5 * m * (eA.vx ** 2 + eA.vy ** 2), t);
    E.H.add(o.H, p.h + (uy > 0 ? uy * uy / (2 * g) : 0), t);
    if (RK) { const r = RK.frames[i]; E.rkx.add(o.x, r.x, t); E.rky.add(o.y, r.y, t); E.rkvx.add(o.vx, r.vx, t); E.rkvy.add(o.vy, r.vy, t); }
    if (!landedA) { E.ax.add(o.ax, eA.ax, t); E.ay.add(o.ay, eA.ay, t); vxMin = Math.min(vxMin, o.vx); vxMax = Math.max(vxMax, o.vx); if (air && i > 0 && o.vx > fr[i - 1].obs.vx + 1e-15 && ux > 0) vxMonoBad++; EkMinData = Math.min(EkMinData, o.Ek); EkMaxData = Math.max(EkMaxData, o.Ek); }
    else if (ayAfterLanding === null) { ayAfterLanding = o.ay; axAfterLanding = o.ax; firstFrozen = i; }
    if (eB) { E.xB.add(o.xB, eB.x, t); E.yB.add(o.yB, eB.y, t); E.EkB.add(o.EkB, 0.5 * m * (eB.vx ** 2 + eB.vy ** 2), t); }
    const Etot = o.Ek + m * g * o.y; if (!landedA) { Emin = Math.min(Emin, Etot); Emax = Math.max(Emax, Etot); if (Eprev !== null) EmaxRise = Math.max(EmaxRise, Etot - Eprev); if (E0 === null) E0 = Etot; const P = K * (o.vx ** 2 + o.vy ** 2); if (Wprev !== null) Wdrag += 0.5 * (P + Wprev) * dt; Wprev = P; if (air && i > 0) EmaxWorkErr = Math.max(EmaxWorkErr, Math.abs((E0 - Etot) - Wdrag)); Eprev = Etot; }
    if (!landedA && Math.abs(t / STROBE - Math.round(t / STROBE)) < 1e-9) strobe.push({ t, x: o.x, y: o.y });
    if (topFrame === null && i > 0 && fr[i - 1].obs.vy > 0 && o.vy <= 0) topFrame = i;
    if (JSON.stringify(f.scales) !== scales0) scaleChanges++; if (f.meta.k !== k0) kChanges++;
    if ((!!f.meta.landedA) !== landedA || (!!f.meta.landedB) !== (B ? landedB : false)) metaLandedBad++;
    if (f.meta.m !== m || (!!f.meta.air) !== air || (!!f.meta.hasB) !== hasB || (!!f.meta.dropB) !== (p.companion === "drop")) metaMBad++;
    if (f.done !== undefined && f.done !== null) { if (f.done && doneFirst === null) doneFirst = i; if (f.done && !(landedA && landedB)) doneBeforeLanded++; if (doneFirst !== null && i > doneFirst && Math.abs(o.t - fr[doneFirst].obs.t) > 1e-12) tAfterDoneChanges++; }
    const k = f.meta.k, zOff = f.meta.zOff, r = f.meta.r;
    const arrA = f.arrows.filter((a) => a.origin[2] === 0 || a.origin[2] === Z_ACC), arrB = f.arrows.filter((a) => a.origin[2] === -zOff);
    if (arrA.length + arrB.length !== f.arrows.length) issue("frame " + i + ": arrow z not A/B");
    for (const a of f.arrows) if (!["velocity", "acceleration", "weight", "friction"].includes(a.kind)) unexpectedKinds.add(a.kind);
    if (landedA) { if (arrA.length) arrowsAfterLandA++; }
    else {
      const get = (layer) => arrA.find((a) => a.layer === layer);
      const vA = get("velocity"), vxA = get("vx"), vyA = get("vy"), aA = get("acceleration"), wA = get("weight"), fA = get("air");
      if (!vA || !vxA || !vyA || !aA || !wA || (air && !fA)) missingArrowsBeforeLand++;
      if (vA) { vmax("velA", d3(vA.vector, [o.vx, o.vy, 0])); vmax("orgA", d3(vA.origin, [o.x * k, o.y * k + r, 0])); if (vA.kind !== "velocity") issue("frame " + i + ": v kind " + vA.kind); vmax("vDrawnLenOver", Math.max(0, Math.hypot(...vA.vector) * f.scales.velocity - V_LEN)); }
      if (vxA) vmax("vxA", d3(vxA.vector, [o.vx, 0, 0])); if (vyA) vmax("vyA", d3(vyA.vector, [0, o.vy, 0]));
      if (aA) { vmax("accA", d3(aA.vector, [o.ax, o.ay, 0])); vmax("accA_vs_mine_rel", d3(aA.vector, [eA.ax, eA.ay, 0]) / g); vmax("orgAcc", d3(aA.origin, [o.x * k, o.y * k + r, Z_ACC])); const len = Math.hypot(...aA.vector); accLenMin = Math.min(accLenMin, len); accLenMax = Math.max(accLenMax, len); if (aA.kind !== "acceleration") issue("frame " + i + ": a kind " + aA.kind); if (!air) vmax("accDrawnLen", Math.abs(len * f.scales.acceleration - A_LEN)); else vmax("accDrawnLenOver", Math.max(0, len * f.scales.acceleration - A_LEN)); }
      if (wA) { vmax("wA", d3(wA.vector, [0, -m * g, 0])); vmax("orgW", d3(wA.origin, [o.x * k, o.y * k + r, 0])); if (wA.kind !== "weight") issue("frame " + i + ": W kind " + wA.kind); if (!air) vmax("wDrawnLen", Math.abs(Math.hypot(...wA.vector) * f.scales.weight - F_LEN)); }
      if (fA) { vmax("fricA", d3(fA.vector, [-K * o.vx, -K * o.vy, 0])); vmax("fricA_vs_mine", d3(fA.vector, [-K * eA.vx, -K * eA.vy, 0])); if (fA.kind !== "friction") issue("frame " + i + ": drag kind " + fA.kind); if (f.scales.friction !== f.scales.weight) issue("frame " + i + ": friction scale != weight scale"); const dot = fA.vector[0] * o.vx + fA.vector[1] * o.vy; if (dot > 0) issue("frame " + i + ": drag along v"); const cr = fA.vector[0] * o.vy - fA.vector[1] * o.vx; vmax("fricCrossSin", Math.abs(cr) / Math.max(1e-12, Math.hypot(o.vx, o.vy) * Math.hypot(fA.vector[0], fA.vector[1]))); }
      if (!air && fA) issue("frame " + i + ": drag arrow without air");
      if (aA) { const forces = arrA.filter((a) => a.kind === "weight" || a.kind === "friction"); const sum = [0, 0, 0]; for (const q of forces) for (let j = 0; j < 3; j++) sum[j] += q.vector[j]; vmax("fsum_minus_ma", d3(sum, aA.vector.map((c) => m * c))); }
      if (vA && vxA && vyA) vmax("vcomp", d3(vxA.vector.map((c, j) => c + vyA.vector[j]), vA.vector));
      const nA = arrA.length; if (nA !== (air ? 6 : 5)) issue("frame " + i + ": A arrows " + nA);
    }
    if (B) { if (landedB) { if (arrB.length) arrowsAfterLandB++; } else { const get = (layer) => arrB.find((a) => a.layer === layer); const vB = get("velocity"), vxB = get("vx"), vyB = get("vy"); if (!vB || !vxB || !vyB) missingArrowsBeforeLand++; if (vB) { vmax("velB", d3(vB.vector, [eB.vx, eB.vy, 0])); vmax("orgB", d3(vB.origin, [o.xB * k, o.yB * k + r, -zOff])); } if (vxB) vmax("vxB", d3(vxB.vector, [eB.vx, 0, 0])); if (vyB) vmax("vyB", d3(vyB.vector, [0, eB.vy, 0])); if (arrB.some((a) => a.kind !== "velocity")) issue("frame " + i + ": B non-velocity arrow"); } }
    else if (arrB.length) issue("frame " + i + ": B arrows without B");
    const lx = f.labels.find((l) => l.symbol === "x"), ly = f.labels.find((l) => l.symbol === "y");
    if (lx) { vmax("labX", Math.abs(lx.value - o.x)); vmax("labXpos", d3(lx.position, [o.x * k, LABEL_X_Y, LABEL_X_Z])); } else issue("frame " + i + ": no x label");
    if (ly) { vmax("labY", Math.abs(ly.value - o.y)); vmax("labYpos", d3(ly.position, [LABEL_Y_X, o.y * k + r, 0])); } else issue("frame " + i + ": no y label");
    for (const l of f.labels) if (l.position[1] < 0) issue("frame " + i + ": label below ground");
    if (f.bodies) {
      bodyFrames++;
      const by = {}; for (const b of f.bodies) { by[b.key] = b; const pre = b.key.replace(/-\d+$/, ""); if (!["ball-a", "ball-b", "gshadow-a", "gshadow-b", "strobe-a", "shadow-a", "wall-a", "ycol-a", "strobe-b", "shadow-b"].includes(pre)) bodyKindsUnexpected.add(pre); }
      const sideZ = f.meta.sideZ;
      if (by["ball-a"]) { bmax("ballA", d3(by["ball-a"].position, [o.x * k, o.y * k + r, 0])); if (by["ball-a"].shape !== "sphere" || by["ball-a"].size[0] !== r) issue("frame " + i + ": ball-a shape/radius"); } else issue("frame " + i + ": no ball-a");
      if (by["gshadow-a"]) bmax("gshA", d3(by["gshadow-a"].position, [o.x * k, 0.015, 0])); else issue("frame " + i + ": no gshadow-a");
      if (B) { if (by["ball-b"]) bmax("ballB", d3(by["ball-b"].position, [o.xB * k, o.yB * k + r, -zOff])); else issue("frame " + i + ": no ball-b"); if (by["gshadow-b"]) bmax("gshB", d3(by["gshadow-b"].position, [o.xB * k, 0.015, -zOff])); else issue("frame " + i + ": no gshadow-b"); }
      else if (by["ball-b"] || by["gshadow-b"]) issue("frame " + i + ": ball-b without B");
      const tLimA = Math.min(t, A.tf) + 1e-9; const nStrA = Math.floor(tLimA / STROBE) + 1;
      const cntA = f.bodies.filter((b) => b.key.startsWith("strobe-a-")).length; if (cntA !== nStrA) { strobeCountBad++; if (strobeCountBad < 3) issue("frame " + i + ": strobe-a count " + cntA + " != " + nStrA); }
      for (let j = 0; j < cntA; j++) { const tt = Math.min(j * STROBE, A.tf); const e = air ? stAir(ux, uy, p.h, g, m, tt) : stNoAir(ux, uy, p.h, g, tt); if (j * STROBE >= A.tf) e.y = 0; const P = [e.x * k, e.y * k + r];
        const s = by["strobe-a-" + j], sh = by["shadow-a-" + j], w = by["wall-a-" + j], yc = by["ycol-a-" + j];
        if (s) bmax("strobeA", d3(s.position, [P[0], P[1], 0])); else issue("frame " + i + ": no strobe-a-" + j);
        if (sh) bmax("shadowA", d3(sh.position, [P[0], 0.01, 0])); else issue("frame " + i + ": no shadow-a-" + j);
        if (w) bmax("wallA", d3(w.position, [P[0], P[1], sideZ])); else issue("frame " + i + ": no wall-a-" + j);
        if (f.meta.dropB) { if (yc) issue("frame " + i + ": ycol with drop"); } else if (yc) bmax("ycolA", d3(yc.position, [YCOL_X, P[1], sideZ])); else issue("frame " + i + ": no ycol-a-" + j); }
      if (B) { const tLimB = Math.min(t, B.tf) + 1e-9; const nStrB = Math.floor(tLimB / STROBE) + 1; const cntB = f.bodies.filter((b) => b.key.startsWith("strobe-b-")).length; if (cntB !== nStrB) { strobeCountBad++; if (strobeCountBad < 3) issue("frame " + i + ": strobe-b count " + cntB + " != " + nStrB); }
        for (let j = 0; j < cntB; j++) { const tt = Math.min(j * STROBE, B.tf); const e = air ? stAir(initB.vx, initB.vy, initB.y, g, m, tt) : stNoAir(initB.vx, initB.vy, initB.y, g, tt); if (j * STROBE >= B.tf) e.y = 0; const P = [e.x * k, e.y * k + r]; const s = by["strobe-b-" + j], sh = by["shadow-b-" + j]; if (s) bmax("strobeB", d3(s.position, [P[0], P[1], -zOff])); if (sh) bmax("shadowB", d3(sh.position, [P[0], 0.01, -zOff])); } }
      const tr = Object.fromEntries((f.trails ?? []).map((q) => [q.key, q]));
      if (tr["path-a"]) { bmax("pathAlast", d3(tr["path-a"].last, [o.x * k, o.y * k + r, 0])); bmax("pathAfirst", d3(tr["path-a"].first, [0, p.h * k + r, 0])); }
      if (B && tr["path-b"]) bmax("pathBlast", d3(tr["path-b"].last, [o.xB * k, o.yB * k + r, -zOff]));
      if (B && tr["sync"]) bmax("sync", Math.max(d3(tr["sync"].first, [o.x * k, o.y * k + r, 0]), d3(tr["sync"].last, [o.xB * k, o.yB * k + r, -zOff])));
      if (tr["proj-top-a"]) bmax("projTopLastX", Math.abs(tr["proj-top-a"].last[0] - o.x * k));
      if (tr["proj-side-a"]) bmax("projSideLastY", Math.abs(tr["proj-side-a"].last[1] - (o.y * k + r)));
      if (tr["Ek-t"]) { const q = tr["Ek-t"].last; bmax("EkTrailT", Math.abs(q[0] - o.t)); bmax("EkTrailErel", Math.abs(q[1] - o.Ek) / Math.max(1, sE)); }
      if (!ghostChecked) { ghostChecked = true; for (const th of [15, 30, 45, 60, 75]) { const q = tr["ghost-" + th]; if (!q) { issue("no ghost-" + th); continue; } const uyg = p.u * Math.sin(th * DEG), uxg = p.u * Math.cos(th * DEG); const Rg = uxg * tfNoAir(uyg, p.h, g); bmax("ghostFirst", d3(q.first, [0, p.h * k + r, 0])); bmax("ghostLastX", Math.abs(q.last[0] - Rg * k)); bmax("ghostLastY", Math.abs(q.last[1] - r)); } }
    }
  }
  const last = fr[N - 1].obs; const tUpAn = uy > 0 ? (air ? Math.log(1 + uy * K / (m * g)) * m / K : uy / g) : 0;
  let tUpData = null; if (topFrame !== null) { const a = fr[topFrame - 1].obs, b = fr[topFrame].obs; tUpData = a.t + (b.t - a.t) * a.vy / (a.vy - b.vy); }
  let symMax = 0; if (!air && p.h === 0 && uy > 0) { for (let i = 0; i < N; i++) { const t = i * dt; if (t > tUpAn) break; const j = Math.round((2 * tUpAn - t) / dt); if (j < N && j * dt <= A.tf) symMax = Math.max(symMax, Math.abs(fr[i].obs.y - fr[j].obs.y)); } }
  const strobeDx = strobe.slice(1).map((s, i) => s.x - strobe[i].x), strobeDy = strobe.slice(1).map((s, i) => s.y - strobe[i].y);
  const dxSpread = strobeDx.length ? Math.max(...strobeDx) - Math.min(...strobeDx) : null; const dyDecr = strobeDy.length > 1 ? strobeDy.slice(1).every((d, i) => d < strobeDy[i]) : null;
  const sc = fr[0].scales; const mt = fr[0].meta;
  const metaTfExp = (air ? 1.5 * tfNoAir(uy, p.h, g) : A.tf) + 0.3;
  const rows = Object.values(E).map((e) => e.row(tol)).filter((r) => r.at !== null);
  const EkMinAn = !air ? 0.5 * m * (uy > 0 ? ux * ux : p.u * p.u) : null, EkMaxAn = !air ? 0.5 * m * vRef * vRef : null;
  return { name: run.name, source, params: p, frames: N, air, m, tol,
    expected: { ux, uy, tfA: A.tf, tfB: B ? B.tf : null, tfRK4: RK ? RK.tf : null, tUp: tUpAn, R: !air && p.h === 0 ? p.u * p.u * Math.sin(2 * p.theta * DEG) / g : null, landingSpeed: A.tf <= (N - 1) * dt ? Math.hypot(A.frames[N - 1].vx, A.frames[N - 1].vy) : null, vT: air ? m * g / K : null, metaTf: metaTfExp, EkMinAn, EkMaxAn, vRef, aMax, xInfAir: air ? ux * m / K : null },
    data: { tfLast: last.tf, tLast: last.t, xLast: last.x, yLast: last.y, vLast: last.v, vxLast: last.vx, vyLast: last.vy, tUpData, metaTf: mt.tf, EkMin: mt.EkMin, EkMax: mt.EkMax, EkMinData, EkMaxData, firstFrozenFrame: firstFrozen, ayAfterLanding, axAfterLanding, xBLast: last.xB, yBLast: last.yB, doneFirst, doneAt: run.doneAt ?? null, tAfterDoneChanges, doneBeforeLanded, windowCoversLanding: A.tf <= mt.tf && (B ? B.tf <= mt.tf : true) },
    rows, vec, bod, bodyFrames, accLen: { min: accLenMin, max: accLenMax }, vxRange: { min: vxMin, max: vxMax, spread: vxMax - vxMin, monoBad: vxMonoBad }, symMax,
    strobe: { n: strobe.length, dxSpread, dyDecr, dx: strobeDx.slice(0, 4), dy: strobeDy.slice(0, 4) }, energy: { min: Emin, max: Emax, drift: Emax - Emin, maxRise: EmaxRise, workErr: EmaxWorkErr, E0, Wdrag },
    scales: { ...sc, vScaleExp: V_LEN / vRef, aScaleExp: A_LEN / aMax, wScaleExp: F_LEN / (m * aMax), fricEqW: sc.friction === sc.weight },
    flags: { arrowsAfterLandA, arrowsAfterLandB, missingArrowsBeforeLand, scaleChanges, kChanges, nonFinite, unexpectedKinds: [...unexpectedKinds], strobeCountBad, bodyKindsUnexpected: [...bodyKindsUnexpected], metaLandedBad, metaMBad, k: k0 },
    issues: issues.slice(0, 12), issueCount: issues.length };
}

const results = []; const consistency = [];
for (const n of loadRuns(DATA)) results.push(auditRun(loadRun(DATA, n), "data"));
if (existsSync(join(EXTRA, "index.json"))) for (const n of loadRuns(EXTRA)) { const r = loadRun(EXTRA, n); results.push(auditRun(r, "extra"));
  if (n.startsWith("official-") && !n.endsWith("-long")) { const name = n.replace("official-", ""); const d = loadRun(DATA, name); let diff = 0, first = null; for (let i = 0; i < d.frames.length; i++) { const a = d.frames[i], b = r.frames[i]; if (JSON.stringify([a.obs, a.arrows, a.labels, a.scales, a.meta]) !== JSON.stringify([b.obs, b.arrows, b.labels, b.scales, b.meta])) { diff++; if (first === null) first = i; } } consistency.push({ name, diffFrames: diff, first }); } }
writeFileSync(join(HERE, "results-r4.json"), JSON.stringify({ results, consistency }, null, 1));
console.log("## 重匯出一致性", JSON.stringify(consistency));
for (const r of results) {
  const bad = r.rows.filter((x) => !x.pass);
  console.log("\n## " + r.name + " [" + r.source + "] air=" + r.air + " u=" + r.params.u + " th=" + r.params.theta + " h=" + r.params.h + " g=" + r.params.g + " m=" + r.m + " comp=" + r.params.companion + " N=" + r.frames);
  console.log("  tf analytic A=" + r.expected.tfA + " B=" + r.expected.tfB + " RK4=" + r.expected.tfRK4 + " | data tf=" + r.data.tfLast + " t=" + r.data.tLast + " | meta.tf=" + r.data.metaTf + " rule=" + r.expected.metaTf + " windowCoversLanding=" + r.data.windowCoversLanding + " | doneFirst=" + r.data.doneFirst + " doneAt=" + r.data.doneAt + " tAfterDone=" + r.data.tAfterDoneChanges + " doneBeforeLanded=" + r.data.doneBeforeLanded);
  console.log("  frames: " + r.rows.map((x) => x.q + "=" + fmt(x.relMax) + "@" + x.at?.toFixed(3) + (x.pass ? "" : "X")).join(" "));
  console.log("  arrows: " + Object.entries(r.vec).map(([k, v]) => k + "=" + fmt(v)).join(" "));
  if (Object.keys(r.bod).length) console.log("  bodies(" + r.bodyFrames + "): " + Object.entries(r.bod).map(([k, v]) => k + "=" + fmt(v)).join(" "));
  console.log("  scales: v=" + r.scales.velocity + " (exp " + r.scales.vScaleExp + ") a=" + r.scales.acceleration + " (exp " + r.scales.aScaleExp + ") W=" + r.scales.weight + " (exp " + r.scales.wScaleExp + ") fric=W:" + r.scales.fricEqW + " | vRef=" + r.expected.vRef + " aMax=" + r.expected.aMax);
  console.log("  |a| " + r.accLen.min + ".." + r.accLen.max + " | vx spread " + fmt(r.vxRange.spread) + " (" + r.vxRange.max + "->" + r.vxRange.min + ") monoBad " + r.vxRange.monoBad + " | sym " + fmt(r.symMax) + " | vLand " + r.data.vLast + " (exp " + r.expected.landingSpeed + ") | tUp data " + r.data.tUpData + " exp " + r.expected.tUp + " | vT=" + r.expected.vT + " xInf=" + r.expected.xInfAir);
  console.log("  strobe n=" + r.strobe.n + " dxSpread=" + fmt(r.strobe.dxSpread) + " dyDecr=" + r.strobe.dyDecr + " | Edrift=" + fmt(r.energy.drift) + " maxRise=" + fmt(r.energy.maxRise) + " workErr=" + fmt(r.energy.workErr) + " (E0=" + r.energy.E0 + " W=" + r.energy.Wdrag + ") | after landing ax,ay=" + r.data.axAfterLanding + "," + r.data.ayAfterLanding + " firstFrozen=" + r.data.firstFrozenFrame);
  console.log("  meta EkMin=" + r.data.EkMin + " (an " + r.expected.EkMinAn + " data " + r.data.EkMinData + ") EkMax=" + r.data.EkMax + " (an " + r.expected.EkMaxAn + " data " + r.data.EkMaxData + ")");
  console.log("  flags: " + JSON.stringify(r.flags) + " | issues=" + r.issueCount + " " + r.issues.slice(0, 4).join("; "));
  if (bad.length) console.log("  X FAIL: " + bad.map((x) => x.q).join(","));
}
