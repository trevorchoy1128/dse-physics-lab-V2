// 第 7 輪核數員補充導出（黑箱呼叫 model/plan，不讀其原始碼）：煞車段 f=120、起步 f=240、邊界 f=180、掃描類條件 5/7/8/9/10/11/13、參數兩端。
// 用法：npx tsx --tsconfig tsconfig.app.json reports/inertia-and-newtons-first-law/audit/r7-export.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { model, type P, type S } from "../../../src/sims/inertia-and-newtons-first-law/model";
import { plan } from "../../../src/sims/inertia-and-newtons-first-law/plan";
import { defaults } from "../../../src/sims/inertia-and-newtons-first-law/controls";
import { layers } from "../../../src/sims/inertia-and-newtons-first-law/charts";
const out = "reports/inertia-and-newtons-first-law/audit/r7-data";
mkdirSync(out, { recursive: true });
const allLayers = Object.fromEntries(layers.map(l => [l.key, !/Only$/.test(l.key)]));
interface Run { name: string; params: P; frames?: number; dt?: number; change?: { t: number; params: Partial<P> } }
const d = defaults;
const vCrit = Math.sqrt(2 * 1.5 * 0.4 / 1);
const runs: Run[] = [
  { name: "bus-brake-f120", params: { ...d, scene: "bus" } },
  { name: "bus-start-f240", params: { ...d, scene: "bus", fBus: 240 } },
  { name: "bus-f180-boundary", params: { ...d, scene: "bus", fBus: 180 } },
  { name: "bus-f170", params: { ...d, scene: "bus", fBus: 170 } },
  { name: "bus-a0", params: { ...d, scene: "bus", aBus: 0 }, frames: 600 },
  { name: "bus-a5-v2-f300", params: { ...d, scene: "bus", aBus: 5, vBus: 2, fBus: 300 } },
  { name: "bus-a5-v15-f0-handrail", params: { ...d, scene: "bus", aBus: 5, vBus: 15, fBus: 0, handrail: true } },
  { name: "bus-a1-f120-handrail", params: { ...d, scene: "bus", aBus: 1, handrail: true } },
  { name: "bus-a1-f120", params: { ...d, scene: "bus", aBus: 1 } },
  { name: "bus-brake-handrail-f120", params: { ...d, scene: "bus", handrail: true } },
  ...[0.3, 0.39, 0.4, 0.4001, 0.45, 3].map(F => ({ name: `static-F${F}`, params: { ...d, scene: "table", F, f1: 0.4, f2: 0.4 }, frames: 400 })),
  { name: "static-F3-f3", params: { ...d, scene: "table", F: 3, f1: 3, f2: 3 }, frames: 400 },
  { name: "static-F0-f0", params: { ...d, scene: "table", F: 0, f1: 0, f2: 0 }, frames: 400 },
  { name: "release-1.5-f2-0.4", params: { ...d, scene: "table", f2: 0.4 }, change: { t: 1.5, params: { push: "off" } } },
  { name: "release-1.5-f2-0.05", params: { ...d, scene: "table", f2: 0.05 }, change: { t: 1.5, params: { push: "off" } } },
  { name: "release-1.5-f2-3", params: { ...d, scene: "table", f2: 3 }, change: { t: 1.5, params: { push: "off" } } },
  ...Array.from({ length: 20 }, (_, k) => 0.1 + k * (4.9 / 19)).map((m, k) => ({ name: `mass-${k}`, params: { ...d, scene: "table", m, F: 1, f1: 0, f2: 0 }, frames: 400, change: { t: 0.5, params: { push: "off" as const } } })),
  ...Array.from({ length: 20 }, (_, k) => 1.5 + k * (8.5 / 19)).map((v, k) => ({ name: `cloth-v-${k}`, params: { ...d, scene: "cloth", vCloth: v }, frames: 600 })),
  ...[-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].map(k => ({ name: `cloth-crit-${k}`, params: { ...d, scene: "cloth", vCloth: vCrit + k * 0.02 }, frames: 1000 })),
  { name: "cloth-crit-exact", params: { ...d, scene: "cloth", vCloth: vCrit }, frames: 1000 },
  ...Array.from({ length: 20 }, (_, k) => k * (3 / 19)).map((f, k) => ({ name: `cloth-f-${k}`, params: { ...d, scene: "cloth", fCloth: f }, frames: 600 })),
  { name: "edge-cloth-fT0", params: { ...d, scene: "cloth", fTable: 0 }, frames: 600 },
  { name: "edge-cloth-f0-fT0", params: { ...d, scene: "cloth", fCloth: 0, fTable: 0 }, frames: 600 },
  { name: "edge-cloth-v0.1-L1-f3", params: { ...d, scene: "cloth", vCloth: 0.1, L: 1, fCloth: 3, fTable: 3 } },
  { name: "edge-cloth-v10-L0.1-f3-fT0.05", params: { ...d, scene: "cloth", vCloth: 10, L: 0.1, fCloth: 3, fTable: 0.05 } },
  { name: "edge-table-m0.1-F10-f3", params: { ...d, scene: "table", m: 0.1, F: 10, f1: 3, f2: 3 } },
  { name: "edge-table-m5-F10-f0", params: { ...d, scene: "table", m: 5, F: 10, f1: 0, f2: 0, second: true, mB: 0.1 } },
  { name: "edge-table-m5-F0", params: { ...d, scene: "table", m: 5, F: 0 }, frames: 400 },
  { name: "edge-space-Fe5-m0.5", params: { ...d, scene: "space", Fe: 5, mShip: 0.5, trio: true } },
  { name: "edge-space-Fe5-m5-back", params: { ...d, scene: "space", Fe: 5, mShip: 5, dir: "backward", trio: true } },
  { name: "edge-space-g10", params: { ...d, scene: "space", g: 10, Fe: 0, engine: "off", trio: true } },
  { name: "long-space-dt0.5", params: { ...d, scene: "space", engine: "off", trio: true }, frames: 2001, dt: 0.5 },
  { name: "long-table-dt0.5", params: { ...d, scene: "table", f1: 0, f2: 0, F: 0 }, frames: 2001, dt: 0.5 },
];
const index: unknown[] = [];
for (const r of runs) {
  const N = r.frames ?? 3200, DT = r.dt ?? 0.005;
  let p: P = r.params; let s: S = model.init(p); const frames: unknown[] = [];
  for (let i = 0; i < N; i++) {
    if (r.change && s.t >= r.change.t - 1e-12 && p === r.params) p = { ...p, ...r.change.params };
    const obs = model.observe(s, p); const pl = plan(s, p, obs, allLayers);
    frames.push({ t: s.t, obs, arrows: pl.arrows, labels: pl.labels, scales: pl.scales, meta: pl.meta });
    s = model.step(s, p, DT);
  }
  writeFileSync(`${out}/${r.name}.json`, JSON.stringify({ name: r.name, params: r.params, change: r.change, dt: DT, frames }));
  index.push({ name: r.name, params: r.params, change: r.change, frames: N, dt: DT });
}
writeFileSync(`${out}/index.json`, JSON.stringify({ runs: index }, null, 1));
console.log("runs:", runs.length);
