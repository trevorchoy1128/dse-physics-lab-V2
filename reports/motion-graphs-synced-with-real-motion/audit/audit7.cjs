// 第 7 輪獨立核數程式（不讀 model.ts / plan.ts / Scene.tsx）
// 用法：node --max-old-space-size=4096 audit7.js  →  在 audit/ 內輸出 audit7-out.json 與 console 摘要
const fs = require("fs");
const path = require("path");
const DATA = path.join(__dirname, "..", "data");
const idx = JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf8"));
const DT = idx.dt;

// ---------- 獨立模型 ----------
// live：v = u + at，s = ut + 1/2 at^2；路程在 t0 = -u/a 分段
function live(p, t) {
  const { u, a } = p;
  const v = u + a * t;
  const s = u * t + 0.5 * a * t * t;
  let dist;
  if (a !== 0) {
    const t0 = -u / a;
    if (t0 > 0 && t0 < t) {
      const s0 = u * t0 + 0.5 * a * t0 * t0;
      dist = Math.abs(s0) + Math.abs(s - s0);
    } else dist = Math.abs(s);
  } else dist = Math.abs(s);
  return { s, v, a, dist };
}
// draw：vt[k] 在 t = k s，段內線性；t > 最後節點時 v 保持末值、a = 0（規格未寫，見報告 §7）
function drawSeg(vt, t) {
  const n = vt.length - 1;
  if (t >= n) return { v: vt[n], a: 0 };
  const k = Math.floor(t);
  const a = vt[k + 1] - vt[k];
  return { v: vt[k] + a * (t - k), a };
}
function draw(p, t) {
  const vt = p.vt; const n = vt.length - 1;
  let s = 0, dist = 0;
  const segArea = (v0, v1, len) => 0.5 * (v0 + v1) * len;
  const segDist = (v0, v1, len) => {
    if (len <= 0) return 0;
    if (v0 * v1 < 0) { // 段內變號，在零點分割
      const tz = len * v0 / (v0 - v1);
      return Math.abs(0.5 * v0 * tz) + Math.abs(0.5 * v1 * (len - tz));
    }
    return Math.abs(segArea(v0, v1, len));
  };
  for (let k = 0; k < n; k++) {
    if (t <= k) break;
    const len = Math.min(t, k + 1) - k;
    const v0 = vt[k], v1 = vt[k] + (vt[k + 1] - vt[k]) * len;
    s += segArea(v0, v1, len); dist += segDist(v0, v1, len);
  }
  if (t > n) { s += vt[n] * (t - n); dist += Math.abs(vt[n]) * (t - n); }
  const { v, a } = drawSeg(vt, t);
  return { s, v, a, dist };
}
function expect(p, t) {
  const m = p.mode === "draw" ? draw(p, t) : live(p, t);
  return { ...m, speed: Math.abs(m.v), area: m.s, avgSpeed: t > 0 ? m.dist / t : 0, avgVel: t > 0 ? m.s / t : 0 };
}
const KEYS = ["s", "dist", "v", "a", "speed", "area", "avgSpeed", "avgVel"];
const tol = (e) => 1e-9 + 1e-6 * Math.abs(e);

