// 物理核數 第 2 輪（v0.2.0）：拋體運動（Book 2 模擬器 2）獨立計算與逐幀比對
// 只用規格方程與自己的 RK4；不讀 model.ts / plan.ts。
// 用法：node audit-r2.mjs  →  印出摘要並寫 results-r2.json
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data");
const EXTRA = join(HERE, "extra-data-r2");
const K_AIR = 0.01, M = 1, DEG = Math.PI / 180;
const TOL_AN = 1e-6, TOL_NUM = 1e-4, TOL_VEC = 1e-9;
const Z_ACC = 0.8;            // 本輪：加速度箭嘴起點 z 偏移 0.8
const LABEL_Y_X = -3.6;       // 本輪：y 標籤 x = −3.6
const LABEL_X_Y = -0.9;
const A_LEN = 3.2, F_LEN = 2.4; // 本輪：加速度箭嘴 3.2 世界單位、力 2.4 世界單位
const YCOL_X = -0.9;          // 牆左緣高度影子列 x
const STROBE = 0.1;
const fmt = (x) => (x === 0 ? "0" : x == null ? "—" : Number.isFinite(x) ? x.toExponential(2) : String(x));

// ---------- 規格方程 ----------
const initial = (p) => ({ ux: p.u * Math.cos(p.theta * DEG), uy: p.u * Math.sin(p.theta * DEG) });
function tfAnalytic(uy, h, g) { const tf = (uy + Math.sqrt(uy * uy + 2 * g * h)) / g; return tf > 0 ? tf : 0; }
const stateAnalytic = (ux, uy, h, g, t) => ({ x: ux * t, y: h + uy * t - 0.5 * g * t * t, vx: ux, vy: uy - g * t, ax: 0, ay: -g });
// ---------- 自己的 RK4 ----------
function accel(s, g, air) { if (!air) return [0, -g]; const v = Math.hypot(s.vx, s.vy); return [-K_AIR * v * s.vx, -g - K_AIR * v * s.vy]; }
function rk4(s, g, air, h) {
  const f = (st) => { const a = accel(st, g, air); return [st.vx, st.vy, a[0], a[1]]; };
  const add = (st, k, c) => ({ x: st.x + c * k[0], y: st.y + c * k[1], vx: st.vx + c * k[2], vy: st.vy + c * k[3] });
  const k1 = f(s), k2 = f(add(s, k1, h / 2)), k3 = f(add(s, k2, h / 2)), k4 = f(add(s, k3, h));
  return { x: s.x + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y: s.y + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]), vx: s.vx + h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]), vy: s.vy + h / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]) };
}
function integrateBall(init, g, air, times, subdt = 1e-4) {
  const out = []; let s = { ...init }; let t = 0; let landed = init.y === 0 && init.vy <= 0; let tf = landed ? 0 : null;
  if (landed) { for (const _ of times) out.push({ ...s, t: 0 }); return { frames: out, tf: 0 }; }
  for (const T of times) {
    while (!landed && t < T - 1e-15) {
      const h = Math.min(subdt, T - t); const s2 = rk4(s, g, air, h);
      if (s2.y <= 0) { let lo = 0, hi = h; for (let it = 0; it < 80; it++) { const mid = (lo + hi) / 2; if (rk4(s, g, air, mid).y <= 0) hi = mid; else lo = mid; if (hi - lo < 1e-13) break; } const sf = rk4(s, g, air, hi); tf = t + hi; s = { ...sf, y: 0 }; t = tf; landed = true; break; }
      s = s2; t += h;
    }
    out.push({ ...s, t: landed ? tf : t });
  }
  return { frames: out, tf };
}
function loadRuns(dir) { const idx = JSON.parse(readFileSync(join(dir, "index.json"), "utf8")); return idx.runs.map((r) => ({ ...r, ...JSON.parse(readFileSync(join(dir, r.name + ".json"), "utf8")) })); }
class Err { constructor(name, scale = 1) { this.name = name; this.scale = scale; this.max = 0; this.at = null; this.maxRel = 0; }
  add(obs, exp, t) { const e = Math.abs(obs - exp); const rel = e / Math.max(Math.abs(exp), this.scale); if (!Number.isFinite(e)) { this.max = NaN; this.maxRel = NaN; this.at = t; return; } if (rel > this.maxRel || this.at === null) { this.maxRel = rel; this.max = e; this.at = t; } }
  row(tol) { return { q: this.name, absMax: this.max, relMax: this.maxRel, at: this.at, pass: Number.isFinite(this.maxRel) && this.maxRel <= tol }; } }
