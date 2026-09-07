// 第 4 輪核數員：桌布情景 g = 0 時哪些 obs / meta 鍵非有限數（承 edge-cloth-r4.mts 的發現）。只執行 model / plan，不讀原始碼。
// 用法：npx tsx --tsconfig tsconfig.app.json reports/inertia-and-newtons-first-law/audit/edge-cloth-r4b.mts
import { model } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/model";
import { plan } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/plan";
import { defaults } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/controls";
import { layers } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/charts";
const allLayers = Object.fromEntries(layers.map(l => [l.key, !/Only$/.test(l.key)]));
for (const [name, params] of [["cloth-g0", { ...defaults, scene: "cloth", g: 0 }], ["cloth-g0-mu0", { ...defaults, scene: "cloth", g: 0, muCloth: 0 }], ["table-g0", { ...defaults, scene: "table", g: 0 }], ["bus-g0", { ...defaults, scene: "bus", g: 0 }]] as const) {
  let s = model.init(params as any); const bad: Record<string, number> = {}; let first: any = null;
  for (let i = 0; i < 400; i++) {
    const obs: any = model.observe(s, params as any); const p: any = plan(s, params as any, obs, allLayers);
    for (const [k, v] of Object.entries(obs)) if (typeof v === "number" && !Number.isFinite(v)) { bad["obs." + k] = (bad["obs." + k] ?? 0) + 1; first ??= { t: i * 0.005, obs }; }
    for (const [k, v] of Object.entries(p.meta)) if (typeof v === "number" && !Number.isFinite(v)) bad["meta." + k] = (bad["meta." + k] ?? 0) + 1;
    for (const a of p.arrows) for (const x of a.vector) if (!Number.isFinite(x)) bad["arrow." + a.kind] = (bad["arrow." + a.kind] ?? 0) + 1;
    s = model.step(s, params as any, 0.005);
  }
  console.log(name.padEnd(14), "非有限數鍵（幀數）:", JSON.stringify(bad), first ? "首幀 obs: " + JSON.stringify(first.obs) : "");
}
