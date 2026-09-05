// 第 9 輪獨立核數程式：對 data/ 的 10 個運行逐幀比對。用法：node --max-old-space-size=6144 audit9.cjs > audit9-console.txt
const fs = require("fs"), path = require("path");
const M = require("./audit9-model.cjs");
const DATA = path.join(__dirname, "..", "data");
const idx = JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf8"));
const DT = idx.dt;
const KEYS = ["s", "dist", "v", "a", "speed", "area", "avgSpeed", "avgVel"];
const tol = (e) => 1e-9 + 1e-6 * Math.abs(e);
const out = { dt: DT, runs: [] }; let totalFrames = 0;
for (const r of idx.runs) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, r.name + ".json"), "utf8"));
  const p = d.params, F = d.frames, T = p.T; totalFrames += F.length;
  const h = M.nodeDt(p);
  const R = { name: r.name, mode: p.mode, params: p, frames: F.length, nodeDt: h };
  // 1. 時間軸、凍結、NaN、meta 同源
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
  // 2. 逐幀比對 t ≤ T（t = T 幀 a 取左段；其他節點幀 a 另計）
  const err = {}; for (const k of KEYS) err[k] = { maxAbs: 0, at: 0, exp: 0, got: 0, maxRel: 0, fails: 0, failAt: [] };
  const nodeA = { frames: 0, left: 0, right: 0, neither: 0, list: [] };
  let uniMax = 0, uniAt = 0, uniFails = 0, trap = 0, trapMax = 0, trapAt = 0;
  let lastSign = 0, zeroAt = -1, revViaZero = false, firstRev = -1, eqBefore = 0, neBefore = 0, eqAfter = 0, neAfter = 0, minGapAfter = Infinity;
  let speedEq = 0, avgOk = 0;
  for (let i = 0; i <= iT; i++) {
    const f = F[i], t = f.t; const side = i === iT ? "left" : "right"; const e = M.expect(p, t, side);
    const ni = i < iT ? M.nodeInfo(p, t) : null;
    if (ni) { nodeA.frames++; if (f.obs.a === ni.left) nodeA.left++; else if (f.obs.a === ni.right) nodeA.right++; else nodeA.neither++; if (nodeA.list.length < 12) nodeA.list.push({ i, t, k: ni.k, a: f.obs.a, left: ni.left, right: ni.right }); }
    for (const k of KEYS) {
      if (k === "a" && ni) continue;
      const ab = Math.abs(f.obs[k] - e[k]);
      if (ab > err[k].maxAbs) { err[k].maxAbs = ab; err[k].at = t; err[k].exp = e[k]; err[k].got = f.obs[k]; }
      if (Math.abs(e[k]) > 1e-6) { const rel = ab / Math.abs(e[k]); if (rel > err[k].maxRel) err[k].maxRel = rel; }
      if (ab > tol(e[k])) { err[k].fails++; if (err[k].failAt.length < 5) err[k].failAt.push([i, t, e[k], f.obs[k]]); }
    }
    if (f.obs.speed === Math.abs(f.obs.v)) speedEq++;
    if (t === 0 ? (f.obs.avgSpeed === 0 && f.obs.avgVel === 0) : (Math.abs(f.obs.avgSpeed - f.obs.dist / t) <= 1e-12 * Math.max(1, Math.abs(f.obs.avgSpeed)) && Math.abs(f.obs.avgVel - f.obs.s / t) <= 1e-12 * Math.max(1, Math.abs(f.obs.avgVel)))) avgOk++;
    if (p.mode !== "draw") { const lhs = f.obs.v * f.obs.v, rhs = p.u * p.u + 2 * p.a * f.obs.s; const ab = Math.abs(lhs - rhs); if (ab > uniMax) { uniMax = ab; uniAt = t; } if (ab > 1e-9 + 1e-6 * Math.abs(rhs)) uniFails++; }
    if (i > 0) { trap += 0.5 * (f.obs.v + F[i - 1].obs.v) * (t - F[i - 1].t); const ab = Math.abs(trap - f.obs.s); if (ab > trapMax) { trapMax = ab; trapAt = t; } }
    if (firstRev < 0) { const sv = Math.sign(f.obs.v); if (sv !== 0 && lastSign !== 0 && sv !== lastSign) { revViaZero = zeroAt >= 0; firstRev = zeroAt >= 0 ? zeroAt : t; } if (sv === 0 && lastSign !== 0 && zeroAt < 0) zeroAt = t; if (sv !== 0) { lastSign = sv; zeroAt = -1; } }
    if (firstRev < 0) { if (f.obs.dist === Math.abs(f.obs.s)) eqBefore++; else neBefore++; }
    else if (revViaZero ? t > firstRev : t >= firstRev) { const gap = Math.abs(f.obs.dist - Math.abs(f.obs.s)); if (gap < minGapAfter) minGapAfter = gap; if (gap === 0) eqAfter++; else neAfter++; }
  }
  R.err = err; R.nodeA = nodeA; R.uniform = { maxAbs: uniMax, at: uniAt, fails: uniFails };
  R.trap = { maxAbs: trapMax, at: trapAt, final: trap, sFinal: F[iT].obs.s };
  R.derived = { speedEq, avgOk, framesToT: iT + 1 };
  R.reverse = { firstRevData: firstRev, revViaZero, revAnalytic: M.firstReversal(p, T), eqBefore, neBefore, eqAfter, neAfter, minGapAfter: minGapAfter === Infinity ? null : minGapAfter };
  R.atT = { t: F[iT].t, expLeft: M.expect(p, T, "left"), expRight: M.expect(p, T, "right"), got: F[iT].obs };
  // 段內抽樣（draw）：每段中點的 v、a、s 與導出比對（證明節點在 k·nodeDt 而非 k 秒）
  if (p.mode === "draw") { R.midSeg = []; for (let k = 0; k < 10; k++) { const tm = (k + 0.5) * h; if (tm >= T) break; const i = Math.round(tm / DT); const f = F[i]; const e = M.expect(p, f.t, "right"); R.midSeg.push({ k, t: f.t, vExp: e.v, vGot: f.obs.v, aExp: e.a, aGot: f.obs.a, sExp: e.s, sGot: f.obs.s }); } }
  // 3. 箭嘴、標籤、縮放
  const A = { vEq: 0, vNe: 0, aEq: 0, aNe: 0, origEq: 0, origNe: 0, yz: new Set(), labelEq: 0, labelNe: 0, scales: {}, kinds: {}, extra: 0, notTwo: 0, aLenMin: Infinity, aLenMax: -Infinity, vLenMax: 0, aLenSet: new Set() };
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    for (const a of f.arrows) {
      A.kinds[a.kind] = (A.kinds[a.kind] || 0) + 1;
      if (a.kind === "velocity") { if (a.vector[0] === f.obs.v && a.vector[1] === 0 && a.vector[2] === 0) A.vEq++; else A.vNe++; A.vLenMax = Math.max(A.vLenMax, Math.abs(a.vector[0])); }
      else if (a.kind === "acceleration") { if (a.vector[0] === f.obs.a && a.vector[1] === 0 && a.vector[2] === 0) A.aEq++; else A.aNe++; const L = Math.abs(a.vector[0]); A.aLenMin = Math.min(A.aLenMin, L); A.aLenMax = Math.max(A.aLenMax, L); if (A.aLenSet.size < 20) A.aLenSet.add(L); }
      else A.extra++;
      if (a.origin[0] === f.obs.s) A.origEq++; else A.origNe++;
      A.yz.add(a.kind + ":" + a.origin[1] + "," + a.origin[2]);
    }
    for (const [k, v] of Object.entries(f.scales)) (A.scales[k] = A.scales[k] || new Set()).add(v);
    for (const l of f.labels) { if (l.symbol === "s" && l.value === f.obs.s && l.position[0] === f.obs.s && l.unit === "m") A.labelEq++; else A.labelNe++; }
    if (f.arrows.length !== 2) A.notTwo++;
  }
  A.yz = [...A.yz]; for (const k in A.scales) A.scales[k] = [...A.scales[k]]; A.aLenSet = [...A.aLenSet]; R.arrow = A;
  // 4. meta 軸範圍
  const m0 = F[0].meta; const uniq = { smax: new Set(), vmax: new Set(), amax: new Set() };
  let sAbs = 0, sAbsAt = 0, vAbs = 0, aAbs = 0; let sGraphHyp = 0, vSeenHyp = 0, aSeenHyp = 0, runS = 0, runV = 0, runA = 0;
  for (let i = 0; i < F.length; i++) { const f = F[i]; for (const k in uniq) uniq[k].add(f.meta[k]); if (Math.abs(f.obs.s) > sAbs) { sAbs = Math.abs(f.obs.s); sAbsAt = f.t; } vAbs = Math.max(vAbs, Math.abs(f.obs.v)); aAbs = Math.max(aAbs, Math.abs(f.obs.a));
    runS = Math.max(runS, Math.abs(f.obs.s)); runV = Math.max(runV, Math.abs(f.obs.v)); runA = Math.max(runA, Math.abs(f.obs.a));
    if (f.meta.sGraph === Math.max(1, runS)) sGraphHyp++; if (f.meta.vSeen === Math.max(1, runV)) vSeenHyp++; if (f.meta.aSeen === Math.max(1, runA)) aSeenHyp++; }
  for (const k in uniq) uniq[k] = [...uniq[k]];
  const ex = M.exactExtrema(p, T);
  R.meta = { smax: m0.smax, vmax: m0.vmax, amax: m0.amax, draw: m0.draw, uniq, dataAbsMax: { s: sAbs, sAt: sAbsAt, v: vAbs, a: aAbs }, exact: ex,
    sIn: sAbs <= m0.smax, vIn: vAbs <= m0.vmax * (1 + 1e-9), aIn: aAbs <= m0.amax * (1 + 1e-9),
    drawAmaxExpected: p.mode === "draw" ? M.drawAmax(p) : null, drawAmaxMatch: p.mode === "draw" ? m0.amax === M.drawAmax(p) : null,
    hyp: { sGraphRunningMax: sGraphHyp, vSeenRunningMax: vSeenHyp, aSeenRunningMax: aSeenHyp, of: F.length } };
  R.expectHandles = M.expectHandles(p);
  out.runs.push(R);
  console.log(`\n=== ${r.name} (${p.mode}) T=${T} nodeDt=${h} u=${p.u} a=${p.a}${p.mode === "draw" ? " vt=" + JSON.stringify(p.vt) : ""}`);
  console.log(" time", JSON.stringify(R.time));
  for (const k of KEYS) console.log(`  ${k.padEnd(8)} maxAbs=${err[k].maxAbs.toExponential(3)} at t=${err[k].at} exp=${err[k].exp} got=${err[k].got} maxRel=${err[k].maxRel.toExponential(2)} fails=${err[k].fails} ${err[k].fails ? JSON.stringify(err[k].failAt) : ""}`);
  if (p.mode === "draw") { console.log(" nodeA", JSON.stringify(nodeA)); console.log(" midSeg", JSON.stringify(R.midSeg)); }
  console.log(" uniform", JSON.stringify(R.uniform), "\n trap", JSON.stringify(R.trap), "\n derived", JSON.stringify(R.derived));
  console.log(" reverse", JSON.stringify(R.reverse));
  console.log(" atT", JSON.stringify(R.atT));
  console.log(" arrow", JSON.stringify(A));
  console.log(" meta", JSON.stringify(R.meta));
  console.log(" expectHandles", JSON.stringify(R.expectHandles));
}
out.totalFrames = totalFrames;
fs.writeFileSync(path.join(__dirname, "audit9-out.json"), JSON.stringify(out, null, 1));
console.log("\ntotalFrames", totalFrames);
