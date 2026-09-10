// 逐幀逐鍵比對 data/<run>.json（主實作）與 second-impl/<run>.json（第二實作）——第 8 輪：26 個運行（第 7 輪 25 個 + extra-table-hold-6s）
// 主運行（index.json）dt 0.001、2000 幀；extra 運行（index-extra.json）dt 0.005、3200 幀。
// 容限：連續量 1e-6（本模型全部量皆有分段解析解，故一律用嚴格容限；同時記錄 1e-4 是否通過）；
//       離散量（scene、phase、busPhase、sliding、stuck、nForces、nHoriz、engineOn）須完全相等，
//       但事件時刻（離散量首次改變的幀）容許相差 ≤ 2 dt。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
const runs = [];
for (const idxName of ["index.json", "index-extra.json"]) {
  const idx = JSON.parse(fs.readFileSync(path.join(dataDir, idxName), "utf8"));
  for (const r of idx.runs) runs.push({ ...r, dt: idx.dt, nFrames: idx.frames });
}
const DISCRETE = new Set(["scene", "phase", "busPhase", "sliding", "stuck", "nForces", "nHoriz", "engineOn"]);
const TOL = 1e-6, TOL_LOOSE = 1e-4;

const rows = [];
const eventRows = [];
let allOk = true;
for (const r of runs) {
  const dt = r.dt;
  const A = JSON.parse(fs.readFileSync(path.join(dataDir, r.name + ".json"), "utf8")).frames;
  const B = JSON.parse(fs.readFileSync(path.join(here, r.name + ".json"), "utf8")).frames;
  if (A.length !== B.length) { console.log("frame count differs", r.name, A.length, B.length); allOk = false; }
  const keysA = Object.keys(A[0].obs), keysB = Object.keys(B[0].obs);
  const missing = keysA.filter(k => !keysB.includes(k)), extra = keysB.filter(k => !keysA.includes(k));
  if (missing.length || extra.length) { console.log("key set differs", r.name, { missing, extra }); allOk = false; }
  const keys = ["t", ...keysA];
  for (const k of keys) {
    let maxAbs = 0, maxRel = 0, firstBad = null, firstBadLoose = null, tAt = null;
    const changesA = [], changesB = [];
    for (let i = 0; i < Math.min(A.length, B.length); i++) {
      const a = k === "t" ? A[i].t : A[i].obs[k];
      const b = k === "t" ? B[i].t : B[i].obs[k];
      if (DISCRETE.has(k)) {
        if (i > 0 && A[i - 1].obs[k] !== a) changesA.push({ i, from: A[i - 1].obs[k], to: a });
        if (i > 0 && B[i - 1].obs[k] !== b) changesB.push({ i, from: B[i - 1].obs[k], to: b });
      }
      const abs = Math.abs(a - b);
      const scale = Math.max(Math.abs(a), Math.abs(b));
      const rel = scale > 1e-12 ? abs / scale : 0;
      if (abs > maxAbs) { maxAbs = abs; tAt = A[i].t; }
      if (rel > maxRel) maxRel = rel;
      const bad = abs > TOL * Math.max(1, scale);
      const badLoose = abs > TOL_LOOSE * Math.max(1, scale);
      if (bad && firstBad === null) firstBad = A[i].t;
      if (badLoose && firstBadLoose === null) firstBadLoose = A[i].t;
    }
    let pass = firstBad === null;
    let note = "";
    if (DISCRETE.has(k)) {
      if (!pass) {
        let evOk = changesA.length === changesB.length;
        if (evOk) for (let j = 0; j < changesA.length; j++) {
          const ca = changesA[j], cb = changesB[j];
          if (ca.from !== cb.from || ca.to !== cb.to || Math.abs(ca.i - cb.i) > 2) evOk = false;
        }
        pass = evOk; note = evOk ? "事件幀差 ≤ 2" : "事件不符";
      }
      for (let j = 0; j < Math.max(changesA.length, changesB.length); j++) {
        const ca = changesA[j], cb = changesB[j];
        eventRows.push({ run: r.name, key: k, main: ca ? `${ca.from}→${ca.to} @ 幀 ${ca.i} (t=${(ca.i * dt).toFixed(3)})` : "—", second: cb ? `${cb.from}→${cb.to} @ 幀 ${cb.i} (t=${(cb.i * dt).toFixed(3)})` : "—", diff: ca && cb ? Math.abs(ca.i - cb.i) : NaN });
      }
    }
    if (!pass) allOk = false;
    rows.push({ run: r.name, key: k, maxAbs, maxRel, tAt, firstBad, firstBadLoose, pass, note });
  }
}

const fmt = (x) => x === null ? "—" : x === 0 ? "0" : x.toExponential(2);
const lines = ["| 運行 | key | 最大絕對誤差 | 最大相對誤差 | 首次超限 t (1e-6) | 通過 |", "|---|---|---|---|---|---|"];
for (const w of rows) lines.push(`| ${w.run} | ${w.key} | ${fmt(w.maxAbs)} | ${fmt(w.maxRel)} | ${w.firstBad === null ? "—" : w.firstBad.toFixed(3)} | ${w.pass ? "✓" : "✗"}${w.note ? "（" + w.note + "）" : ""} |`);
const evLines = ["| 運行 | key | 主實作 | 第二實作 | 幀差 |", "|---|---|---|---|---|"];
for (const e of eventRows) evLines.push(`| ${e.run} | ${e.key} | ${e.main} | ${e.second} | ${Number.isNaN(e.diff) ? "—" : e.diff} |`);
fs.writeFileSync(path.join(here, "compare-table.md"), lines.join("\n") + "\n\n" + evLines.join("\n") + "\n");
fs.writeFileSync(path.join(here, "compare.json"), JSON.stringify({ allOk, rows, eventRows }, null, 1));

const worst = rows.filter(w => !w.pass);
console.log("allOk =", allOk, " rows =", rows.length, " failing =", worst.length, " events =", eventRows.length, " maxEventDiff =", Math.max(0, ...eventRows.map(e => e.diff || 0)));
for (const w of worst) console.log("FAIL", w.run, w.key, "maxAbs", w.maxAbs, "maxRel", w.maxRel, "first", w.firstBad, w.note);
const byRun = {};
for (const w of rows) { byRun[w.run] = byRun[w.run] || { maxAbs: 0, maxRel: 0, key: "" }; if (w.maxAbs > byRun[w.run].maxAbs) byRun[w.run] = { maxAbs: w.maxAbs, maxRel: w.maxRel, key: w.key }; }
for (const [k, v] of Object.entries(byRun)) console.log(k.padEnd(30), "worst key", v.key.padEnd(8), "maxAbs", v.maxAbs.toExponential(3), "maxRel", v.maxRel.toExponential(3));
// 相對誤差最大的列（連續量），供報告註記
const relTop = rows.filter(w => !DISCRETE.has(w.key)).sort((a, b) => b.maxRel - a.maxRel).slice(0, 6);
console.log("--- top maxRel ---");
for (const w of relTop) console.log(w.run, w.key, "maxAbs", w.maxAbs.toExponential(2), "maxRel", w.maxRel.toExponential(2), "t", w.tAt);
