// 逐幀逐鍵比對 data/<run>.json（主實作）與 second-impl/<run>.json（第二實作）——第 2 輪：25 個運行
// 容限：連續量 1e-6（本模型全部量皆有分段解析解，故一律用嚴格容限；同時記錄 1e-4 是否通過）；
//       離散量（scene、phase、busPhase、sliding、stuck、nForces、nHoriz、engineOn）須完全相等，
//       但事件時刻（離散量首次改變的幀）容許相差 ≤ 2 dt。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
// 第 2 輪：主運行（index.json）與 extra 運行（index-extra.json）一併比對
const idxMain = JSON.parse(fs.readFileSync(path.join(dataDir, "index.json"), "utf8"));
const idxExtra = JSON.parse(fs.readFileSync(path.join(dataDir, "index-extra.json"), "utf8"));
const index = { dt: idxMain.dt, runs: [...idxMain.runs, ...idxExtra.runs] };
const dt = index.dt;
const DISCRETE = new Set(["scene", "phase", "busPhase", "sliding", "stuck", "nForces", "nHoriz", "engineOn"]);
const TOL = 1e-6, TOL_LOOSE = 1e-4;

const rows = [];
const eventRows = [];
let allOk = true;
for (const r of index.runs) {
  const A = JSON.parse(fs.readFileSync(path.join(dataDir, r.name + ".json"), "utf8")).frames;
  const B = JSON.parse(fs.readFileSync(path.join(here, r.name + ".json"), "utf8")).frames;
  if (A.length !== B.length) { console.log("frame count differs", r.name, A.length, B.length); allOk = false; }
  const keysA = Object.keys(A[0].obs), keysB = Object.keys(B[0].obs);
  const missing = keysA.filter(k => !keysB.includes(k)), extra = keysB.filter(k => !keysA.includes(k));
  if (missing.length || extra.length) { console.log("key set differs", r.name, { missing, extra }); allOk = false; }
  const keys = ["t", ...keysA];
  for (const k of keys) {
    let maxAbs = 0, maxRel = 0, firstBad = null, firstBadLoose = null, tAt = null;
    // 事件時刻（離散量的變化幀）
    const changesA = [], changesB = [];
    for (let i = 0; i < A.length; i++) {
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
      // 離散量：逐幀完全相等即通過；否則看事件幀差是否 ≤ 2 幀
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

// 摘要
const worst = rows.filter(w => !w.pass);
console.log("allOk =", allOk, " rows =", rows.length, " failing =", worst.length);
for (const w of worst) console.log("FAIL", w.run, w.key, "maxAbs", w.maxAbs, "maxRel", w.maxRel, "first", w.firstBad, w.note);
const byRun = {};
for (const w of rows) { byRun[w.run] = byRun[w.run] || { maxAbs: 0, maxRel: 0, key: "" }; if (w.maxAbs > byRun[w.run].maxAbs) byRun[w.run] = { maxAbs: w.maxAbs, maxRel: w.maxRel, key: w.key }; }
for (const [k, v] of Object.entries(byRun)) console.log(k.padEnd(32), "worst key", v.key.padEnd(8), "maxAbs", v.maxAbs.toExponential(3), "maxRel", v.maxRel.toExponential(3));