const d3 = (u, w) => Math.max(Math.abs(u[0] - w[0]), Math.abs(u[1] - w[1]), Math.abs(u[2] - w[2]));

function auditRun(run, source) {
  const p = run.params, g = p.g, air = !!p.air, dt = run.dt, fr = run.frames, N = fr.length;
  const { ux, uy } = initial(p); const times = fr.map((_, i) => i * dt);
  const hasB = p.companion !== "none";
  const initB = p.companion === "drop" ? { x: 0, y: p.h, vx: 0, vy: 0 } : { x: 0, y: p.h, vx: 2 * ux, vy: uy };
  let A, B = null;
  if (!air) {
    const tfA = tfAnalytic(uy, p.h, g); A = { tf: tfA, frames: times.map((t) => { const tt = Math.min(t, tfA); return { ...stateAnalytic(ux, uy, p.h, g, tt), t: tt }; }) };
    if (hasB) { const tfB = tfAnalytic(initB.vy, p.h, g); B = { tf: tfB, frames: times.map((t) => { const tt = Math.min(t, tfB); return { ...stateAnalytic(initB.vx, initB.vy, p.h, g, tt), t: tt }; }) }; }
  } else { A = integrateBall({ x: 0, y: p.h, vx: ux, vy: uy }, g, air, times); if (hasB) B = integrateBall(initB, g, air, times); }
  const tfAll = Math.max(A.tf ?? Infinity, B ? (B.tf ?? Infinity) : 0);
  const tol = air ? TOL_NUM : TOL_AN;
  const sV = p.u, sL = Math.max(p.h, p.u * p.u / g, 1), sA = g, sE = 0.5 * p.u * p.u + g * p.h;
  const E = { t: new Err("t", 1), tf: new Err("tf", 1), x: new Err("x", sL), y: new Err("y", sL), vx: new Err("vx", sV), vy: new Err("vy", sV), v: new Err("v", sV), ax: new Err("ax", sA), ay: new Err("ay", sA), Ek: new Err("Ek", sE), H: new Err("H", sL), xB: new Err("xB", sL), yB: new Err("yB", sL), EkB: new Err("EkB", sE) };
  const vec = {}; const vmax = (k, v) => { vec[k] = Math.max(vec[k] ?? 0, v); };
  const issues = []; const issue = (s) => issues.push(s);
  let accLenMin = Infinity, accLenMax = -Infinity, vxMin = Infinity, vxMax = -Infinity;
  let arrowsAfterLandA = 0, arrowsAfterLandB = 0, missingArrowsBeforeLand = 0; const unexpectedKinds = new Set();
  const scales0 = JSON.stringify(fr[0].scales); let scaleChanges = 0, kChanges = 0; const k0 = fr[0].meta.k;
  let nonFinite = 0; let Emin = Infinity, Emax = -Infinity, EmaxRise = 0, Eprev = null;
  let ayAfterLanding = null, axAfterLanding = null, firstFrozen = null, doneFirst = null, tAfterDoneChanges = 0, doneBeforeLanded = 0;
  const strobe = []; let topFrame = null;
  const hasBodies = !!fr[0].bodies;
  const bod = {}; const bmax = (k, v) => { bod[k] = Math.max(bod[k] ?? 0, v); }; let strobeCountBad = 0; const bodyKindsUnexpected = new Set(); let ghostChecked = false;
  for (let i = 0; i < N; i++) {
    const f = fr[i], o = f.obs, t = i * dt; const eA = A.frames[i], eB = B ? B.frames[i] : null;
    const tExp = Math.min(t, tfAll === Infinity ? t : tfAll);
    const landedA = A.tf !== null && t >= A.tf - 1e-12; const landedB = B ? (B.tf !== null && t >= B.tf - 1e-12) : true;
    const scan = (v) => { if (typeof v === "number") { if (!Number.isFinite(v)) nonFinite++; } else if (Array.isArray(v)) v.forEach(scan); else if (v && typeof v === "object") Object.values(v).forEach(scan); };
    scan(o); scan(f.arrows); scan(f.scales); scan(f.meta); scan(f.labels); if (f.bodies) scan(f.bodies);
    E.t.add(o.t, tExp, t); E.tf.add(o.tf, Math.min(t, A.tf ?? t), t);
    if (Math.abs(f.t - o.t) > 1e-12) issue(`frame ${i}: frame.t ≠ obs.t`);
    E.x.add(o.x, eA.x, t); E.y.add(o.y, eA.y, t); E.vx.add(o.vx, eA.vx, t); E.vy.add(o.vy, eA.vy, t); E.v.add(o.v, Math.hypot(eA.vx, eA.vy), t); E.Ek.add(o.Ek, 0.5 * M * (eA.vx ** 2 + eA.vy ** 2), t);
    E.H.add(o.H, p.h + (uy > 0 ? uy * uy / (2 * g) : 0), t);
    if (!landedA) { const aE = air ? accel(eA, g, air) : [0, -g]; E.ax.add(o.ax, aE[0], t); E.ay.add(o.ay, aE[1], t); if (!air) { vxMin = Math.min(vxMin, o.vx); vxMax = Math.max(vxMax, o.vx); } }
    else if (ayAfterLanding === null) { ayAfterLanding = o.ay; axAfterLanding = o.ax; firstFrozen = i; }
    if (eB) { E.xB.add(o.xB, eB.x, t); E.yB.add(o.yB, eB.y, t); E.EkB.add(o.EkB, 0.5 * M * (eB.vx ** 2 + eB.vy ** 2), t); }
    const Etot = o.Ek + M * g * o.y; if (!landedA) { Emin = Math.min(Emin, Etot); Emax = Math.max(Emax, Etot); if (Eprev !== null) EmaxRise = Math.max(EmaxRise, Etot - Eprev); Eprev = Etot; }
    if (!landedA && Math.abs(t / STROBE - Math.round(t / STROBE)) < 1e-9) strobe.push({ t, x: o.x, y: o.y });
    if (topFrame === null && i > 0 && fr[i - 1].obs.vy > 0 && o.vy <= 0) topFrame = i;
    if (JSON.stringify(f.scales) !== scales0) scaleChanges++; if (f.meta.k !== k0) kChanges++;
    // done 旗標（extra 匯出才有）
    if (f.done !== undefined && f.done !== null) {
      if (f.done && doneFirst === null) doneFirst = i;
      if (f.done && !(landedA && landedB)) doneBeforeLanded++;
      if (doneFirst !== null && i > doneFirst && Math.abs(o.t - fr[doneFirst].obs.t) > 1e-12) tAfterDoneChanges++;
    }
    // 箭嘴
    const k = f.meta.k, zOff = f.meta.zOff, r = f.meta.r;
    const arrA = f.arrows.filter((a) => a.origin[2] === 0 || a.origin[2] === Z_ACC), arrB = f.arrows.filter((a) => a.origin[2] === -zOff);
    if (arrA.length + arrB.length !== f.arrows.length) issue(`frame ${i}: 箭嘴 z 座標不屬於任一球 (${f.arrows.map((a) => a.origin[2])})`);
    for (const a of f.arrows) if (!["velocity", "acceleration", "weight", "friction"].includes(a.kind)) unexpectedKinds.add(a.kind);
    if (landedA) { if (arrA.length) arrowsAfterLandA++; }
    else {
      const get = (layer) => arrA.find((a) => a.layer === layer);
      const vA = get("velocity"), vxA = get("vx"), vyA = get("vy"), aA = get("acceleration"), wA = get("weight"), fA = get("air");
      if (!vA || !vxA || !vyA || !aA || !wA || (air && !fA)) missingArrowsBeforeLand++;
      if (vA) { vmax("velA", d3(vA.vector, [o.vx, o.vy, 0])); vmax("orgA", d3(vA.origin, [o.x * k, o.y * k + r, 0])); if (vA.kind !== "velocity") issue(`frame ${i}: v kind=${vA.kind}`); }
      if (vxA) vmax("vxA", d3(vxA.vector, [o.vx, 0, 0])); if (vyA) vmax("vyA", d3(vyA.vector, [0, o.vy, 0]));
      if (aA) { vmax("accA", d3(aA.vector, [o.ax, o.ay, 0])); vmax("orgAcc", d3(aA.origin, [o.x * k, o.y * k + r, Z_ACC])); const len = Math.hypot(...aA.vector); accLenMin = Math.min(accLenMin, len); accLenMax = Math.max(accLenMax, len); if (aA.kind !== "acceleration") issue(`frame ${i}: a kind=${aA.kind}`);
        if (!air) vmax("accDrawnLen", Math.abs(len * f.scales.acceleration - A_LEN)); }
      if (wA) { vmax("wA", d3(wA.vector, [0, -M * g, 0])); vmax("orgW", d3(wA.origin, [o.x * k, o.y * k + r, 0])); if (wA.kind !== "weight") issue(`frame ${i}: W kind=${wA.kind}`); vmax("wDrawnLen", Math.abs(Math.hypot(...wA.vector) * f.scales.weight - F_LEN)); }
      if (fA) { const v = Math.hypot(o.vx, o.vy); vmax("fricA", d3(fA.vector, [-M * K_AIR * v * o.vx, -M * K_AIR * v * o.vy, 0])); if (fA.kind !== "friction") issue(`frame ${i}: 阻力 kind=${fA.kind}`); if (f.scales.friction !== f.scales.weight) issue(`frame ${i}: friction 與 weight 縮放不同`); }
      if (!air && fA) issue(`frame ${i}: 無阻力仍有阻力箭嘴`);
      if (aA) { const forces = arrA.filter((a) => a.kind === "weight" || a.kind === "friction"); const sum = [0, 0, 0]; for (const q of forces) for (let j = 0; j < 3; j++) sum[j] += q.vector[j]; vmax("fsum", d3(sum, aA.vector.map((c) => M * c))); }
      if (vA && vxA && vyA) vmax("vcomp", d3(vxA.vector.map((c, j) => c + vyA.vector[j]), vA.vector));
      const nA = arrA.length; if (nA !== (air ? 6 : 5)) issue(`frame ${i}: 主球箭嘴數 ${nA}`);
    }
    if (B) {
      if (landedB) { if (arrB.length) arrowsAfterLandB++; }
      else { const get = (layer) => arrB.find((a) => a.layer === layer); const vB = get("velocity"), vxB = get("vx"), vyB = get("vy");
        if (!vB || !vxB || !vyB) missingArrowsBeforeLand++;
        if (vB) { vmax("velB", d3(vB.vector, [eB.vx, eB.vy, 0])); vmax("orgB", d3(vB.origin, [o.xB * k, o.yB * k + r, -zOff])); }
        if (vxB) vmax("vxB", d3(vxB.vector, [eB.vx, 0, 0])); if (vyB) vmax("vyB", d3(vyB.vector, [0, eB.vy, 0]));
        const extra = arrB.filter((a) => a.kind !== "velocity"); if (extra.length) issue(`frame ${i}: 第二顆球有非速度箭嘴`); }
    } else if (arrB.length) issue(`frame ${i}: 無第二顆球卻有 z=−zOff 箭嘴`);
    // 標籤
    const lx = f.labels.find((l) => l.symbol === "x"), ly = f.labels.find((l) => l.symbol === "y");
    if (lx) { vmax("labX", Math.abs(lx.value - o.x)); vmax("labXpos", d3(lx.position, [o.x * k, LABEL_X_Y, 0])); } else issue(`frame ${i}: 無 x 標籤`);
    if (ly) { vmax("labY", Math.abs(ly.value - o.y)); vmax("labYpos", d3(ly.position, [LABEL_Y_X, o.y * k + r, 0])); } else issue(`frame ${i}: 無 y 標籤`);
    // bodies（extra 匯出）
    if (hasBodies) {
      const by = {}; for (const b of f.bodies) { by[b.key] = b; const pre = b.key.replace(/-\d+$/, ""); if (!["ball-a", "ball-b", "gshadow-a", "gshadow-b", "strobe-a", "shadow-a", "wall-a", "ycol-a", "strobe-b", "shadow-b"].includes(pre)) bodyKindsUnexpected.add(pre); }
      const sideZ = f.meta.sideZ;
      if (by["ball-a"]) { bmax("ballA", d3(by["ball-a"].position, [o.x * k, o.y * k + r, 0])); if (by["ball-a"].shape !== "sphere" || by["ball-a"].size[0] !== r) issue(`frame ${i}: ball-a 形狀/半徑`); } else issue(`frame ${i}: 無 ball-a`);
      if (by["gshadow-a"]) { bmax("gshA", d3(by["gshadow-a"].position, [o.x * k, 0.015, 0])); if (by["gshadow-a"].shape !== "cylinder") issue(`frame ${i}: gshadow-a 形狀`); } else issue(`frame ${i}: 無 gshadow-a`);
      if (B) { if (by["ball-b"]) bmax("ballB", d3(by["ball-b"].position, [o.xB * k, o.yB * k + r, -zOff])); else issue(`frame ${i}: 無 ball-b`);
        if (by["gshadow-b"]) bmax("gshB", d3(by["gshadow-b"].position, [o.xB * k, 0.015, -zOff])); else issue(`frame ${i}: 無 gshadow-b`); }
      else { if (by["ball-b"] || by["gshadow-b"]) issue(`frame ${i}: 無第二顆球卻有 ball-b/gshadow-b`); }
      const tLimA = Math.min(t, A.tf ?? t) + 1e-9; const nStrA = Math.floor(tLimA / STROBE) + 1;
      const cntA = f.bodies.filter((b) => b.key.startsWith("strobe-a-")).length; if (cntA !== nStrA) { strobeCountBad++; if (strobeCountBad < 3) issue(`frame ${i}: strobe-a 數 ${cntA} ≠ ${nStrA}`); }
      for (let j = 0; j < cntA; j++) { const idx = Math.round(j * STROBE / dt); const e = A.frames[Math.min(idx, N - 1)]; const P = [e.x * k, e.y * k + r];
        const s = by[`strobe-a-${j}`], sh = by[`shadow-a-${j}`], w = by[`wall-a-${j}`], yc = by[`ycol-a-${j}`];
        if (s) bmax("strobeA", d3(s.position, [P[0], P[1], 0])); else issue(`frame ${i}: 無 strobe-a-${j}`);
        if (sh) bmax("shadowA", d3(sh.position, [P[0], 0.01, 0])); else issue(`frame ${i}: 無 shadow-a-${j}`);
        if (w) { bmax("wallA", d3(w.position, [P[0], P[1], sideZ])); if (w.shape !== "cylinder") issue(`frame ${i}: wall-a 形狀 ${w.shape}`); } else issue(`frame ${i}: 無 wall-a-${j}`);
        if (yc) { bmax("ycolA", d3(yc.position, [YCOL_X, P[1], sideZ])); if (yc.shape !== "cylinder") issue(`frame ${i}: ycol-a 形狀`); } else issue(`frame ${i}: 無 ycol-a-${j}`); }
      if (B) { const tLimB = Math.min(t, B.tf ?? t) + 1e-9; const nStrB = Math.floor(tLimB / STROBE) + 1; const cntB = f.bodies.filter((b) => b.key.startsWith("strobe-b-")).length; if (cntB !== nStrB) { strobeCountBad++; if (strobeCountBad < 3) issue(`frame ${i}: strobe-b 數 ${cntB} ≠ ${nStrB}`); }
        for (let j = 0; j < cntB; j++) { const idx = Math.round(j * STROBE / dt); const e = B.frames[Math.min(idx, N - 1)]; const P = [e.x * k, e.y * k + r]; const s = by[`strobe-b-${j}`], sh = by[`shadow-b-${j}`];
          if (s) bmax("strobeB", d3(s.position, [P[0], P[1], -zOff])); if (sh) bmax("shadowB", d3(sh.position, [P[0], 0.01, -zOff])); } }
      const tr = Object.fromEntries((f.trails ?? []).map((q) => [q.key, q]));
      if (tr["path-a"]) { bmax("pathAlast", d3(tr["path-a"].last, [o.x * k, o.y * k + r, 0])); bmax("pathAfirst", d3(tr["path-a"].first, [0, p.h * k + r, 0])); }
      if (B && tr["path-b"]) bmax("pathBlast", d3(tr["path-b"].last, [o.xB * k, o.yB * k + r, -zOff]));
      if (B && tr["sync"]) bmax("sync", Math.max(d3(tr["sync"].first, [o.x * k, o.y * k + r, 0]), d3(tr["sync"].last, [o.xB * k, o.yB * k + r, -zOff])));
      if (tr["proj-top-a"]) bmax("projTopLastX", Math.abs(tr["proj-top-a"].last[0] - o.x * k));
      if (tr["proj-side-a"]) bmax("projSideLastY", Math.abs(tr["proj-side-a"].last[1] - (o.y * k + r)));
      if (!ghostChecked) { ghostChecked = true; for (const th of [15, 30, 45, 60, 75]) { const q = tr[`ghost-${th}`]; if (!q) { issue(`無 ghost-${th}`); continue; } const uyg = p.u * Math.sin(th * DEG), uxg = p.u * Math.cos(th * DEG); const tfg = tfAnalytic(uyg, p.h, g); const Rg = uxg * tfg;
          bmax("ghostFirst", d3(q.first, [0, p.h * k + r, 0])); bmax("ghostLastX", Math.abs(q.last[0] - Rg * k)); bmax("ghostLastY", Math.abs(q.last[1] - r)); } }
    }
  }
  const last = fr[N - 1].obs; const tUpAn = uy > 0 ? uy / g : 0;
  let tUpData = null; if (topFrame !== null) { const a = fr[topFrame - 1].obs, b = fr[topFrame].obs; tUpData = a.t + (b.t - a.t) * a.vy / (a.vy - b.vy); }
  let symMax = 0; if (!air && p.h === 0 && uy > 0 && A.tf) { for (let i = 0; i < N; i++) { const t = i * dt; if (t > tUpAn) break; const j = Math.round((2 * tUpAn - t) / dt); if (j < N && j * dt <= A.tf) symMax = Math.max(symMax, Math.abs(fr[i].obs.y - fr[j].obs.y)); } }
  const strobeDx = strobe.slice(1).map((s, i) => s.x - strobe[i].x), strobeDy = strobe.slice(1).map((s, i) => s.y - strobe[i].y);
  const dxSpread = strobeDx.length ? Math.max(...strobeDx) - Math.min(...strobeDx) : null;
  const dyDecr = strobeDy.length > 1 ? strobeDy.slice(1).every((d, i) => d < strobeDy[i]) : null;
  const sc = fr[0].scales;
  const rows = Object.values(E).map((e) => e.row(tol)).filter((r) => r.at !== null);
  return { name: run.name, source, params: p, frames: N, air, tol,
    expected: { ux, uy, tfA: A.tf, tfB: B ? B.tf : null, tUp: tUpAn, R: !air && p.h === 0 ? p.u * p.u * Math.sin(2 * p.theta * DEG) / g : null, landingSpeed: !air && A.tf ? Math.hypot(A.frames[N - 1].vx, A.frames[N - 1].vy) : null },
    data: { tfLast: last.tf, tLast: last.t, xLast: last.x, yLast: last.y, vLast: last.v, vxLast: last.vx, vyLast: last.vy, tUpData, metaTf: fr[0].meta.tf, EkMin: fr[0].meta.EkMin, EkMax: fr[0].meta.EkMax, firstFrozenFrame: firstFrozen, ayAfterLanding, axAfterLanding, xBLast: last.xB, yBLast: last.yB, doneFirst, doneAt: run.doneAt ?? null, tAfterDoneChanges, doneBeforeLanded },
    rows, vec, bod, accLen: { min: accLenMin, max: accLenMax }, vxRange: { min: vxMin, max: vxMax, spread: vxMax - vxMin }, symMax,
    strobe: { n: strobe.length, dxSpread, dyDecr, dx: strobeDx.slice(0, 4), dy: strobeDy.slice(0, 4) }, energy: { min: Emin, max: Emax, drift: Emax - Emin, maxRise: EmaxRise },
    scales: { ...sc, accTimesG: sc.acceleration * g, wTimesG: sc.weight * M * g, vTimesU: sc.velocity * p.u, fricEqW: sc.friction === sc.weight },
    flags: { arrowsAfterLandA, arrowsAfterLandB, missingArrowsBeforeLand, scaleChanges, kChanges, nonFinite, unexpectedKinds: [...unexpectedKinds], strobeCountBad, bodyKindsUnexpected: [...bodyKindsUnexpected], k: k0 },
    issues: issues.slice(0, 12), issueCount: issues.length };
}

