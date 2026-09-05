// 第 8 輪邊界運行核數：對 boundary-runs8.ndjson（每行一個運行）用與 audit8.cjs 相同的獨立模型逐幀比對
// 用法：node --max-old-space-size=6144 boundary-check8.cjs > boundary-console8.txt
const fs = require("fs"), path = require("path"), readline = require("readline");
function segments(p) { if (p.mode !== "draw") return [{ t0: 0, v0: p.u, m: p.a, len: Infinity }]; const vt = p.vt, n = vt.length - 1, segs = []; for (let k = 0; k < n; k++) segs.push({ t0: k, v0: vt[k], m: vt[k + 1] - vt[k], len: 1 }); segs.push({ t0: n, v0: vt[n], m: 0, len: Infinity }); return segs; }
function segS(g, tau) { return g.v0 * tau + 0.5 * g.m * tau * tau; }
function segD(g, tau) { if (tau <= 0) return 0; if (g.m !== 0) { const tz = -g.v0 / g.m; if (tz > 0 && tz < tau) return Math.abs(segS(g, tz)) + Math.abs(segS(g, tau) - segS(g, tz)); } return Math.abs(segS(g, tau)); }
function segIndex(segs, t) { let k = 0; while (k + 1 < segs.length && t >= segs[k + 1].t0) k++; return k; }
function state(p, t) { const segs = segments(p); let s = 0, d = 0; for (let k = 0; k < segs.length; k++) { const g = segs[k]; if (t <= g.t0) break; const tau = Math.min(t, g.t0 + g.len) - g.t0; s += segS(g, tau); d += segD(g, tau); if (t <= g.t0 + g.len) break; } const g = segs[segIndex(segs, t)]; return { s, dist: d, v: g.v0 + g.m * (t - g.t0), a: g.m }; }
function expect(p, t) { const m = state(p, t); return { ...m, speed: Math.abs(m.v), area: m.s, avgSpeed: t > 0 ? m.dist / t : 0, avgVel: t > 0 ? m.s / t : 0 }; }
function slopes(p, k) { const vt = p.vt; return { left: k >= 1 && k <= vt.length - 1 ? vt[k] - vt[k - 1] : null, right: k < vt.length - 1 ? vt[k + 1] - vt[k] : 0 }; }
function exactExtrema(p, T) { const segs = segments(p); const cand = new Set([0, T]); for (const g of segs) { if (g.t0 > 0 && g.t0 < T) cand.add(g.t0); if (g.m !== 0) { const tz = g.t0 - g.v0 / g.m; if (tz > g.t0 && tz < g.t0 + g.len && tz > 0 && tz < T) cand.add(tz); } } let sMax = 0, sAt = 0, vMax = 0, aMax = 0; for (const t of cand) { const st = state(p, t); if (Math.abs(st.s) > sMax) { sMax = Math.abs(st.s); sAt = t; } vMax = Math.max(vMax, Math.abs(st.v)); } for (const g of segs) if (g.t0 < T) aMax = Math.max(aMax, Math.abs(g.m)); return { sMax, sAt, vMax, aMax }; }
function level125(x, relTol) { if (!(x > 0)) return null; const y = x * (1 - (relTol || 0)); const e = Math.floor(Math.log10(y)); for (const mant of [1, 2, 5, 10]) { const L = mant * Math.pow(10, e); if (L >= y) return L; } return null; }
const KEYS = ["s", "dist", "v", "a", "speed", "area", "avgSpeed", "avgVel"];
const tol = (e) => 1e-9 + 1e-6 * Math.abs(e);
(async () => {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(__dirname, "boundary-runs8.ndjson")), crlfDelay: Infinity });
  const out = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const d = JSON.parse(line); const p = d.params, F = d.frames, T = p.T;
    let iT = -1, nan = 0, frozenOK = 0, frozenBad = 0, notReached = false;
    for (let i = 0; i < F.length; i++) { const f = F[i]; for (const k of KEYS) if (!Number.isFinite(f.obs[k])) nan++; for (const a of f.ax) for (let j = 1; j < 5; j++) if (!Number.isFinite(a[j])) nan++;
      if (iT < 0) { if (f.t >= T) iT = i; } else { const same = f.t === T && KEYS.every(k => f.obs[k] === F[iT].obs[k]) && JSON.stringify(f.ax) === JSON.stringify(F[iT].ax); if (same) frozenOK++; else frozenBad++; } }
    if (iT < 0) { iT = F.length - 1; notReached = true; }
    const err = {}; for (const k of KEYS) err[k] = { maxAbs: 0, at: 0, exp: 0, got: 0, fails: 0, failAt: [] };
    const nodeA = { frames: 0, left: 0, right: 0, neither: 0, list: [] };
    for (let i = 0; i <= iT; i++) { const f = F[i]; const e = expect(p, f.t); let isNode = false;
      if (p.mode === "draw") { const k = Math.round(f.t); if (Math.abs(f.t - k) < 1e-9 && k >= 1 && k <= p.vt.length - 1 && f.t < T) { isNode = true; nodeA.frames++; const sl = slopes(p, k); if (f.obs.a === sl.left) nodeA.left++; else if (f.obs.a === sl.right) nodeA.right++; else nodeA.neither++; if (nodeA.list.length < 4) nodeA.list.push({ i, t: f.t, a: f.obs.a, ...sl }); } }
      for (const k of KEYS) { if (k === "a" && isNode) continue; const ab = Math.abs(f.obs[k] - e[k]); if (ab > err[k].maxAbs) { err[k].maxAbs = ab; err[k].at = f.t; err[k].exp = e[k]; err[k].got = f.obs[k]; } if (ab > tol(e[k])) { err[k].fails++; if (err[k].failAt.length < 4) err[k].failAt.push([i, f.t, e[k], f.obs[k]]); } } }
    let vecNe = 0, scaleSet = {}, sAbs = 0, vAbs = 0, aAbs = 0; const uniq = { smax: new Set(), vmax: new Set(), amax: new Set() };
    for (let i = 0; i < F.length; i++) { const f = F[i];
      for (const a of f.ax) { const val = a[0] === "velocity" ? f.obs.v : a[0] === "acceleration" ? f.obs.a : NaN; if (!(a[1] === f.obs.s && a[2] === val && a[3] === 0 && a[4] === 0)) vecNe++; }
      for (const [k, v] of Object.entries(f.scales)) (scaleSet[k] = scaleSet[k] || new Set()).add(v);
      for (const k in uniq) uniq[k].add(f.meta[k]);
      sAbs = Math.max(sAbs, Math.abs(f.obs.s)); vAbs = Math.max(vAbs, Math.abs(f.obs.v)); aAbs = Math.max(aAbs, Math.abs(f.obs.a)); }
    for (const k in scaleSet) scaleSet[k] = [...scaleSet[k]]; for (const k in uniq) uniq[k] = [...uniq[k]];
    const m0 = F[0].meta, eT = expect(p, T), ex = exactExtrema(p, T);
    // 凍結幀 a 與左右段
    const freezeA = { a: F[iT].obs.a, t: F[iT].t }; if (p.mode === "draw" && Number.isInteger(T) && T >= 1 && T <= p.vt.length - 1) Object.assign(freezeA, slopes(p, T), { equalsLeft: F[iT].obs.a === slopes(p, T).left });
    // 節點前後三幀（供報告）
    const near = []; if (p.mode === "draw" && Number.isInteger(T)) for (const i of [iT - 500, iT - 1, iT, iT + 1]) if (F[i]) near.push({ i, t: F[i].t, v: F[i].obs.v, a: F[i].obs.a, done: F[i].meta.done });
    const R = { name: d.name, params: p, notReached, iT, tAtT: F[iT].t, tEqualsT: F[iT].t === T, nan, frozenOK, frozenBad, err, nodeA, vecNe, scaleSet, uniq, dataAbsMax: { s: sAbs, v: vAbs, a: aAbs }, exact: ex, meta0: { smax: m0.smax, vmax: m0.vmax, amax: m0.amax }, sIn: sAbs <= m0.smax, vIn: vAbs <= m0.vmax * (1 + 1e-9), aIn: aAbs <= m0.amax * (1 + 1e-9), sLevel125: level125(ex.sMax, 1e-9), freezeA, near, atT: { exp: eT, got: F[iT].obs } };
    out.push(R);
    console.log(`\n=== ${d.name} ${JSON.stringify(p)}`);
    console.log(` notReached=${notReached} iT=${iT} tAtT=${F[iT].t} tEqualsT=${F[iT].t === T} nan=${nan} frozenOK=${frozenOK} frozenBad=${frozenBad} vecNe=${vecNe} scales=${JSON.stringify(scaleSet)} metaUniq=${JSON.stringify(uniq)}`);
    for (const k of KEYS) console.log(`  ${k.padEnd(8)} maxAbs=${err[k].maxAbs.toExponential(3)} at t=${err[k].at} exp=${err[k].exp} got=${err[k].got} fails=${err[k].fails} ${err[k].fails ? JSON.stringify(err[k].failAt) : ""}`);
    if (p.mode === "draw") console.log(` nodeA=${JSON.stringify(nodeA)}\n freezeA=${JSON.stringify(freezeA)} near=${JSON.stringify(near)}`);
    console.log(` data|s|max=${sAbs} |v|max=${vAbs} |a|max=${aAbs}  exact=${JSON.stringify(ex)}  meta=${JSON.stringify(R.meta0)}  sIn=${R.sIn} vIn=${R.vIn} aIn=${R.aIn}  level125(|s|max)=${R.sLevel125}`);
    console.log(` atT exp=${JSON.stringify(eT)}\n     got=${JSON.stringify(F[iT].obs)}`);
  }
  fs.writeFileSync(path.join(__dirname, "boundary-out8.json"), JSON.stringify(out, null, 1));
})();
