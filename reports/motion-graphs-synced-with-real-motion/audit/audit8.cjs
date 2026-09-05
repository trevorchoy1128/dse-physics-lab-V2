// 第 8 輪獨立核數程式（不讀 model.ts / plan.ts / Scene.tsx / *.test.ts）。全部重寫，不沿用第 7 輪結論。
// 用法：node --max-old-space-size=6144 audit8.cjs  →  audit8-out.json、audit8-console.txt（stdout）
const fs = require("fs");
const path = require("path");
const DATA = path.join(__dirname, "..", "data");
const idx = JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf8"));
const DT = idx.dt;

// ---------- 我的獨立模型 ----------
// v(t) 一律表示為折線段列表 {t0, v0, m, len}（len 可為 Infinity）。
// live：一段 v = u + a t。draw：vt[k] 在 t = k s，段內線性；最後節點後 v 保持 vt[n]、a = 0（規格未寫，作「規格待釐清」）。
function segments(p) {
  if (p.mode !== "draw") return [{ t0: 0, v0: p.u, m: p.a, len: Infinity }];
  const vt = p.vt, n = vt.length - 1, segs = [];
  for (let k = 0; k < n; k++) segs.push({ t0: k, v0: vt[k], m: vt[k + 1] - vt[k], len: 1 });
  segs.push({ t0: n, v0: vt[n], m: 0, len: Infinity });
  return segs;
}
// 段內 [0, tau] 的位移與路程（解析）：s = v0 tau + 1/2 m tau^2；路程在 v = 0（tau* = -v0/m）分割
function segS(g, tau) { return g.v0 * tau + 0.5 * g.m * tau * tau; }
function segD(g, tau) {
  if (tau <= 0) return 0;
  if (g.m !== 0) { const tz = -g.v0 / g.m; if (tz > 0 && tz < tau) return Math.abs(segS(g, tz)) + Math.abs(segS(g, tau) - segS(g, tz)); }
  return Math.abs(segS(g, tau));
}
function segIndex(segs, t) { let k = 0; while (k + 1 < segs.length && t >= segs[k + 1].t0) k++; return k; } // floor 慣例
function state(p, t) {
  const segs = segments(p); let s = 0, d = 0, k = 0;
  for (; k < segs.length; k++) {
    const g = segs[k]; if (t <= g.t0) break;
    const tau = Math.min(t, g.t0 + g.len) - g.t0;
    s += segS(g, tau); d += segD(g, tau);
    if (t <= g.t0 + g.len) break;
  }
  const g = segs[segIndex(segs, t)]; const tau = t - g.t0;
  return { s, dist: d, v: g.v0 + g.m * tau, a: g.m };
}
function expect(p, t) {
  const m = state(p, t);
  return { ...m, speed: Math.abs(m.v), area: m.s, avgSpeed: t > 0 ? m.dist / t : 0, avgVel: t > 0 ? m.s / t : 0 };
}
// 節點兩側斜率（draw）
function slopes(p, tNode) { const vt = p.vt; const k = Math.round(tNode); return { left: k >= 1 && k <= vt.length - 1 ? vt[k] - vt[k - 1] : null, right: k >= 0 && k < vt.length - 1 ? vt[k + 1] - vt[k] : (k >= vt.length - 1 ? 0 : null) }; }
// [0, T] 內 |s|、|v|、|a| 的準確極值：|s| 極值只可能在 t = 0、T、段界、段內 v = 0 處
function exactExtrema(p, T) {
  const segs = segments(p); const cand = new Set([0, T]);
  for (const g of segs) { if (g.t0 > 0 && g.t0 < T) cand.add(g.t0); if (g.m !== 0) { const tz = g.t0 - g.v0 / g.m; if (tz > g.t0 && tz < g.t0 + g.len && tz > 0 && tz < T) cand.add(tz); } }
  let sMax = 0, sAt = 0, vMax = 0, vAt = 0, aMax = 0;
  for (const t of cand) { const st = state(p, t); if (Math.abs(st.s) > sMax) { sMax = Math.abs(st.s); sAt = t; } if (Math.abs(st.v) > vMax) { vMax = Math.abs(st.v); vAt = t; } }
  for (const g of segs) if (g.t0 < T) aMax = Math.max(aMax, Math.abs(g.m));
  return { sMax, sAt, vMax, vAt, aMax, candidates: [...cand].sort((a, b) => a - b) };
}
// 1–2–5 級距：最小的 {1,2,5}×10^n ≥ x（relTol 用來吸收浮點噪音）
function level125(x, relTol) { if (!(x > 0)) return null; const y = x * (1 - (relTol || 0)); const e = Math.floor(Math.log10(y)); for (const mant of [1, 2, 5, 10]) { const L = mant * Math.pow(10, e); if (L >= y) return L; } return null; }

