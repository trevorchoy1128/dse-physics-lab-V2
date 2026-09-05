// 第 9 輪邊界運行核數：對 boundary-runs9.ndjson（每行一個運行）用 audit9-model.cjs 的獨立模型逐幀比對，並核對 vt-handles 控制點與三條曲線。
// 用法：node --max-old-space-size=8192 boundary-check9.cjs > boundary-console9.txt
const fs = require("fs"), path = require("path"), readline = require("readline");
const M = require("./audit9-model.cjs");
const KEYS = ["s", "dist", "v", "a", "speed", "area", "avgSpeed", "avgVel"];
const tol = (e) => 1e-9 + 1e-6 * Math.abs(e);
(async () => {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(__dirname, "boundary-runs9.ndjson")), crlfDelay: Infinity });
  const out = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const d = JSON.parse(line); const p = d.params, F = d.frames, T = p.T; const h = M.nodeDt(p);
    // 控制點
    const expH = M.expectHandles(p);
    const H = { got: d.handles0, exp: expH, count: d.handles0 ? d.handles0.length : null, expCount: expH.length, variants: d.handleVariants, tMaxErr: 0, vMaxErr: 0, match: false, trailKeys: d.trailKeys, trailLast: d.trailLast, trailLastFail: d.trailLastFail, firstTrailLens: d.firstTrailLens, lenAtT: d.lenAtT, lenEnd: d.lenEnd, lenGrowAfterT: d.lenGrowAfterT };
    if (d.handles0 && d.handles0.length === expH.length) { let ok = true; for (let k = 0; k < expH.length; k++) { const te = Math.abs(d.handles0[k][0] - expH[k][0]), ve = Math.abs(d.handles0[k][1] - expH[k][1]); H.tMaxErr = Math.max(H.tMaxErr, te); H.vMaxErr = Math.max(H.vMaxErr, ve); if (te > 1e-9 || ve > 1e-12) ok = false; } H.match = ok; }
    const R = { name: d.name, params: p, nodeDt: h, handles: H };
    if (!F.length) { out.push(R); console.log(`\n=== ${d.name} ${JSON.stringify(p)}\n handles ${JSON.stringify(H)}`); continue; }
    let iT = -1, nan = 0, frozenOK = 0, frozenBad = 0, notReached = false, bodyNe = 0;
    for (let i = 0; i < F.length; i++) { const f = F[i]; for (const k of KEYS) if (!Number.isFinite(f.obs[k])) nan++; for (const a of f.ax) for (let j = 1; j < 5; j++) if (!Number.isFinite(a[j])) nan++;
      if (f.nb !== 1 || f.bx !== f.obs.s) bodyNe++;
      if (iT < 0) { if (f.t >= T) iT = i; } else { const same = f.t === T && KEYS.every(k => f.obs[k] === F[iT].obs[k]) && JSON.stringify(f.ax) === JSON.stringify(F[iT].ax); if (same) frozenOK++; else frozenBad++; } }
    if (iT < 0) { iT = F.length - 1; notReached = true; }
    const err = {}; for (const k of KEYS) err[k] = { maxAbs: 0, at: 0, exp: 0, got: 0, maxRel: 0, fails: 0, failAt: [] };
    const nodeA = { frames: 0, left: 0, right: 0, neither: 0, list: [] };
    let lastSign = 0, zeroAt = -1, revViaZero = false, firstRev = -1, eqBefore = 0, neBefore = 0, eqAfter = 0, neAfter = 0, minGapAfter = Infinity, trap = 0, trapMax = 0;
    for (let i = 0; i <= iT; i++) { const f = F[i]; const side = (i === iT && !notReached) ? "left" : "right"; const e = M.expect(p, f.t, side);
      const ni = i < iT ? M.nodeInfo(p, f.t) : null;
      if (ni) { nodeA.frames++; if (f.obs.a === ni.left) nodeA.left++; else if (f.obs.a === ni.right) nodeA.right++; else nodeA.neither++; if (nodeA.list.length < 4) nodeA.list.push({ i, t: f.t, a: f.obs.a, left: ni.left, right: ni.right }); }
      for (const k of KEYS) { if (k === "a" && ni) continue; const ab = Math.abs(f.obs[k] - e[k]); if (ab > err[k].maxAbs) { err[k].maxAbs = ab; err[k].at = f.t; err[k].exp = e[k]; err[k].got = f.obs[k]; } if (Math.abs(e[k]) > 1e-6) err[k].maxRel = Math.max(err[k].maxRel, ab / Math.abs(e[k])); if (ab > tol(e[k])) { err[k].fails++; if (err[k].failAt.length < 4) err[k].failAt.push([i, f.t, e[k], f.obs[k]]); } }
      if (i > 0) { trap += 0.5 * (f.obs.v + F[i - 1].obs.v) * (f.t - F[i - 1].t); trapMax = Math.max(trapMax, Math.abs(trap - f.obs.s)); }
      if (firstRev < 0) { const sv = Math.sign(f.obs.v); if (sv !== 0 && lastSign !== 0 && sv !== lastSign) { revViaZero = zeroAt >= 0; firstRev = zeroAt >= 0 ? zeroAt : f.t; } if (sv === 0 && lastSign !== 0 && zeroAt < 0) zeroAt = f.t; if (sv !== 0) { lastSign = sv; zeroAt = -1; } }
      if (firstRev < 0) { if (f.obs.dist === Math.abs(f.obs.s)) eqBefore++; else neBefore++; }
      else if (revViaZero ? f.t > firstRev : f.t >= firstRev) { const gap = Math.abs(f.obs.dist - Math.abs(f.obs.s)); if (gap < minGapAfter) minGapAfter = gap; if (gap === 0) eqAfter++; else neAfter++; } }
    let vecNe = 0, scaleSet = {}, sAbs = 0, vAbs = 0, aAbs = 0; const uniq = { smax: new Set(), vmax: new Set(), amax: new Set() };
    for (let i = 0; i < F.length; i++) { const f = F[i];
      for (const a of f.ax) { const val = a[0] === "velocity" ? f.obs.v : a[0] === "acceleration" ? f.obs.a : NaN; if (!(a[1] === f.obs.s && a[2] === val && a[3] === 0 && a[4] === 0)) vecNe++; }
      for (const [k, v] of Object.entries(f.scales)) (scaleSet[k] = scaleSet[k] || new Set()).add(v);
      for (const k in uniq) uniq[k].add(f.meta[k]);
      sAbs = Math.max(sAbs, Math.abs(f.obs.s)); vAbs = Math.max(vAbs, Math.abs(f.obs.v)); aAbs = Math.max(aAbs, Math.abs(f.obs.a)); }
    for (const k in scaleSet) scaleSet[k] = [...scaleSet[k]]; for (const k in uniq) uniq[k] = [...uniq[k]];
    const m0 = F[0].meta, eT = M.expect(p, T, "left"), ex = M.exactExtrema(p, T);
    const freezeA = { a: F[iT].obs.a, t: F[iT].t, expLeft: eT.a, expRight: M.expect(p, T, "right").a, equalsLeft: F[iT].obs.a === eT.a };
    const near = []; for (const i of [iT - 500, iT - 1, iT, iT + 1]) if (F[i]) near.push({ i, t: F[i].t, v: F[i].obs.v, a: F[i].obs.a, done: F[i].meta.done });
    Object.assign(R, { notReached, iT, tAtT: F[iT].t, tEqualsT: F[iT].t === T, nan, frozenOK, frozenBad, bodyNe, err, nodeA, trapMax, reverse: { firstRev, revViaZero, revAnalytic: M.firstReversal(p, T), eqBefore, neBefore, eqAfter, neAfter, minGapAfter: minGapAfter === Infinity ? null : minGapAfter }, vecNe, scaleSet, uniq, dataAbsMax: { s: sAbs, v: vAbs, a: aAbs }, exact: ex, meta0: { smax: m0.smax, vmax: m0.vmax, amax: m0.amax }, sIn: sAbs <= m0.smax, vIn: vAbs <= m0.vmax * (1 + 1e-9), aIn: aAbs <= m0.amax * (1 + 1e-9), drawAmaxExpected: p.mode === "draw" ? M.drawAmax(p) : null, freezeA, near, atT: { exp: eT, got: F[iT].obs } });
    out.push(R);
    console.log(`\n=== ${d.name} ${JSON.stringify(p)} nodeDt=${h}`);
    console.log(` handles count=${H.count}/${H.expCount} match=${H.match} tMaxErr=${H.tMaxErr} vMaxErr=${H.vMaxErr} variants=${H.variants} got=${JSON.stringify(H.got)}`);
    console.log(` trails keys=${JSON.stringify(H.trailKeys)} lastPointFails=${JSON.stringify(H.trailLast)} firstLens=${JSON.stringify(H.firstTrailLens)} lenAtT=${H.lenAtT} lenEnd=${H.lenEnd} growAfterT=${H.lenGrowAfterT} ${H.trailLastFail.length ? JSON.stringify(H.trailLastFail) : ""}`);
    console.log(` notReached=${notReached} iT=${iT} tAtT=${F[iT].t} tEqualsT=${F[iT].t === T} nan=${nan} frozenOK=${frozenOK} frozenBad=${frozenBad} bodyNe=${bodyNe} vecNe=${vecNe} scales=${JSON.stringify(scaleSet)} metaUniq=${JSON.stringify(uniq)}`);
    for (const k of KEYS) console.log(`  ${k.padEnd(8)} maxAbs=${err[k].maxAbs.toExponential(3)} at t=${err[k].at} exp=${err[k].exp} got=${err[k].got} maxRel=${err[k].maxRel.toExponential(2)} fails=${err[k].fails} ${err[k].fails ? JSON.stringify(err[k].failAt) : ""}`);
    console.log(` trapMax=${trapMax.toExponential(3)} reverse=${JSON.stringify(R.reverse)}`);
    if (p.mode === "draw") console.log(` nodeA=${JSON.stringify(nodeA)}\n freezeA=${JSON.stringify(freezeA)} near=${JSON.stringify(near)}`);
    console.log(` data|s|max=${sAbs} |v|max=${vAbs} |a|max=${aAbs}  exact=${JSON.stringify({ sMax: ex.sMax, sAt: ex.sAt, vMax: ex.vMax, aMax: ex.aMax })}  meta=${JSON.stringify(R.meta0)}  sIn=${R.sIn} vIn=${R.vIn} aIn=${R.aIn} drawAmaxExpected=${R.drawAmaxExpected}`);
    console.log(` atT exp=${JSON.stringify(eT)}\n     got=${JSON.stringify(F[iT].obs)}`);
  }
  fs.writeFileSync(path.join(__dirname, "boundary-out9.json"), JSON.stringify(out, null, 1));
})();