const out = { dt: DT, runs: [] };
for (const r of idx.runs) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, r.name + ".json"), "utf8"));
  const p = d.params; const F = d.frames; const T = p.T;
  const R = { name: r.name, params: p, frames: F.length, mode: p.mode };
  // 1. 時間軸
  let iT = -1, tDriftMax = 0, tDriftAt = 0, frozenOK = 0, frozenBad = 0, nanFrames = 0, monotoneBad = 0;
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    for (const k of KEYS) if (!Number.isFinite(f.obs[k])) nanFrames++;
    if (i > 0 && f.t < F[i - 1].t) monotoneBad++;
    if (iT < 0) {
      if (f.t >= T) iT = i;
      else { const dr = Math.abs(f.t - i * DT); if (dr > tDriftMax) { tDriftMax = dr; tDriftAt = i; } }
    } else {
      const same = f.t === T && KEYS.every(k => f.obs[k] === F[iT].obs[k]) && JSON.stringify(f.arrows) === JSON.stringify(F[iT].arrows) && JSON.stringify(f.labels) === JSON.stringify(F[iT].labels);
      if (same) frozenOK++; else frozenBad++;
    }
  }
  R.time = { iT, tAtT: F[iT] && F[iT].t, tEqualsT: F[iT] && F[iT].t === T, expectedIT: Math.ceil(T / DT - 1e-9), tDriftMax, tDriftAt, frozenOK, frozenBad, nanFrames, monotoneBad, lastT: F[F.length - 1].t };
  // 2. 逐幀比對（用幀的 t 為自變量）
  const err = {}; for (const k of KEYS) err[k] = { maxAbs: 0, at: 0, exp: 0, got: 0, maxRel: 0, fails: 0 };
  let uniformFails = 0, uniformMax = 0, uniformAt = 0; // v^2 = u^2 + 2as
  let trapErrMax = 0, trapAt = 0, trapAcc = 0; // 用導出 v 做梯形積分對比 s
  let firstReverse = -1, distEqS = 0, distNeS_before = 0, distEqS_after = 0, minGapAfter = Infinity;
  for (let i = 0; i <= iT; i++) {
    const f = F[i]; const t = f.t; const e = expect(p, t);
    for (const k of KEYS) {
      const ab = Math.abs(f.obs[k] - e[k]);
      if (ab > err[k].maxAbs) { err[k].maxAbs = ab; err[k].at = t; err[k].exp = e[k]; err[k].got = f.obs[k]; }
      const rel = ab / Math.max(1e-300, Math.abs(e[k])); if (Math.abs(e[k]) > 1e-6 && rel > err[k].maxRel) err[k].maxRel = rel;
      if (ab > tol(e[k])) err[k].fails++;
    }
    if (p.mode === "live") {
      const lhs = f.obs.v ** 2, rhs = p.u ** 2 + 2 * p.a * f.obs.s;
      const ab = Math.abs(lhs - rhs); if (ab > uniformMax) { uniformMax = ab; uniformAt = t; }
      if (ab > 1e-9 + 1e-6 * Math.abs(rhs)) uniformFails++;
    }
    if (i > 0) {
      trapAcc += 0.5 * (f.obs.v + F[i - 1].obs.v) * (t - F[i - 1].t);
      const ab = Math.abs(trapAcc - f.obs.s); if (ab > trapErrMax) { trapErrMax = ab; trapAt = t; }
    }
    // 反向：v 變號（不計由零起步）
    if (firstReverse < 0 && i > 0) {
      const v0 = F[i - 1].obs.v, v1 = f.obs.v;
      if ((v0 > 0 && v1 < 0) || (v0 < 0 && v1 > 0) || (v0 !== 0 && v1 === 0 && p.mode === "live" && p.a !== 0)) firstReverse = t;
    }
    if (firstReverse < 0) { if (f.obs.dist === Math.abs(f.obs.s)) distEqS++; else distNeS_before++; }
    else if (i > 0 && t > firstReverse) { const gap = Math.abs(f.obs.dist - Math.abs(f.obs.s)); if (gap < minGapAfter) minGapAfter = gap; if (gap === 0) distEqS_after++; }
  }
  R.err = err; R.uniform = { maxAbs: uniformMax, at: uniformAt, fails: uniformFails };
  R.trap = { maxAbs: trapErrMax, at: trapAt, final: trapAcc, sFinal: F[iT].obs.s };
  R.reverse = { firstReverse, framesBefore_distEqAbsS: distEqS, framesBefore_distNeAbsS: distNeS_before, framesAfter_distEqAbsS: distEqS_after, minGapAfter: minGapAfter === Infinity ? "n/a" : minGapAfter };
  // 3. 末幀（t = T）解析值
  const eT = expect(p, T); R.atT = { t: F[iT].t, exp: eT, got: F[iT].obs };
  // 4. 箭嘴
  const arrow = { vecEqV: 0, vecNeV: 0, vecEqA: 0, vecNeA: 0, originEqS: 0, originNeS: 0, yz: new Set(), labelEqS: 0, labelNeS: 0, scaleSets: {}, count: {}, extraKinds: 0, notTwoArrows: 0 };
  let aLenMin = Infinity, aLenMax = -Infinity;
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    for (const a of f.arrows) {
      arrow.count[a.kind] = (arrow.count[a.kind] || 0) + 1;
      if (a.kind === "velocity") { if (a.vector[0] === f.obs.v && a.vector[1] === 0 && a.vector[2] === 0) arrow.vecEqV++; else arrow.vecNeV++; }
      else if (a.kind === "acceleration") {
        if (a.vector[0] === f.obs.a && a.vector[1] === 0 && a.vector[2] === 0) arrow.vecEqA++; else arrow.vecNeA++;
        const L = Math.abs(a.vector[0]); if (L < aLenMin) aLenMin = L; if (L > aLenMax) aLenMax = L;
      } else arrow.extraKinds++;
      if (a.origin[0] === f.obs.s) arrow.originEqS++; else arrow.originNeS++;
      arrow.yz.add(a.kind + ":" + a.origin[1] + "," + a.origin[2]);
    }
    for (const [k, v] of Object.entries(f.scales)) { arrow.scaleSets[k] = arrow.scaleSets[k] || new Set(); arrow.scaleSets[k].add(v); }
    for (const l of f.labels) { if (l.symbol === "s" && l.value === f.obs.s && l.position[0] === f.obs.s && l.unit === "m") arrow.labelEqS++; else arrow.labelNeS++; }
    if (f.arrows.length !== 2) arrow.notTwoArrows++;
  }
  arrow.yz = [...arrow.yz]; for (const k in arrow.scaleSets) arrow.scaleSets[k] = [...arrow.scaleSets[k]];
  arrow.aLenMin = aLenMin; arrow.aLenMax = aLenMax;
  R.arrow = arrow;
  // 5. meta：軸範圍預測是否恆定、是否容納整段運行
  const m0 = F[0].meta; const metaConst = { smax: new Set(), vmax: new Set(), amax: new Set(), T: new Set() };
  let sAbsMax = 0, vAbsMax = 0, aAbsMax = 0, doneBeforeT = 0, doneAfterT = 0, metaMismatch = 0;
  for (let i = 0; i < F.length; i++) {
    const f = F[i]; for (const k in metaConst) metaConst[k].add(f.meta[k]);
    sAbsMax = Math.max(sAbsMax, Math.abs(f.obs.s)); vAbsMax = Math.max(vAbsMax, Math.abs(f.obs.v)); aAbsMax = Math.max(aAbsMax, Math.abs(f.obs.a));
    if (i < iT && f.meta.done) doneBeforeT++; if (i >= iT && !f.meta.done) doneAfterT++;
    if (f.meta.t !== f.t || f.meta.s !== f.obs.s || f.meta.v !== f.obs.v || f.meta.a !== f.obs.a) metaMismatch++;
  }
  for (const k in metaConst) metaConst[k] = [...metaConst[k]];
  R.meta = { metaConst, sAbsMax, vAbsMax, aAbsMax, smax: m0.smax, vmax: m0.vmax, amax: m0.amax, sInRange: sAbsMax <= m0.smax, vInRange: vAbsMax <= m0.vmax, aInRange: aAbsMax <= m0.amax, doneBeforeT, doneAfterT, metaMismatch,
    predVmax_live: p.mode === "live" ? Math.max(Math.abs(p.u), Math.abs(p.u + p.a * T)) : null, predSmax_live: p.mode === "live" ? Math.max(Math.abs(live(p, T).s), (p.a !== 0 && -p.u / p.a > 0 && -p.u / p.a < T) ? Math.abs(live(p, -p.u / p.a).s) : 0) : null };
  out.runs.push(R);
  console.log(`\n=== ${r.name} (${p.mode}) T=${T}`);
  console.log(" time", JSON.stringify(R.time));
  for (const k of KEYS) console.log(`  ${k.padEnd(8)} maxAbs=${err[k].maxAbs.toExponential(3)} at t=${err[k].at} exp=${err[k].exp} got=${err[k].got} maxRel=${err[k].maxRel.toExponential(2)} fails=${err[k].fails}`);
  console.log(" uniform", JSON.stringify(R.uniform), "trap", JSON.stringify(R.trap));
  console.log(" reverse", JSON.stringify(R.reverse));
  console.log(" atT exp", JSON.stringify(eT), "\n     got", JSON.stringify(F[iT].obs));
  console.log(" arrow", JSON.stringify(arrow));
  console.log(" meta", JSON.stringify(R.meta));
}
fs.writeFileSync(path.join(__dirname, "audit7-out.json"), JSON.stringify(out, null, 1));
