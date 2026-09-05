// 第 7 輪比對：主實作 0.5.0（60001 幀、dt = 0.001、T 滑桿 2–60 s）對第二實作（閉式逐段積分）
import fs from "node:fs";
import path from "node:path";
import { snapZero, SNAP_KEYS, SNAP_EPS } from "./model.mjs";
const root = "C:/Users/trevor/dev/dse-physics-lab/reports/motion-graphs-synced-with-real-motion";
const index = JSON.parse(fs.readFileSync(path.join(root, "data/index.json"), "utf8"));
const dt = index.dt;
const TOL = 1e-6;            // 所有量皆有解析解
const EVENT_DT = 2 * dt;     // 事件（draw 模式 a 在節點跳變、凍結時刻）容限
const keys = ["s", "dist", "v", "a", "speed", "area", "avgSpeed", "avgVel"];
const rows = [], failures = [], snapRep = [], freezeRep = [], driftRep = [], drawTail = [], selfRep = [];
for (const run of index.runs) {
  const A = JSON.parse(fs.readFileSync(path.join(root, "data", run.name + ".json"), "utf8")).frames;
  const B = JSON.parse(fs.readFileSync(path.join(root, "second-impl", run.name + ".json"), "utf8")).frames;
  const n = Math.min(A.length, B.length);
  if (A.length !== B.length) failures.push(`${run.name}: 幀數不同 ${A.length} vs ${B.length}`);
  const T = run.params.T, mode = run.params.mode, vt = run.params.vt;
  // ---- 幀時刻 ----
  let maxTd = 0; for (let i = 0; i < n; i++) maxTd = Math.max(maxTd, Math.abs(A[i].t - B[i].t));
  rows.push({ run: run.name, key: "(t)", maxAbs: maxTd, maxRel: 0, firstT: null, nEvent: 0, pass: maxTd <= dt / 100 });
  // ---- A. 逐鍵容限比對 ----
  for (const k of keys) {
    let maxAbs = 0, maxRel = 0, firstT = null, nEvent = 0, nFail = 0;
    for (let i = 0; i < n; i++) {
      const a = A[i].obs[k], b = B[i].obs[k];
      const d = Math.abs(a - b), rel = d / Math.max(Math.abs(a), Math.abs(b), 1e-12);
      if (d > TOL && rel > TOL) {
        let ok = false;
        if (k === "a" && mode === "draw") {
          // 節點兩側斜率皆可接受，限節點 ± 2 dt 內
          const t = B[i].t, node = Math.round(t);
          if (Math.abs(t - node) <= EVENT_DT) {
            const cand = [];
            if (node >= 1 && node < vt.length) cand.push(vt[node] - vt[node - 1]);
            if (node + 1 < vt.length) cand.push(vt[node + 1] - vt[node]);
            if (node >= vt.length - 1) cand.push(0);
            ok = cand.some(m => Math.abs(m - a) <= TOL);
          }
        }
        if (ok) nEvent++; else { nFail++; if (firstT === null) firstT = B[i].t; }
      }
      if (d > maxAbs) maxAbs = d; if (rel > maxRel) maxRel = rel;
    }
    rows.push({ run: run.name, key: k, maxAbs, maxRel, firstT, nEvent, pass: nFail === 0 });
    if (nFail) failures.push(`${run.name}.${k}: ${nFail} 幀超限，首次 t=${firstT}`);
  }
  // ---- B. 凍結：首個 t = T 的幀索引、之後 t 恆等於 T、obs 恆定、非有限值 ----
  const iTA = A.findIndex(f => f.t >= T), iTB = B.findIndex(f => f.t >= T);
  const fr = { run: run.name, T, iTA, iTB, tA: A[iTA].t, tB: B[iTB].t, exactA: A[iTA].t === T, exactB: B[iTB].t === T,
    preA: A[iTA - 1].t, lastStepA: T - A[iTA - 1].t, afterNotT: 0, frozenChanged: 0, nonFiniteA: 0, nonFiniteB: 0, lastT: A[n - 1].t };
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(A[i].t)) fr.nonFiniteA++; if (!Number.isFinite(B[i].t)) fr.nonFiniteB++;
    for (const k of keys) { if (!Number.isFinite(A[i].obs[k])) fr.nonFiniteA++; if (!Number.isFinite(B[i].obs[k])) fr.nonFiniteB++; }
    if (i >= iTA) { if (A[i].t !== T) fr.afterNotT++; for (const k of keys) if (A[i].obs[k] !== A[iTA].obs[k]) { fr.frozenChanged++; break; } }
  }
  freezeRep.push(fr);
  if (!fr.exactA) failures.push(`${run.name}: 主實作首個凍結幀 t=${fr.tA} ≠ T`);
  if (Math.abs(iTA - iTB) > 2) failures.push(`${run.name}: 凍結幀索引相差 ${iTA - iTB} 幀`);
  if (fr.afterNotT) failures.push(`${run.name}: 主實作凍結後 ${fr.afterNotT} 幀 t ≠ T`);
  if (fr.frozenChanged) failures.push(`${run.name}: 主實作凍結後 obs 變動 ${fr.frozenChanged} 幀`);
  if (fr.nonFiniteA) failures.push(`${run.name}: 主實作非有限值 ${fr.nonFiniteA}`);
  if (fr.nonFiniteB) failures.push(`${run.name}: 第二實作非有限值 ${fr.nonFiniteB}`);
  // ---- C. 累積誤差：按 5 s 分箱記錄 s、v、dist、avgVel 的最大絕對誤差 ----
  {
    const bins = {};
    for (let i = 0; i < iTA; i++) {
      const b = Math.floor(B[i].t / 5) * 5; bins[b] ??= { s: 0, v: 0, dist: 0, avgVel: 0 };
      for (const k of ["s", "v", "dist", "avgVel"]) bins[b][k] = Math.max(bins[b][k], Math.abs(A[i].obs[k] - B[i].obs[k]));
    }
    driftRep.push({ run: run.name, T, bins });
  }
  // ---- D. draw 模式 T 超出控制點範圍：t ≥ 末節點後 v 恆為末值、a = 0（主實作） ----
  if (mode === "draw") {
    const last = vt.length - 1, vEnd = vt[last];
    let vBad = 0, aBad = 0, cnt = 0, firstBad = null;
    for (let i = 0; i < n; i++) { if (A[i].t > last) { cnt++; if (Math.abs(A[i].obs.v - vEnd) > 1e-12) { vBad++; firstBad ??= A[i].t; } if (A[i].obs.a !== 0) aBad++; } }
    drawTail.push({ run: run.name, T, lastNode: last, vEnd, framesBeyond: cnt, vBad, aBad, firstBad });
    if (vBad || aBad) failures.push(`${run.name}: 超出末節點後 v/a 不保持（v ${vBad} 幀、a ${aBad} 幀）`);
  }
  // ---- E. 歸零規則 ----
  const r = { run: run.name, mode, mainZeroMineBig: [], mainTinyNotZero: [], mineTinyMainNot: [], aSnapped: 0, speedNeAbsV: 0, exactAfterSnap: 0, total: 0 };
  for (let i = 0; i < n; i++) {
    const a = A[i].obs, b = B[i].obs, bs = snapZero(b), t = B[i].t;
    for (const k of SNAP_KEYS) {
      if (a[k] === 0 && Math.abs(b[k]) >= SNAP_EPS) r.mainZeroMineBig.push({ t, k, mine: b[k] });
      if (a[k] !== 0 && Math.abs(a[k]) < SNAP_EPS) r.mainTinyNotZero.push({ t, k, main: a[k] });
      if (Math.abs(b[k]) < SNAP_EPS - 1e-11 && a[k] !== 0) r.mineTinyMainNot.push({ t, k, mine: b[k], main: a[k] });
    }
    if (a.a === 0 && b.a !== 0) r.aSnapped++;
    if (a.speed !== Math.abs(a.v)) r.speedNeAbsV++;
    for (const k of keys) { r.total++; if (a[k] === bs[k]) r.exactAfterSnap++; }
  }
  snapRep.push(r);
  if (r.mainZeroMineBig.length) failures.push(`${run.name}: 歸零影響 |x| ≥ 1e-9 的值 ${r.mainZeroMineBig.length} 處（首個 t=${r.mainZeroMineBig[0].t} ${r.mainZeroMineBig[0].k}=${r.mainZeroMineBig[0].mine}）`);
  if (r.mainTinyNotZero.length) failures.push(`${run.name}: 0<|x|<1e-9 未歸零 ${r.mainTinyNotZero.length} 處`);
  if (r.mineTinyMainNot.length) failures.push(`${run.name}: 第二 |x|<1e-9 但主未歸零 ${r.mineTinyMainNot.length} 處`);
  if (r.aSnapped) failures.push(`${run.name}: a 被歸零 ${r.aSnapped} 幀`);
  if (r.speedNeAbsV) failures.push(`${run.name}: speed ≠ |v| ${r.speedNeAbsV} 幀`);
  // ---- F. 主實作自洽（規格驗證條件）：area = s；未反向時 dist = |s|；反向後 dist > |s|；live 時 v² = u² + 2as ----
  {
    let areaNeS = 0, distNeAbsS = 0, distLeAbsS = 0, v2Bad = 0, reversed = false, firstRev = null;
    const v0 = A[0].obs.v;
    for (let i = 0; i < n; i++) {
      const o = A[i].obs;
      if (o.area !== o.s) areaNeS++;
      if (!reversed && o.v * v0 < 0) { reversed = true; firstRev = A[i].t; }
      if (!reversed) { if (Math.abs(o.dist - Math.abs(o.s)) > 1e-9 * Math.max(1, o.dist)) distNeAbsS++; }
      else if (A[i].t > (firstRev ?? 0) + 2 * dt && o.dist <= Math.abs(o.s) + 1e-9) distLeAbsS++;
      if (mode === "live") { const { u, a } = run.params; if (Math.abs(o.v * o.v - (u * u + 2 * a * o.s)) > 1e-6 * Math.max(1, o.v * o.v)) v2Bad++; }
    }
    selfRep.push({ run: run.name, areaNeS, distNeAbsS, distLeAbsS, reversed, firstRev, v2Bad });
    if (areaNeS) failures.push(`${run.name}: 主實作 area ≠ s ${areaNeS} 幀`);
    if (distNeAbsS) failures.push(`${run.name}: 主實作未反向時 dist ≠ |s| ${distNeAbsS} 幀`);
    if (distLeAbsS) failures.push(`${run.name}: 主實作反向後 dist ≤ |s| ${distLeAbsS} 幀`);
    if (v2Bad) failures.push(`${run.name}: 主實作 v² ≠ u² + 2as ${v2Bad} 幀`);
  }
}
const fmt = x => x === 0 ? "0" : x.toExponential(2);
console.log("| 運行 | key | 最大絕對誤差 | 最大相對誤差 | 首次超限 t | 節點容限幀 | 通過 |");
console.log("|---|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.run} | ${r.key} | ${fmt(r.maxAbs)} | ${fmt(r.maxRel)} | ${r.firstT ?? "—"} | ${r.nEvent} | ${r.pass ? "是" : "否"} |`);
console.log("\n=== 凍結 ===");
console.log("| 運行 | T | 主首個 t≥T 幀 | 第二首個 t≥T 幀 | 主該幀 t | t===T | 主 T⁻ 幀 t | 主最後一步 h | 凍結後 t≠T | 凍結後 obs 變動幀 | 非有限值（主/第二） | 主末幀 t |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const f of freezeRep) console.log(`| ${f.run} | ${f.T} | ${f.iTA} | ${f.iTB} | ${f.tA} | ${f.exactA} | ${f.preA} | ${f.lastStepA.toExponential(6)} | ${f.afterNotT} | ${f.frozenChanged} | ${f.nonFiniteA}/${f.nonFiniteB} | ${f.lastT} |`);
console.log("\n=== 累積誤差（各 5 s 時段內最大絕對誤差）===");
for (const d of driftRep) console.log(d.run, "T=" + d.T, Object.entries(d.bins).map(([b, v]) => `[${b}–${+b + 5}) s:${fmt(v.s)} v:${fmt(v.v)} dist:${fmt(v.dist)} avgVel:${fmt(v.avgVel)}`).join(" | "));
console.log("\n=== draw 模式超出末節點 ===");
for (const d of drawTail) console.log(JSON.stringify(d));
console.log("\n=== 歸零規則 ===");
for (const r of snapRep) console.log(`${r.run} (${r.mode}): 主0但第二≥1e-9:${r.mainZeroMineBig.length} 主0<|x|<1e-9未歸零:${r.mainTinyNotZero.length} 第二<1e-9但主≠0:${r.mineTinyMainNot.length} a被歸零:${r.aSnapped} speed≠|v|:${r.speedNeAbsV} 套規則後逐位相等:${r.exactAfterSnap}/${r.total}`);
console.log("\n=== 主實作自洽（規格驗證條件）===");
for (const s of selfRep) console.log(JSON.stringify(s));
console.log("\nFAILURES:", JSON.stringify(failures));
fs.writeFileSync(path.join(root, "second-impl", "compare-result.json"), JSON.stringify({ rows, failures, freezeRep, driftRep, drawTail, snapRep, selfRep }, null, 1));