const KEYS = ["s", "dist", "v", "a", "speed", "area", "avgSpeed", "avgVel"];
const tol = (e) => 1e-9 + 1e-6 * Math.abs(e);
const out = { dt: DT, runs: [] };
let totalFrames = 0;
for (const r of idx.runs) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, r.name + ".json"), "utf8"));
  const p = d.params, F = d.frames, T = p.T; totalFrames += F.length;
  const R = { name: r.name, mode: p.mode, params: p, frames: F.length };
  // ---- 1. 時間軸、凍結、NaN ----
  let iT = -1, tDriftMax = 0, tDriftAt = 0, frozenOK = 0, frozenBad = 0, nan = 0, monoBad = 0, doneBad = 0, metaMismatch = 0;
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    for (const k of KEYS) if (!Number.isFinite(f.obs[k])) nan++;
    for (const a of f.arrows) for (const c of a.vector.concat(a.origin)) if (!Number.isFinite(c)) nan++;
    if (i > 0 && f.t < F[i - 1].t) monoBad++;
    if (iT < 0) { if (f.t >= T) iT = i; else { const dr = Math.abs(f.t - i * DT); if (dr > tDriftMax) { tDriftMax = dr; tDriftAt = i; } if (f.meta.done) doneBad++; } }
    else { if (!f.meta.done) doneBad++; const same = f.t === T && KEYS.every(k => f.obs[k] === F[iT].obs[k]) && JSON.stringify(f.arrows) === JSON.stringify(F[iT].arrows) && JSON.stringify(f.labels) === JSON.stringify(F[iT].labels) && JSON.stringify(f.meta) === JSON.stringify(F[iT].meta); if (same) frozenOK++; else frozenBad++; }
    if (f.meta.t !== f.t || f.meta.s !== f.obs.s || f.meta.v !== f.obs.v || f.meta.a !== f.obs.a || f.meta.T !== T) metaMismatch++;
  }
  R.time = { iT, expectedIT: Math.ceil(T / DT - 1e-9), tAtT: F[iT].t, tEqualsT: F[iT].t === T, tDriftMax, tDriftAt, frozenOK, frozenBad, nan, monoBad, doneBad, metaMismatch, lastT: F[F.length - 1].t };
  // ---- 2. 逐幀比對（t ≤ T）----
  const err = {}; for (const k of KEYS) err[k] = { maxAbs: 0, at: 0, exp: 0, got: 0, maxRel: 0, fails: 0, failAt: [] };
  const nodeA = { frames: 0, left: 0, right: 0, neither: 0, list: [] }; // draw 節點幀（t 距整數節點 < 1e-9）
  let uniMax = 0, uniAt = 0, uniFails = 0, trap = 0, trapMax = 0, trapAt = 0;
  let firstRev = -1, eqBefore = 0, neBefore = 0, eqAfter = 0, neAfter = 0, minGapAfter = Infinity;
  for (let i = 0; i <= iT; i++) {
    const f = F[i], t = f.t, e = expect(p, t);
    let isNode = false;
    if (p.mode === "draw") { const k = Math.round(t); if (Math.abs(t - k) < 1e-9 && k >= 1 && k <= p.vt.length - 1 && t < T) { isNode = true; nodeA.frames++; const sl = slopes(p, k); if (f.obs.a === sl.left) nodeA.left++; else if (f.obs.a === sl.right) nodeA.right++; else nodeA.neither++; if (nodeA.list.length < 12) nodeA.list.push({ i, t, a: f.obs.a, left: sl.left, right: sl.right }); } }
    for (const k of KEYS) {
      if (k === "a" && isNode) continue; // 節點幀 a 另計
      const ab = Math.abs(f.obs[k] - e[k]);
      if (ab > err[k].maxAbs) { err[k].maxAbs = ab; err[k].at = t; err[k].exp = e[k]; err[k].got = f.obs[k]; }
      if (Math.abs(e[k]) > 1e-6) { const rel = ab / Math.abs(e[k]); if (rel > err[k].maxRel) err[k].maxRel = rel; }
      if (ab > tol(e[k])) { err[k].fails++; if (err[k].failAt.length < 5) err[k].failAt.push([i, t, e[k], f.obs[k]]); }
    }
    if (p.mode !== "draw") { const lhs = f.obs.v * f.obs.v, rhs = p.u * p.u + 2 * p.a * f.obs.s; const ab = Math.abs(lhs - rhs); if (ab > uniMax) { uniMax = ab; uniAt = t; } if (ab > 1e-9 + 1e-6 * Math.abs(rhs)) uniFails++; }
    if (i > 0) { trap += 0.5 * (f.obs.v + F[i - 1].obs.v) * (t - F[i - 1].t); const ab = Math.abs(trap - f.obs.s); if (ab > trapMax) { trapMax = ab; trapAt = t; } }
    if (firstRev < 0 && i > 0) { const v0 = F[i - 1].obs.v, v1 = f.obs.v; if ((v0 > 0 && v1 < 0) || (v0 < 0 && v1 > 0) || (v0 !== 0 && v1 === 0 && p.mode !== "draw" && p.a !== 0)) firstRev = t; }
    if (firstRev < 0) { if (f.obs.dist === Math.abs(f.obs.s)) eqBefore++; else neBefore++; }
    else if (t > firstRev) { const gap = Math.abs(f.obs.dist - Math.abs(f.obs.s)); if (gap < minGapAfter) minGapAfter = gap; if (gap === 0) eqAfter++; else neAfter++; }
  }
  // 解析的反向時刻
  let revAnalytic = null; if (p.mode !== "draw") { if (p.a !== 0) { const t0 = -p.u / p.a; if (t0 > 0 && t0 < T) revAnalytic = t0; } } else { for (const g of segments(p)) if (g.m !== 0) { const tz = g.t0 - g.v0 / g.m; if (tz > g.t0 && tz < g.t0 + g.len && tz < T && g.v0 !== 0) { revAnalytic = tz; break; } } }
  R.err = err; R.nodeA = nodeA; R.uniform = { maxAbs: uniMax, at: uniAt, fails: uniFails };
  R.trap = { maxAbs: trapMax, at: trapAt, final: trap, sFinal: F[iT].obs.s };
  R.reverse = { firstRevData: firstRev, revAnalytic, eqBefore, neBefore, eqAfter, neAfter, minGapAfter: minGapAfter === Infinity ? null : minGapAfter };
  const eT = expect(p, T); R.atT = { t: F[iT].t, exp: eT, got: F[iT].obs, aLeftRight: p.mode === "draw" && Number.isInteger(T) ? slopes(p, T) : null };
  // ---- 3. 箭嘴 ----
  const A = { vEq: 0, vNe: 0, aEq: 0, aNe: 0, origEq: 0, origNe: 0, yz: new Set(), labelEq: 0, labelNe: 0, scales: {}, kinds: {}, extra: 0, notTwo: 0, aLenMin: Infinity, aLenMax: -Infinity, vLenMax: 0 };
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    for (const a of f.arrows) {
      A.kinds[a.kind] = (A.kinds[a.kind] || 0) + 1;
      if (a.kind === "velocity") { if (a.vector[0] === f.obs.v && a.vector[1] === 0 && a.vector[2] === 0) A.vEq++; else A.vNe++; A.vLenMax = Math.max(A.vLenMax, Math.abs(a.vector[0])); }
      else if (a.kind === "acceleration") { if (a.vector[0] === f.obs.a && a.vector[1] === 0 && a.vector[2] === 0) A.aEq++; else A.aNe++; const L = Math.abs(a.vector[0]); A.aLenMin = Math.min(A.aLenMin, L); A.aLenMax = Math.max(A.aLenMax, L); }
      else A.extra++;
      if (a.origin[0] === f.obs.s) A.origEq++; else A.origNe++;
      A.yz.add(a.kind + ":" + a.origin[1] + "," + a.origin[2]);
    }
    for (const [k, v] of Object.entries(f.scales)) { (A.scales[k] = A.scales[k] || new Set()).add(v); }
    for (const l of f.labels) { if (l.symbol === "s" && l.value === f.obs.s && l.position[0] === f.obs.s && l.unit === "m") A.labelEq++; else A.labelNe++; }
    if (f.arrows.length !== 2) A.notTwo++;
  }
  A.yz = [...A.yz]; for (const k in A.scales) A.scales[k] = [...A.scales[k]]; R.arrow = A;
  // ---- 4. meta 軸範圍：唯一、容納、與準確極值取整比對 ----
  const m0 = F[0].meta; const uniq = { smax: new Set(), vmax: new Set(), amax: new Set() };
  let sAbs = 0, sAbsAt = 0, vAbs = 0, aAbs = 0;
  for (let i = 0; i < F.length; i++) { const f = F[i]; for (const k in uniq) uniq[k].add(f.meta[k]); if (Math.abs(f.obs.s) > sAbs) { sAbs = Math.abs(f.obs.s); sAbsAt = f.t; } vAbs = Math.max(vAbs, Math.abs(f.obs.v)); aAbs = Math.max(aAbs, Math.abs(f.obs.a)); }
  for (const k in uniq) uniq[k] = [...uniq[k]];
  const ex = exactExtrema(p, T);
  R.meta = { smax: m0.smax, vmax: m0.vmax, amax: m0.amax, uniq, dataAbsMax: { s: sAbs, sAt: sAbsAt, v: vAbs, a: aAbs }, exact: ex,
    sIn: sAbs <= m0.smax, vIn: vAbs <= m0.vmax * (1 + 1e-9), aIn: aAbs <= m0.amax * (1 + 1e-9),
    sLevelStrict: level125(ex.sMax, 0), sLevelTol: level125(ex.sMax, 1e-9), vLevel: level125(ex.vMax, 1e-9), aLevel: level125(ex.aMax, 1e-9) };
  out.runs.push(R);
  console.log(`\n=== ${r.name} (${p.mode}) T=${T} u=${p.u} a=${p.a}${p.mode === "draw" ? " vt=" + JSON.stringify(p.vt) : ""}`);
  console.log(" time", JSON.stringify(R.time));
  for (const k of KEYS) console.log(`  ${k.padEnd(8)} maxAbs=${err[k].maxAbs.toExponential(3)} at t=${err[k].at} exp=${err[k].exp} got=${err[k].got} maxRel=${err[k].maxRel.toExponential(2)} fails=${err[k].fails} ${err[k].fails ? JSON.stringify(err[k].failAt) : ""}`);
  if (p.mode === "draw") console.log(" nodeA", JSON.stringify(nodeA));
  console.log(" uniform", JSON.stringify(R.uniform), "\n trap", JSON.stringify(R.trap));
  console.log(" reverse", JSON.stringify(R.reverse));
  console.log(" atT", JSON.stringify(R.atT));
  console.log(" arrow", JSON.stringify(A));
  console.log(" meta", JSON.stringify(R.meta));
}
out.totalFrames = totalFrames;
fs.writeFileSync(path.join(__dirname, "audit8-out.json"), JSON.stringify(out, null, 1));
console.log("\ntotalFrames", totalFrames);
