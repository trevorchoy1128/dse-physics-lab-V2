import fs from "node:fs";
import path from "node:path";
const root = "C:/Users/trevor/dev/dse-physics-lab/reports/motion-graphs-synced-with-real-motion";
const index = JSON.parse(fs.readFileSync(path.join(root, "data/index.json"), "utf8"));
const dt = index.dt;
const TOL = 1e-6;          // 全部量皆有解析解
const EVENT_DT = 2 * dt;   // 事件（a 在節點處跳變）時刻容限
const keys = ["s", "dist", "v", "a", "speed", "area", "avgSpeed", "avgVel"];
const rows = [];
const failures = [];
for (const run of index.runs) {
  const A = JSON.parse(fs.readFileSync(path.join(root, "data", run.name + ".json"), "utf8")).frames;
  const B = JSON.parse(fs.readFileSync(path.join(root, "second-impl", run.name + ".json"), "utf8")).frames;
  if (A.length !== B.length) failures.push(`${run.name}: 幀數不同 ${A.length} vs ${B.length}`);
  const n = Math.min(A.length, B.length);
  // 幀時刻
  let maxTdiff = 0;
  for (let i = 0; i < n; i++) maxTdiff = Math.max(maxTdiff, Math.abs(A[i].t - B[i].t));
  for (const k of keys) {
    let maxAbs = 0, maxRel = 0, firstT = null, nEventTolerated = 0, nFail = 0;
    for (let i = 0; i < n; i++) {
      const a = A[i].obs[k], b = B[i].obs[k];
      const d = Math.abs(a - b);
      const rel = d / Math.max(Math.abs(a), Math.abs(b), 1e-12);
      const ok = d <= TOL || rel <= TOL;
      if (!ok) {
        // a 是分段常數，在 draw 模式節點處跳變；若該幀落在節點 ±2dt 內，
        // 且主實作值等於相鄰段的斜率，視為事件時刻容限內
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
      if (!(k === "a" && d > TOL && firstT === null && nFail === 0 && rel > TOL)) {
        maxAbs = Math.max(maxAbs, d); maxRel = Math.max(maxRel, rel);
      }
    }
    rows.push({ run: run.name, key: k, maxAbs, maxRel, firstT, nEventTolerated, pass: nFail === 0 });
    if (nFail > 0) failures.push(`${run.name}.${k}: ${nFail} 幀超限，首次 t=${firstT}`);
  }
  rows.push({ run: run.name, key: "(t)", maxAbs: maxTdiff, maxRel: 0, firstT: null, nEventTolerated: 0, pass: maxTdiff < dt / 10 });
}
console.log("| 運行 | key | 最大絕對誤差 | 最大相對誤差 | 首次超限 t | 節點容限幀 | 通過 |");
console.log("|---|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.run} | ${r.key} | ${r.maxAbs.toExponential(2)} | ${r.maxRel.toExponential(2)} | ${r.firstT === null ? "—" : r.firstT} | ${r.nEventTolerated} | ${r.pass ? "是" : "否"} |`);
console.log("\nFAILURES:", JSON.stringify(failures));
fs.writeFileSync(path.join(root, "second-impl", "compare-result.json"), JSON.stringify({ rows, failures }, null, 1));
