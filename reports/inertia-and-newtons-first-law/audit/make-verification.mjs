// 由 reports/ 匯總 src/sims/<simId>/verification.json（閘 3「驗證」分頁資料）
// 用法：node reports/inertia-and-newtons-first-law/audit/make-verification.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
const simId = "inertia-and-newtons-first-law";
const dir = `reports/${simId}`;
const md = f => (existsSync(`${dir}/${f}`) ? readFileSync(`${dir}/${f}`, "utf8") : "");
const section = (text, title) => { const m = text.match(new RegExp(`^##+\\s*(?:\\d+\\.?\\s*)?${title}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|\\Z)`, "m")); return m ? m[1].trim() : ""; };
const firstLine = s => s.split("\n").map(x => x.trim()).find(x => x && !x.startsWith("|") && !x.startsWith("#")) ?? "";
const version = readFileSync(`src/sims/${simId}/manifest.ts`, "utf8").match(/version:\s*"([^"]+)"/)[1];
const outFile = `${dir}/audit/vitest-result.json`;
spawnSync("npx", ["vitest", "run", `src/sims/${simId}`, "--reporter=json", `--outputFile=${outFile}`], { encoding: "utf8", shell: true, maxBuffer: 1 << 26 });
let tests = { total: 0, passed: 0, names: [] };
try { const j = JSON.parse(readFileSync(outFile, "utf8")); tests.total = j.numTotalTests; tests.passed = j.numPassedTests; tests.names = j.testResults.flatMap(f => f.assertionResults.map(a => ({ name: a.title, status: a.status }))); } catch (e) { console.error("vitest json 讀取失敗", String(e)); }
const today = new Date(); const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const audit = md("physics-audit.md"), second = md("second-impl.md"), student = md("student-test-r6.md") || md("student-test.md"), apparatus = md("apparatus-review.md");
const out = {
  simId, version, date: localDate,
  spec: "reference/13_024_慣性與牛頓運動第一定律_模擬器規格.md（v0.3，老師 2026-09-07 核准）",
  tests: { total: tests.total, passed: tests.passed, items: tests.names },
  conditions: "規格 §10 驗證條件 1–17：1、2、5–13、15 在 model.test.ts；3、4、14、16、17 在 plan.test.ts；核數員 §1 逐條數字見 physics-audit.md",
  rounds: 6,
  reports: {
    physicsAudit: { file: "physics-audit.md", conclusion: firstLine(section(audit, "結論")) },
    secondImpl: { file: "second-impl.md", conclusion: firstLine(section(second, "結論")) },
    studentTest: { file: "student-test-r6.md", rounds: ["student-test-r1.md", "student-test-r2.md", "student-test-r3.md", "student-test-r4.md", "student-test-r5.md", "student-test-r6.md"] },
    apparatusReview: { file: "apparatus-review.md", conclusion: firstLine(section(apparatus, "結論")) },
    fixLogs: ["fix-log.md", "fix-log-r2.md", "fix-log-r3.md", "fix-log-r4.md", "fix-log-r5.md"],
  },
  dsePapers: { regression: [], pending: ["24(1B)Q3(b)", "20(1A)Q5", "CE84(II)Q1", "CE85(II)Q8", "CE98(II)Q6", "CE98(II)Q9", "CE99(II)Q42", "CE01(II)Q4", "CE02(II)Q4", "CE06(II)Q2"], note: "無評卷參考；24(1B)Q3(a) 的 1.5 m s⁻¹ 只作解析解測試" },
  signedOff: null,
};
writeFileSync(`src/sims/${simId}/verification.json`, JSON.stringify(out, null, 2) + "\n");
console.log(`verification.json：${tests.passed}/${tests.total} 測試；核數 ${out.reports.physicsAudit.conclusion}；第二實作 ${out.reports.secondImpl.conclusion}；儀器 ${out.reports.apparatusReview.conclusion}`);
