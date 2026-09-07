// 核數員第 2 輪補跑（模型 0.2.0）：與 data/_export.mts 相同的 17 個運行，但 netOnly=false（原導出把 netOnly 開了，個別力箭嘴全部被隱藏）
// 另加：放手事件、握扶手、驗證條件 1/5/8/9/10/11/13 的掃描、參數兩端。只執行 model/plan，不讀其源碼。
import { writeFileSync, mkdirSync } from "node:fs";
import { model } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/model";
import { plan } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/plan";
import { controls, defaults } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/controls";
import { scenarios } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/scenarios";
import { layers } from "file:///C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/src/sims/inertia-and-newtons-first-law/charts";
const OUT = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/audit/extra-data-r2/";
mkdirSync(OUT, { recursive: true });
const L = Object.fromEntries(layers.map(l => [l.key, l.key !== "netOnly"]));
let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
type Sched = (t: number, base: any) => any;
function run(name: string, params: any, n = 3200, dt = 0.005, sched?: Sched, every = 1) {
  let s = model.init(params); const frames: any[] = [];
  for (let i = 0; i < n; i++) {
    const t = s.t ?? i * dt;
    const p = sched ? sched(t, params) : params;
    const obs = model.observe(s, p);
    if (i % every === 0) {
      const pl = plan(s, p, obs, L);
      frames.push({ t, obs, arrows: pl.arrows, scales: pl.scales, meta: pl.meta });
    }
    s = model.step(s, p, dt);
  }
  writeFileSync(OUT + name + ".json", JSON.stringify({ name, params, dt, frames }));
  console.log(name, frames.length);
}
// 1) 原 17 個運行（netOnly=false）
const runs = [
  { name: "default", params: { ...defaults } },
  ...scenarios.map(s => ({ name: "scenario-" + s.key, params: { ...defaults, ...s.params } })),
  ...Array.from({ length: 5 }, (_, k) => ({ name: "random-" + k, params: { ...defaults, ...Object.fromEntries(controls.map(c =>
      [c.key, (c.kind === "select" || c.kind === "segment") ? c.options[Math.floor(rnd() * c.options.length)].value
            : c.kind === "toggle" ? rnd() < 0.5
            : c.min + rnd() * (c.max - c.min)])) } })),
];
for (const r of runs) run(r.name, r.params);
// 2) 放手事件（即時控制）：預設參數，t ≥ 0.8 s 放手（仍在光滑段）→ 條件 2、3；t ≥ 1.5 s 放手（已在粗糙段）→ 條件 7
const rel = (tr: number): Sched => (t, b) => (t >= tr - 1e-12 ? { ...b, push: "off" } : b);
run("release-0.8", { ...defaults }, 3200, 0.005, rel(0.8));
run("release-1.5", { ...defaults }, 3200, 0.005, rel(1.5));
run("release-1.5-mu0.05", { ...defaults, mu2: 0.05 }, 3200, 0.005, rel(1.5));
run("release-two-blocks", { ...defaults, F: 1, mu2: 0, second: true, mB: 1 }, 3200, 0.005, rel(0.5));
// 3) 條件 1：μ=0、F=0，1000 s
run("long-table", { ...defaults, mu2: 0 }, 200000, 0.005, rel(0.8), 1000);
run("long-space", { ...defaults, scene: "space", trio: true, engine: "off", Fe: 0 }, 200000, 0.005, undefined, 1000);
// 4) 條件 5：靜止、F 與 μmg 比較（μmg = 0.3924）
for (const F of [0.3, 0.39, 0.3924, 0.3925, 0.4]) run("static-F" + F, { ...defaults, mu1: 0.2, mu2: 0.2, F }, 400);
// 5) 條件 8：質量掃描 20 點，F=1，μ=0
for (let i = 0; i < 20; i++) { const m = 0.1 + i * (4.9 / 19); run("mass-" + i, { ...defaults, m, F: 1, mu2: 0 }, 400, 0.005, rel(1.0)); }
// 6) 條件 9/10/11：桌布
for (let i = 0; i < 20; i++) { const v = 1.5 + i * (8.5 / 19); run("cloth-v-" + i, { ...defaults, scene: "cloth", vCloth: v }, 1200); }
const vc = Math.sqrt(2 * 0.15 * 9.81 * 0.4);
for (let i = -5; i <= 5; i++) { if (i === 0) continue; run("cloth-crit-" + i, { ...defaults, scene: "cloth", vCloth: vc + i * 0.02 }, 2400); }
for (let i = 0; i < 20; i++) { const m = 0.1 + i * (4.9 / 19); run("cloth-m-" + i, { ...defaults, scene: "cloth", mObj: m }, 1200); }
// 7) 條件 13：巴士
run("bus-handrail", { ...defaults, scene: "bus", handrail: true }, 3600);
run("bus-mu0.4", { ...defaults, scene: "bus", muBus: 0.4 }, 3600);
run("bus-mu0.31", { ...defaults, scene: "bus", muBus: 0.31 }, 3600);
run("bus-a0", { ...defaults, scene: "bus", aBus: 0 }, 3600);
run("bus-a5-v15-mu0.6", { ...defaults, scene: "bus", aBus: 5, vBus: 15, muBus: 0.6 }, 3600);
run("bus-a5-v2-mu0", { ...defaults, scene: "bus", aBus: 5, vBus: 2, muBus: 0 }, 3600);
// 8) 邊界
run("edge-table-max", { ...defaults, m: 0.1, F: 10, mu1: 0.6, mu2: 0.6 }, 3200);
run("edge-table-min", { ...defaults, m: 5, F: 0, mu1: 0, mu2: 0, push: "off" }, 3200);
run("edge-cloth-slow", { ...defaults, scene: "cloth", vCloth: 0.1, L: 1, muCloth: 0.6, muTable: 0 }, 3200);
run("edge-cloth-mu0", { ...defaults, scene: "cloth", muCloth: 0, muTable: 0 }, 3200);
run("edge-cloth-fast", { ...defaults, scene: "cloth", vCloth: 10, L: 0.1, muCloth: 0.6, muTable: 0.6 }, 3200);
run("edge-space-max", { ...defaults, scene: "space", Fe: 5, mShip: 0.5, trio: true, dir: "backward" }, 3200);
run("edge-space-g0", { ...defaults, scene: "table", g: 0 }, 400);
