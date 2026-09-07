// 第 4 輪核數員：桌布情景參數兩端（μ布 = 0、g = 0、v布 = 0.1 / L = 1、v布 = 10 / μ布 = 0.6）在 0.2.2 下的 meta.Jmax、J/Jmax 與非有限數檢查。
// 只執行 model / plan 導出數據，不讀其原始碼。用法：npx tsx reports/inertia-and-newtons-first-law/audit/edge-cloth-r4.mts
import { model } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/model";
import { plan } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/plan";
import { defaults } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/controls";
import { layers } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/charts";
const allLayers = Object.fromEntries(layers.map(l => [l.key, !/Only$/.test(l.key)]));
const runs = [
  { name: "edge-cloth-mu0", params: { ...defaults, scene: "cloth", muCloth: 0 } },
  { name: "edge-cloth-g0", params: { ...defaults, scene: "cloth", g: 0 } },
  { name: "edge-cloth-slow-L1", params: { ...defaults, scene: "cloth", vCloth: 0.1, L: 1 } },
  { name: "edge-cloth-fast-mu06", params: { ...defaults, scene: "cloth", vCloth: 10, muCloth: 0.6, L: 1 } },
];
for (const r of runs) {
  let s = model.init(r.params as any); const seen = new Set<string>(); let bad = 0; let last: any = null;
  for (let i = 0; i < 1200; i++) {
    const obs: any = model.observe(s, r.params as any); const p: any = plan(s, r.params as any, obs, allLayers);
    const m: any = p.meta; seen.add(JSON.stringify([m.Jmax, m.J / m.Jmax]));
    for (const a of p.arrows) for (const x of a.vector) if (!Number.isFinite(x)) bad++;
    for (const v of Object.values(obs)) if (typeof v === "number" && !Number.isFinite(v)) bad++;
    if (!m.done) last = { t: +(i * 0.005).toFixed(3), Jmax: m.Jmax, J: m.J, dv: obs.dv, stuck: obs.stuck, dtPull: obs.dtPull, phase: obs.phase, T: m.T };
    s = model.step(s, r.params as any, 0.005);
  }
  console.log(r.name.padEnd(22), "[Jmax, J/Jmax] 值集:", [...seen].slice(0, 6).join(" "), "| obs/箭嘴非有限數:", bad, "| 末有效幀:", JSON.stringify(last));
}
