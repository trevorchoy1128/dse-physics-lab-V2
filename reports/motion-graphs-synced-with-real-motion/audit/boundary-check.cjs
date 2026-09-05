// 邊界運行核數：對 boundary-runs.json（由 boundary-export.mts 產生）用與 audit7.cjs 相同的獨立模型逐幀比對
const fs = require("fs"); const path = require("path");
function live(p, t) { const { u, a } = p; const v = u + a * t; const s = u * t + 0.5 * a * t * t; let dist;
  if (a !== 0) { const t0 = -u / a; if (t0 > 0 && t0 < t) { const s0 = u * t0 + 0.5 * a * t0 * t0; dist = Math.abs(s0) + Math.abs(s - s0); } else dist = Math.abs(s); } else dist = Math.abs(s);
  return { s, v, a, dist }; }
function drawSeg(vt, t) { const n = vt.length - 1; if (t >= n) return { v: vt[n], a: 0 }; const k = Math.floor(t); const a = vt[k + 1] - vt[k]; return { v: vt[k] + a * (t - k), a }; }
function draw(p, t) { const vt = p.vt; const n = vt.length - 1; let s = 0, dist = 0;
  const segArea = (v0, v1, len) => 0.5 * (v0 + v1) * len;
  const segDist = (v0, v1, len) => { if (len <= 0) return 0; if (v0 * v1 < 0) { const tz = len * v0 / (v0 - v1); return Math.abs(0.5 * v0 * tz) + Math.abs(0.5 * v1 * (len - tz)); } return Math.abs(segArea(v0, v1, len)); };
  for (let k = 0; k < n; k++) { if (t <= k) break; const len = Math.min(t, k + 1) - k; const v0 = vt[k], v1 = vt[k] + (vt[k + 1] - vt[k]) * len; s += segArea(v0, v1, len); dist += segDist(v0, v1, len); }
  if (t > n) { s += vt[n] * (t - n); dist += Math.abs(vt[n]) * (t - n); }
  const { v, a } = drawSeg(vt, t); return { s, v, a, dist }; }
function expect(p, t) { const m = p.mode === "draw" ? draw(p, t) : live(p, t); return { ...m, speed: Math.abs(m.v), area: m.s, avgSpeed: t > 0 ? m.dist / t : 0, avgVel: t > 0 ? m.s / t : 0 }; }
const KEYS = ["s", "dist", "v", "a", "speed", "area", "avgSpeed", "avgVel"];
const tol = (e) => 1e-9 + 1e-6 * Math.abs(e);
const runs = JSON.parse(fs.readFileSync(path.join(__dirname, "boundary-runs.json"), "utf8"));
const out = [];
for (const d of runs) {
  const p = d.params, F = d.frames, T = p.T;
  let iT = -1, nan = 0, frozenBad = 0, frozenOK = 0;
  for (let i = 0; i < F.length; i++) { const f = F[i]; for (const k of KEYS) if (!Number.isFinite(f.obs[k])) nan++;
    for (const a of f.ax) for (let j = 2; j < 5; j++) if (!Number.isFinite(a[j])) nan++;
    if (iT < 0) { if (f.t >= T) iT = i; } else { const same = f.t === T && KEYS.every(k => f.obs[k] === F[iT].obs[k]); if (same) frozenOK++; else frozenBad++; } }
  let notReached = false; if (iT < 0) { iT = F.length - 1; notReached = true; }
  const err = {}; for (const k of KEYS) err[k] = { maxAbs: 0, at: 0, exp: 0, got: 0, fails: 0, failAt: [] };
  let vecNe = 0, scaleSet = {}, sAbs = 0, vAbs = 0, aAbs = 0;
  for (let i = 0; i <= iT; i++) { const f = F[i]; const e = expect(p, f.t);
    for (const k of KEYS) { const ab = Math.abs(f.obs[k] - e[k]); if (ab > err[k].maxAbs) { err[k].maxAbs = ab; err[k].at = f.t; err[k].exp = e[k]; err[k].got = f.obs[k]; } if (ab > tol(e[k])) { err[k].fails++; if (err[k].failAt.length < 5) err[k].failAt.push([f.t, e[k], f.obs[k]]); } } }
  for (let i = 0; i < F.length; i++) { const f = F[i];
    for (const a of f.ax) { const val = a[0] === "velocity" ? f.obs.v : a[0] === "acceleration" ? f.obs.a : NaN; if (!(a[1] === f.obs.s && a[2] === val && a[3] === 0 && a[4] === 0)) vecNe++; }
    for (const [k, v] of Object.entries(f.scales)) { scaleSet[k] = scaleSet[k] || new Set(); scaleSet[k].add(v); }
    sAbs = Math.max(sAbs, Math.abs(f.obs.s)); vAbs = Math.max(vAbs, Math.abs(f.obs.v)); aAbs = Math.max(aAbs, Math.abs(f.obs.a)); }
  for (const k in scaleSet) scaleSet[k] = [...scaleSet[k]];
  const m0 = F[0].meta; const eT = expect(p, T);
  const R = { name: d.name, params: p, notReached, iT, tAtT: F[iT].t, tEqualsT: F[iT].t === T, nan, frozenOK, frozenBad, err, vecNe, scaleSet, sAbs, vAbs, aAbs, meta0: { smax: m0.smax, vmax: m0.vmax, amax: m0.amax }, atT: { exp: eT, got: F[iT].obs } };
  out.push(R);
  console.log(`\n=== ${d.name} ${JSON.stringify(p)}`);
  console.log(` notReached=${notReached} iT=${iT} tAtT=${F[iT].t} tEqualsT=${F[iT].t === T} nan=${nan} frozenOK=${frozenOK} frozenBad=${frozenBad} vecNe=${vecNe} scales=${JSON.stringify(scaleSet)}`);
  for (const k of KEYS) console.log(`  ${k.padEnd(8)} maxAbs=${err[k].maxAbs.toExponential(3)} at t=${err[k].at} exp=${err[k].exp} got=${err[k].got} fails=${err[k].fails} ${err[k].fails ? JSON.stringify(err[k].failAt) : ""}`);
  console.log(` |s|max=${sAbs} |v|max=${vAbs} |a|max=${aAbs} meta=${JSON.stringify(R.meta0)}`);
  console.log(` atT exp=${JSON.stringify(eT)}\n     got=${JSON.stringify(F[iT].obs)}`);
}
fs.writeFileSync(path.join(__dirname, "boundary-out.json"), JSON.stringify(out, null, 1));
