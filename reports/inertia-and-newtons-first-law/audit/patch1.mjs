import fs from "node:fs";
const p = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/audit/independent.mjs";
let s = fs.readFileSync(p, "utf8");
const rep = (a, b) => { if (!s.includes(a)) throw new Error("not found: " + a.slice(0, 60)); s = s.replace(a, b); };
// 1) 跳過 done 幀
rep("const fr = frames[i]; t = fr.t; const o = fr.obs; const p = sched(t, p0);",
  "const fr = frames[i]; if (fr.meta && fr.meta.done === 1) break; t = fr.t; const o = fr.obs; const p = sched(t, p0);");
// 2) 誤差量度：|差| / max(|我|, 1)
rep("const relErr = (x, y) => Math.abs(x - y) / Math.max(Math.abs(y), 1e-9);", "const relErr = (x, y) => Math.abs(x - y) / Math.max(Math.abs(y), 1);");
// 3) stride 內逐子步取排程
rep(`      for (let k = 0; k < stride; k++) {
        tableStep(st, p.m, F, p.mu1, p.mu2, p.g, dt);
        if (p.second) tableStep(stB, p.mB, F, p.mu1, p.mu2, p.g, dt);
      }`, `      for (let k = 0; k < stride; k++) {
        const pk = sched(t + k * dt, p0); const Fk = pk.push === "on" ? pk.F : 0;
        tableStep(st, pk.m, Fk, pk.mu1, pk.mu2, pk.g, dt);
        if (pk.second) tableStep(stB, pk.mB, Fk, pk.mu1, pk.mu2, pk.g, dt);
      }`);
// 4) 桌布：離布平手也登記
rep("    const { phase, a, e } = clothObs(st, p, t);\n    let te = rem, ev = null;",
  "    const { phase, a, e } = clothObs(st, p, t);\n    if (phase >= 2 && !st.left) { st.left = true; st.leftAt = t; st.sLeave = st.s; st.dv = st.v; }\n    let te = rem, ev = null;");
// 5) 超容差幀數與時刻
rep("const errs = {}; const note = (k, e, t) => { if (!errs[k] || e > errs[k].e) errs[k] = { e, t }; };",
  "const errs = {}; const note = (k, e, t) => { if (!errs[k]) errs[k] = { e: 0, t: 0, n: 0, ts: [] }; if (e > errs[k].e) { errs[k].e = e; errs[k].t = t; } if (e > 1e-6) { errs[k].n++; if (errs[k].ts.length < 6) errs[k].ts.push(+t.toFixed(4)); } };");
rep("const worst = Object.entries(e).filter(([k]) => k !== \"_sameAsRerun\").sort((a, b) => b[1].e - a[1].e).slice(0, 4).map(([k, v]) => `${k}=${v.e.toExponential(2)}@t=${v.t.toFixed(3)}`).join(\"  \");",
  "const worst = Object.entries(e).filter(([k]) => k !== \"_sameAsRerun\").sort((a, b) => b[1].e - a[1].e).slice(0, 4).map(([k, v]) => `${k}=${v.e.toExponential(2)}@t=${v.t.toFixed(3)}${v.n ? \"(n=\" + v.n + \" \" + JSON.stringify(v.ts) + \")\" : \"\"}`).join(\"  \");");
// 6) 畫面向量檢查也跳過 done 幀
rep("  for (const fr of run.frames) {\n    const o = fr.obs, t = fr.t, p = sched(t, p0);",
  "  for (const fr of run.frames) {\n    if (fr.meta && fr.meta.done === 1) break;\n    const o = fr.obs, t = fr.t, p = sched(t, p0);");
fs.writeFileSync(p, s);
console.log("patched");
