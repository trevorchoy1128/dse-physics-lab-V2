import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
const index = JSON.parse(fs.readFileSync(path.join(dataDir, "index.json"), "utf8"));
const { dt } = index;

const rows = [];
const events = [];
for (const run of index.runs) {
  const A = JSON.parse(fs.readFileSync(path.join(dataDir, run.name + ".json"), "utf8")).frames;
  const B = JSON.parse(fs.readFileSync(path.join(here, run.name + ".json"), "utf8")).frames;
  if (A.length !== B.length) throw new Error("frame count mismatch " + run.name);
  const tol = 1e-6;   // 第 4 輪：有阻力也有解析解，全部用 1e-6
  // 頂層幀 t（runner 的時鐘）也納入比對，key 名寫作 "frame.t"
  {
    let maxAbs = 0, maxRel = 0, firstBad = null;
    for (let i = 0; i < A.length; i++) {
      const a = A[i].t, b = B[i].t;
      const d = Math.abs(a - b), r = d / Math.max(Math.abs(a), Math.abs(b), 1e-12);
      if (d > maxAbs) maxAbs = d;
      if (r > maxRel) maxRel = r;
      if (d > tol && r > tol && firstBad === null) firstBad = A[i].t;
    }
    rows.push({ run: run.name, key: "frame.t", tol, maxAbs, maxRel, firstBad, pass: firstBad === null, scale: 0 });
  }
  const keys = Object.keys(A[0].obs);
  const keysB = Object.keys(B[0].obs);
  const missing = keys.filter((k) => !keysB.includes(k));
  const extra = keysB.filter((k) => !keys.includes(k));
  if (missing.length || extra.length) console.log(run.name, "key mismatch", { missing, extra });
  for (const k of keys) {
    let maxAbs = 0, maxRel = 0, firstBad = null, scale = 0;
    for (let i = 0; i < A.length; i++) {
      const a = A[i].obs[k], b = B[i].obs[k];
      const d = Math.abs(a - b);
      const r = d / Math.max(Math.abs(a), Math.abs(b), 1e-12);
      scale = Math.max(scale, Math.abs(a));
      if (d > maxAbs) maxAbs = d;
      if (r > maxRel) maxRel = r;
      // 通過準則：絕對誤差 ≤ tol，或相對誤差 ≤ tol（量值很大時）
      if (d > tol && r > tol && firstBad === null) firstBad = A[i].t;
    }
    rows.push({ run: run.name, key: k, tol, maxAbs, maxRel, firstBad, pass: firstBad === null, scale });
  }
  // 事件時刻：落地（第一幀 ay == 0 且 t > 0，或 t = 0 時已落地）
  const landIdx = (F) => F.findIndex((f) => f.obs.ay === 0 && f.obs.y === 0);
  const ia = landIdx(A), ib = landIdx(B);
  events.push({ run: run.name, idxA: ia, idxB: ib, tA: ia >= 0 ? A[ia].obs.t : null, tB: ib >= 0 ? B[ib].obs.t : null });
}

// ---- 凍結檢查：全部球落地後（主球 ay = 0 且 y = 0，且 B（若有）yB = 0）幀 t、obs 全部 key 不得再變 ----
const freeze = [];
for (const run of index.runs) {
  const A = JSON.parse(fs.readFileSync(path.join(dataDir, run.name + ".json"), "utf8")).frames;
  const B = JSON.parse(fs.readFileSync(path.join(here, run.name + ".json"), "utf8")).frames;
  const allLanded = (f) => f.obs.ay === 0 && f.obs.y === 0 && (!("yB" in f.obs) || f.obs.yB === 0);
  const analyse = (F) => {
    const i0 = F.findIndex(allLanded);
    if (i0 < 0) return { i0, tFreeze: null, tMonotone: null, tMaxDrift: null, obsMaxDrift: null, tfEqT: null };
    const ref = F[i0];
    let tMaxDrift = 0, obsMaxDrift = 0, tfEqT = true;
    for (let i = i0; i < F.length; i++) {
      tMaxDrift = Math.max(tMaxDrift, Math.abs(F[i].t - ref.t));
      for (const k of Object.keys(ref.obs)) obsMaxDrift = Math.max(obsMaxDrift, Math.abs(F[i].obs[k] - ref.obs[k]));
      if (F[i].obs.tf !== F[i].obs.t) tfEqT = false;
    }
    // 凍結前 t 必須嚴格遞增
    let tMonotone = true;
    for (let i = 1; i <= i0; i++) if (!(F[i].t > F[i - 1].t)) tMonotone = false;
    return { i0, tFreeze: ref.t, tMonotone, tMaxDrift, obsMaxDrift, tfEqT };
  };
  freeze.push({ run: run.name, main: analyse(A), second: analyse(B) });
}

const fmt = (x) => (x === null || x === undefined ? "—" : typeof x === "number" ? x.toExponential(2) : String(x));
let md = "| 運行 | key | 容限 | 最大絕對誤差 | 最大相對誤差 | 首次超限 t | 通過 |\n|---|---|---|---|---|---|---|\n";
for (const r of rows) md += `| ${r.run} | ${r.key} | ${r.tol} | ${fmt(r.maxAbs)} | ${fmt(r.maxRel)} | ${r.firstBad === null ? "—" : r.firstBad.toFixed(4)} | ${r.pass ? "是" : "否"} |\n`;
let ev = "| 運行 | 主實作落地幀 / t | 第二實作落地幀 / t | Δt (s) | ≤ 2 dt |\n|---|---|---|---|---|\n";
for (const e of events) {
  const d = e.tA !== null && e.tB !== null ? Math.abs(e.tA - e.tB) : null;
  ev += `| ${e.run} | ${e.idxA >= 0 ? e.idxA + " / " + e.tA.toFixed(6) : "4 s 內未落地"} | ${e.idxB >= 0 ? e.idxB + " / " + e.tB.toFixed(6) : "4 s 內未落地"} | ${d === null ? "—" : d.toExponential(2)} | ${d === null ? (e.idxA === e.idxB ? "是（皆未落地）" : "否") : d <= 2 * dt ? "是" : "否"} |\n`;
}
fs.writeFileSync(path.join(here, "compare-table.md"), md + "\n" + ev);
fs.writeFileSync(path.join(here, "compare-summary.json"), JSON.stringify({ rows, events, freeze }, null, 1));
const fails = rows.filter((r) => !r.pass);
console.log("rows:", rows.length, "fails:", fails.length);
for (const f of fails) console.log("FAIL", f.run, f.key, f.maxAbs, f.maxRel, f.firstBad);
console.log("max abs over all passing rows:", Math.max(...rows.filter(r=>r.pass).map((r) => r.maxAbs)));
console.log(ev);
// 按運行摘要最大誤差
for (const run of index.runs) {
  const rr = rows.filter((r) => r.run === run.name);
  console.log(run.name, "air=" + run.params.air, "worst key:", rr.reduce((m, r) => (r.maxAbs > m.maxAbs ? r : m)).key, Math.max(...rr.map((r) => r.maxAbs)).toExponential(3));
}