const results = [];
for (const r of loadRuns(DATA)) results.push(auditRun(r, "data"));
const extra = loadRuns(EXTRA); for (const r of extra) results.push(auditRun(r, "extra"));
// 官方運行重匯出一致性：obs / arrows / labels / scales / meta 逐幀相同
const consistency = [];
for (const r of extra.filter((x) => x.name.startsWith("official-"))) {
  const name = r.name.replace("official-", ""); let d; try { d = JSON.parse(readFileSync(join(DATA, name + ".json"), "utf8")); } catch { continue; }
  let diff = 0, first = null; for (let i = 0; i < d.frames.length; i++) { const a = d.frames[i], b = r.frames[i]; if (JSON.stringify([a.obs, a.arrows, a.labels, a.scales, a.meta]) !== JSON.stringify([b.obs, b.arrows, b.labels, b.scales, b.meta])) { diff++; if (first === null) first = i; } }
  consistency.push({ name, diffFrames: diff, first });
}
writeFileSync(join(HERE, "results-r2.json"), JSON.stringify({ results, consistency }, null, 1));
console.log("## 重匯出一致性", JSON.stringify(consistency));
for (const r of results) {
  const bad = r.rows.filter((x) => !x.pass);
  console.log(`\n## ${r.name} [${r.source}] air=${r.air} u=${r.params.u} θ=${r.params.theta} h=${r.params.h} g=${r.params.g} comp=${r.params.companion}`);
  console.log(`  tf 預期 A=${r.expected.tfA} B=${r.expected.tfB} | 數據 tf=${r.data.tfLast} t=${r.data.tLast} meta.tf=${r.data.metaTf} | done 首幀=${r.data.doneFirst} (匯出 doneAt=${r.data.doneAt}) done後t變動=${r.data.tAfterDoneChanges} 未落地先done=${r.data.doneBeforeLanded}`);
  console.log(`  逐幀: ${r.rows.map((x) => `${x.q}=${fmt(x.relMax)}@${x.at?.toFixed(3)}${x.pass ? "" : "✗"}`).join(" ")}`);
  console.log(`  箭嘴: ${Object.entries(r.vec).map(([k, v]) => `${k}=${fmt(v)}`).join(" ")}`);
  if (Object.keys(r.bod).length) console.log(`  bodies: ${Object.entries(r.bod).map(([k, v]) => `${k}=${fmt(v)}`).join(" ")}`);
  console.log(`  scales: ${JSON.stringify(r.scales)}`);
  console.log(`  |a|箭嘴 ${r.accLen.min}..${r.accLen.max} | vx 極差 ${fmt(r.vxRange.spread)} | 對稱 ${fmt(r.symMax)} | 落地速率 ${r.data.vLast} (預期 ${r.expected.landingSpeed}) | t_up 數據 ${r.data.tUpData} 預期 ${r.expected.tUp}`);
  console.log(`  頻閃 n=${r.strobe.n} Δx極差=${fmt(r.strobe.dxSpread)} Δy遞減=${r.strobe.dyDecr} | 能量漂移=${fmt(r.energy.drift)} 最大上升=${fmt(r.energy.maxRise)} | 落地後 ax,ay=${r.data.axAfterLanding},${r.data.ayAfterLanding} 首凍結幀=${r.data.firstFrozenFrame}`);
  console.log(`  旗標: ${JSON.stringify(r.flags)} | issues=${r.issueCount} ${r.issues.slice(0, 4).join("; ")}`);
  if (bad.length) console.log(`  ✗ 未通過: ${bad.map((x) => x.q).join(",")}`);
}
