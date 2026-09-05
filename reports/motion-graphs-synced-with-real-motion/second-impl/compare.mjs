// 第 5 輪比對：主實作 0.4.0（凍結時 t 截斷為恰等於 T，最後一步 h = T − t；折線斜率索引夾住末節點；歸零規則沿 0.3.0）
import fs from "node:fs";
import path from "node:path";
import { snapZero, SNAP_KEYS, SNAP_EPS } from "./model.mjs";
const root = "C:/Users/trevor/dev/dse-physics-lab/reports/motion-graphs-synced-with-real-motion";
const index = JSON.parse(fs.readFileSync(path.join(root, "data/index.json"), "utf8"));
const dt = index.dt;
const TOL = 1e-6;          // 全部量皆有解析解
const EVENT_DT = 2 * dt;   // 事件（a 在節點處跳變）時刻容限
const keys = ["s", "dist", "v", "a", "speed", "area", "avgSpeed", "avgVel"];
const rows = [];
const failures = [];
const snapReport = [];
const zeroFrames = [];     // 解析值恰為 0（t > 0）的幀
const r5 = [];             // 第 5 輪專項
for (const run of index.runs) {
  const A = JSON.parse(fs.readFileSync(path.join(root, "data", run.name + ".json"), "utf8")).frames;
  const B = JSON.parse(fs.readFileSync(path.join(root, "second-impl", run.name + ".json"), "utf8")).frames;
  if (A.length !== B.length) failures.push(`${run.name}: 幀數不同 ${A.length} vs ${B.length}`);
  const n = Math.min(A.length, B.length);
  let maxTdiff = 0;
  for (let i = 0; i < n; i++) maxTdiff = Math.max(maxTdiff, Math.abs(A[i].t - B[i].t));
  // ---- A. 容限比對（主實作 vs 第二實作純解析值） ----
  for (const k of keys) {
    let maxAbs = 0, maxRel = 0, firstT = null, nEventTolerated = 0, nFail = 0;
    for (let i = 0; i < n; i++) {
      const a = A[i].obs[k], b = B[i].obs[k];
      const d = Math.abs(a - b);
      const rel = d / Math.max(Math.abs(a), Math.abs(b), 1e-12);
      const ok = d <= TOL || rel <= TOL;
      if (!ok) {
        let tolerated = false;
        if (k === "a" && run.params.mode === "draw") {
          const t = B[i].t, node = Math.round(t);
          if (Math.abs(t - node) <= EVENT_DT) {
            const vt = run.params.vt;
            const slopes = [];
            if (node - 1 >= 0 && node < vt.length) slopes.push(vt[node] - vt[node - 1]);
            if (node + 1 < vt.length) slopes.push(vt[node + 1] - vt[node]);
            if (node >= vt.length - 1) slopes.push(0);
            if (slopes.some(m => Math.abs(m - a) <= TOL)) tolerated = true;
          }
        }
        if (tolerated) nEventTolerated++;
        else { nFail++; if (firstT === null) firstT = B[i].t; }
      }
      maxAbs = Math.max(maxAbs, d); maxRel = Math.max(maxRel, rel);
    }
    rows.push({ run: run.name, key: k, maxAbs, maxRel, firstT, nEventTolerated, pass: nFail === 0 });
    if (nFail > 0) failures.push(`${run.name}.${k}: ${nFail} 幀超限，首次 t=${firstT}`);
  }
  rows.push({ run: run.name, key: "(t)", maxAbs: maxTdiff, maxRel: 0, firstT: null, nEventTolerated: 0, pass: maxTdiff < dt / 10 });

  // ---- B. 歸零專項檢查 ----
  const r = { run: run.name, mode: run.params.mode, T: run.params.T,
    mainZeroButMineBig: [],      // 主實作為 0 但 |第二| ≥ 1e-9：歸零影響了不該影響的值
    mainTinyNotZero: [],         // 主實作 0 < |x| < 1e-9：應歸零而未歸零
    mineTinyMainNotZero: [],     // |第二| < 1e-9 但主實作 ≠ 0（近閾值歧義以外即為問題）
    aSnapped: [],                // a 被歸零（規則不含 a）
    speedNeAbsV: 0,              // 主實作 speed ≠ |v|
    speedZeroMismatch: 0,        // speed 為 0 與 v 為 0 不一致
    sZeroAvgVelNot: [],          // s 歸零但 avgVel 未歸零（或反之），僅觀察
    snappedExact: 0, snappedTotal: 0, // 套用同一規則後完全相等的 (幀,key) 數
    mainZeroCount: {}, mineSnapZeroCount: {} };
  for (const k of keys) { r.mainZeroCount[k] = 0; r.mineSnapZeroCount[k] = 0; }
  for (let i = 0; i < n; i++) {
    const a = A[i].obs, b = B[i].obs, bs = snapZero(b), t = B[i].t;
    for (const k of SNAP_KEYS) {
      if (a[k] === 0 && Math.abs(b[k]) >= SNAP_EPS) r.mainZeroButMineBig.push({ t, k, mine: b[k] });
      if (a[k] !== 0 && Math.abs(a[k]) < SNAP_EPS) r.mainTinyNotZero.push({ t, k, main: a[k] });
      if (Math.abs(b[k]) < SNAP_EPS && a[k] !== 0) r.mineTinyMainNotZero.push({ t, k, mine: b[k], main: a[k] });
      if (t > 0 && Math.abs(b[k]) <= 1e-12) zeroFrames.push({ run: run.name, t, k, mine: b[k], main: a[k], mainExactZero: a[k] === 0 });
    }
    if (a.a === 0 && b.a !== 0) r.aSnapped.push({ t, mine: b.a });
    if (a.speed !== Math.abs(a.v)) r.speedNeAbsV++;
    if ((a.speed === 0) !== (a.v === 0)) r.speedZeroMismatch++;
    if (t > 0 && ((a.s === 0) !== (a.avgVel === 0))) r.sZeroAvgVelNot.push({ t, s: a.s, avgVel: a.avgVel });
    for (const k of keys) {
      r.snappedTotal++;
      if (a[k] === bs[k]) r.snappedExact++;
      if (a[k] === 0) r.mainZeroCount[k]++;
      if (bs[k] === 0) r.mineSnapZeroCount[k]++;
    }
  }
  // ---- C. 第 5 輪專項：凍結幀 t === T、非有限值、末幀 v/a 一致 ----
  {
    const T = run.params.T, iT = Math.round(T / dt);
    const c = { run: run.name, T,
      mainLastT: A[n - 1].t, mineLastT: B[n - 1].t,
      mainLastTExact: A[n - 1].t === T, mineLastTExact: B[n - 1].t === T,
      mainFirstAtT: A.findIndex(f => f.t === T), mineFirstAtT: B.findIndex(f => f.t === T),
      mainAfterTNotT: 0, mineAfterTNotT: 0, mainNonFinite: 0, mineNonFinite: 0,
      mainPreT: A[iT - 1].t, mainLastStep: T - A[iT - 1].t };
    for (let i = 0; i < n; i++) {
      if (i >= iT) { if (A[i].t !== T) c.mainAfterTNotT++; if (B[i].t !== T) c.mineAfterTNotT++; }
      if (!Number.isFinite(A[i].t)) c.mainNonFinite++;
      if (!Number.isFinite(B[i].t)) c.mineNonFinite++;
      for (const k of keys) { if (!Number.isFinite(A[i].obs[k])) c.mainNonFinite++; if (!Number.isFinite(B[i].obs[k])) c.mineNonFinite++; }
    }
    let vExp, aExp;
    if (run.params.mode === "draw") {
      const vt = run.params.vt, m = vt.length - 1;
      if (T >= m) { vExp = vt[m]; aExp = T > m ? 0 : vt[m] - vt[m - 1]; }
      else { const i0 = Math.floor(T); vExp = vt[i0] + (vt[i0 + 1] - vt[i0]) * (T - i0); aExp = Number.isInteger(T) ? vt[i0] - vt[i0 - 1] : vt[i0 + 1] - vt[i0]; }
    } else { vExp = run.params.u + run.params.a * T; aExp = run.params.a; }
    c.vExp = vExp; c.aExp = aExp;
    c.mainVLast = A[n - 1].obs.v; c.mainALast = A[n - 1].obs.a; c.mineVLast = B[n - 1].obs.v; c.mineALast = B[n - 1].obs.a;
    c.mainVOk = Math.abs(A[n - 1].obs.v - vExp) <= 1e-9 * Math.max(1, Math.abs(vExp)); c.mainAOk = Math.abs(A[n - 1].obs.a - aExp) <= 1e-12;
    c.mineVOk = Math.abs(B[n - 1].obs.v - vExp) <= 1e-9 * Math.max(1, Math.abs(vExp)); c.mineAOk = Math.abs(B[n - 1].obs.a - aExp) <= 1e-12;
    c.mainFrozenSame = true; c.mineFrozenSame = true;
    for (let i = iT; i < n; i++) { for (const k of keys) { if (A[i].obs[k] !== A[iT].obs[k]) c.mainFrozenSame = false; if (B[i].obs[k] !== B[iT].obs[k]) c.mineFrozenSame = false; } }
    r5.push(c);
    if (!c.mainLastTExact) failures.push(run.name + ": 主實作末幀 t=" + c.mainLastT + " ≠ T");
    if (!c.mineLastTExact) failures.push(run.name + ": 第二實作末幀 t=" + c.mineLastT + " ≠ T");
    if (c.mainAfterTNotT) failures.push(run.name + ": 主實作凍結後 " + c.mainAfterTNotT + " 幀 t ≠ T");
    if (c.mainNonFinite) failures.push(run.name + ": 主實作非有限值 " + c.mainNonFinite);
    if (c.mineNonFinite) failures.push(run.name + ": 第二實作非有限值 " + c.mineNonFinite);
    if (!c.mainVOk || !c.mainAOk) failures.push(run.name + ": 主實作末幀 v/a 與期望不符 v=" + c.mainVLast + " a=" + c.mainALast);
    if (!c.mineVOk || !c.mineAOk) failures.push(run.name + ": 第二實作末幀 v/a 與期望不符");
    if (!c.mainFrozenSame) failures.push(run.name + ": 主實作凍結後 obs 不恆定");
  }
  snapReport.push(r);
  if (r.mainZeroButMineBig.length) failures.push(`${run.name}: 歸零影響了 |x| ≥ 1e-9 的值 ${r.mainZeroButMineBig.length} 處`);
  if (r.mainTinyNotZero.length) failures.push(`${run.name}: 0 < |x| < 1e-9 未歸零 ${r.mainTinyNotZero.length} 處`);
  if (r.aSnapped.length) failures.push(`${run.name}: a 被歸零 ${r.aSnapped.length} 處`);
  if (r.speedNeAbsV) failures.push(`${run.name}: speed ≠ |v| ${r.speedNeAbsV} 幀`);
  // 近閾值歧義：|第二| 在 [1e-9 − 1e-11, 1e-9) 內可容許；其餘視為未歸零
  const strict = r.mineTinyMainNotZero.filter(x => Math.abs(x.mine) < SNAP_EPS - 1e-11);
  if (strict.length) failures.push(`${run.name}: 第二實作 |x| < 1e-9 但主實作未歸零 ${strict.length} 處（首個 t=${strict[0].t} ${strict[0].k} 主=${strict[0].main}）`);
}
console.log("| 運行 | key | 最大絕對誤差 | 最大相對誤差 | 首次超限 t | 節點容限幀 | 通過 |");
console.log("|---|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.run} | ${r.key} | ${r.maxAbs.toExponential(2)} | ${r.maxRel.toExponential(2)} | ${r.firstT === null ? "—" : r.firstT} | ${r.nEventTolerated} | ${r.pass ? "是" : "否"} |`);
console.log("\n=== 歸零專項 ===");
for (const r of snapReport) {
  console.log(`${r.run} (${r.mode}, T=${r.T}): 主0但第二≥1e-9:${r.mainZeroButMineBig.length} 主0<|x|<1e-9未歸零:${r.mainTinyNotZero.length} 第二<1e-9但主≠0:${r.mineTinyMainNotZero.length} a被歸零:${r.aSnapped.length} speed≠|v|:${r.speedNeAbsV} speed/v零不一致:${r.speedZeroMismatch} s與avgVel歸零不同步:${r.sZeroAvgVelNot.length} 套規則後完全相等:${r.snappedExact}/${r.snappedTotal}`);
  console.log(`   主實作各鍵零幀數 ${JSON.stringify(r.mainZeroCount)}`);
  console.log(`   第二套規則零幀數 ${JSON.stringify(r.mineSnapZeroCount)}`);
  if (r.mineTinyMainNotZero.length) console.log("   第二<1e-9但主≠0:", JSON.stringify(r.mineTinyMainNotZero.slice(0, 5)));
  if (r.sZeroAvgVelNot.length) console.log("   s/avgVel 不同步:", JSON.stringify(r.sZeroAvgVelNot.slice(0, 5)));
}
console.log("\n=== 解析值恰為 0 的幀（t > 0）===");
for (const z of zeroFrames.filter(z => z.run !== "scenario-st-not-path")) console.log(`${z.run} t=${z.t} ${z.k}: 第二=${z.mine} 主=${z.main} 主恰為0:${z.mainExactZero}`);
console.log("\n=== 第 5 輪專項：凍結幀 t === T、非有限值、末幀 v/a ===");
console.log("| 運行 | T | 主末幀 t | 第二末幀 t | 主 T−dt 幀 t | 主最後一步 h | 主首個 t=T 幀 | 凍結後 t≠T（主/第二） | 非有限值（主/第二） | 末幀 v（主 / 第二 / 期望） | 末幀 a（主 / 第二 / 期望） | 凍結後恆定（主/第二） |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const c of r5) console.log("| " + [c.run, c.T, c.mainLastT, c.mineLastT, c.mainPreT, c.mainLastStep.toExponential(6), c.mainFirstAtT, c.mainAfterTNotT + "/" + c.mineAfterTNotT, c.mainNonFinite + "/" + c.mineNonFinite, c.mainVLast + " / " + c.mineVLast + " / " + c.vExp + "（" + (c.mainVOk && c.mineVOk ? "一致" : "不符") + "）", c.mainALast + " / " + c.mineALast + " / " + c.aExp + "（" + (c.mainAOk && c.mineAOk ? "一致" : "不符") + "）", c.mainFrozenSame + "/" + c.mineFrozenSame].join(" | ") + " |");
console.log("\nFAILURES:", JSON.stringify(failures));
fs.writeFileSync(path.join(root, "second-impl", "compare-result.json"), JSON.stringify({ rows, failures, snapReport, zeroFrames, r5 }, null, 1));
