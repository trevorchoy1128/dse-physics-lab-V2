// 第 8 輪核數員補充導出（黑箱呼叫 model/plan，不讀其原始碼）。沿 r7-export.mts，預設由 controls.defaults 取（乘客 f 現為 150 N）；
// 補：f布 = 0 的幾個變體（F1 修正核實）、停止瞬間恰落幀格（dt 0.005 與 0.001）、不放手三個 f₂、巴士 150／120／240／180／170。
// 用法：npx tsx --tsconfig tsconfig.app.json reports/inertia-and-newtons-first-law/audit/r8-export.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { model, type P, type S } from "../../../src/sims/inertia-and-newtons-first-law/model";
import { plan } from "../../../src/sims/inertia-and-newtons-first-law/plan";
import { defaults } from "../../../src/sims/inertia-and-newtons-first-law/controls";
import { layers } from "../../../src/sims/inertia-and-newtons-first-law/charts";
const out = "reports/inertia-and-newtons-first-law/audit/r8-data";
mkdirSync(out, { recursive: true });
const allLayers = Object.fromEntries(layers.map(l => [l.key, !/Only$/.test(l.key)]));
interface Run { name: string; params: P; frames?: number; dt?: number; change?: { t: number; params: Partial<P> } }
const d = defaults;
if (d.fBus !== 150) throw new Error("controls.defaults.fBus 不是 150：" + d.fBus);
const vCrit = Math.sqrt(2 * 1.5 * 0.4 / 1);
const runs: Run[] = [
  // 巴士
  { name: "bus-brake-f150", params: { ...d, scene: "bus" } },
  { name: "bus-brake-f150-dt001", params: { ...d, scene: "bus" }, frames: 16000, dt: 0.001 },
  { name: "bus-brake-f120", params: { ...d, scene: "bus", fBus: 120 } },
  { name: "bus-start-f240", params: { ...d, scene: "bus", fBus: 240 } },
  { name: "bus-f180-boundary", params: { ...d, scene: "bus", fBus: 180 } },
  { name: "bus-f170", params: { ...d, scene: "bus", fBus: 170 } },
  { name: "bus-f0", params: { ...d, scene: "bus", fBus: 0 } },
  { name: "bus-a0", params: { ...d, scene: "bus", aBus: 0 }, frames: 600 },
  { name: "bus-a5-v2-f300", params: { ...d, scene: "bus", aBus: 5, vBus: 2, fBus: 300 } },
  { name: "bus-a5-v15-f0-handrail", params: { ...d, scene: "bus", aBus: 5, vBus: 15, fBus: 0, handrail: true } },
  { name: "bus-a1-f150-handrail", params: { ...d, scene: "bus", aBus: 1, handrail: true } },
  { name: "bus-a1-f150", params: { ...d, scene: "bus", aBus: 1 } },
  { name: "bus-brake-handrail-f150", params: { ...d, scene: "bus", handrail: true } },
  // 桌面：靜止
  ...[0.3, 0.39, 0.4, 0.4001, 0.45, 3].map(F => ({ name: `static-F${F}`, params: { ...d, scene: "table", F, f1: 0.4, f2: 0.4 }, frames: 400 })),
  { name: "static-F3-f3", params: { ...d, scene: "table", F: 3, f1: 3, f2: 3 }, frames: 400 },
  { name: "static-F0-f0", params: { ...d, scene: "table", F: 0, f1: 0, f2: 0 }, frames: 400 },
  // 桌面：放手後停止（停止瞬間恰落幀格：v_B = 1.5，f₂ = 0.4 → 2.125 s；0.05 → 10.0 s；0.25 → 2.7 s）
  { name: "release-1.5-f2-0.4", params: { ...d, scene: "table", f2: 0.4 }, change: { t: 1.5, params: { push: "off" } } },
  { name: "release-1.5-f2-0.4-dt001", params: { ...d, scene: "table", f2: 0.4 }, frames: 6000, dt: 0.001, change: { t: 1.5, params: { push: "off" } } },
  { name: "release-1.5-f2-0.05", params: { ...d, scene: "table", f2: 0.05 }, change: { t: 1.5, params: { push: "off" } } },
  { name: "release-1.5-f2-0.05-dt001", params: { ...d, scene: "table", f2: 0.05 }, frames: 11000, dt: 0.001, change: { t: 1.5, params: { push: "off" } } },
  { name: "release-1.5-f2-0.25", params: { ...d, scene: "table", f2: 0.25 }, change: { t: 1.5, params: { push: "off" } } },
  { name: "release-1.5-f2-3", params: { ...d, scene: "table", f2: 3 }, change: { t: 1.5, params: { push: "off" } } },
  { name: "release-1.0-f2-0.4", params: { ...d, scene: "table", f2: 0.4 }, change: { t: 1.0, params: { push: "off" } } },   // 放手恰在 B（s = 0.75）
  // 桌面：不放手，F = 0.30 < f₂ → 過 B 後減速至停、停後靜摩擦 −0.30、淨力 0（三個 f₂，停止時刻 4.0／2.5+…）
  { name: "hold-f2-0.4", params: { ...d, scene: "table", f2: 0.4 } },
  { name: "hold-f2-0.4-dt001", params: { ...d, scene: "table", f2: 0.4 }, frames: 6000, dt: 0.001 },
  { name: "hold-f2-0.35", params: { ...d, scene: "table", f2: 0.35 } },
  { name: "hold-f2-3", params: { ...d, scene: "table", f2: 3 } },
  { name: "hold-f2-0.3", params: { ...d, scene: "table", f2: 0.3 } },          // F = f₂：過 B 後勻速
  ...Array.from({ length: 20 }, (_, k) => 0.1 + k * (4.9 / 19)).map((m, k) => ({ name: `mass-${k}`, params: { ...d, scene: "table", m, F: 1, f1: 0, f2: 0 }, frames: 400, change: { t: 0.5, params: { push: "off" as const } } })),
  // 桌布
  ...Array.from({ length: 20 }, (_, k) => 1.5 + k * (8.5 / 19)).map((v, k) => ({ name: `cloth-v-${k}`, params: { ...d, scene: "cloth", vCloth: v }, frames: 600 })),
  ...[-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].map(k => ({ name: `cloth-crit-${k}`, params: { ...d, scene: "cloth", vCloth: vCrit + k * 0.02 }, frames: 1000 })),
  { name: "cloth-crit-exact", params: { ...d, scene: "cloth", vCloth: vCrit }, frames: 1000 },
  ...Array.from({ length: 20 }, (_, k) => k * (3 / 19)).map((f, k) => ({ name: `cloth-f-${k}`, params: { ...d, scene: "cloth", fCloth: f }, frames: 600 })),
  // F1 核實：f布 = 0 的變體
  { name: "cloth-f0-fT2-dt001", params: { ...d, scene: "cloth", fCloth: 0 }, frames: 3000, dt: 0.001 },
  { name: "cloth-f0-fT0.05", params: { ...d, scene: "cloth", fCloth: 0, fTable: 0.05 }, frames: 600 },
  { name: "cloth-f0-fT3-v0.1-L1", params: { ...d, scene: "cloth", fCloth: 0, fTable: 3, vCloth: 0.1, L: 1 }, frames: 3200 },
  { name: "cloth-f0-v10-L0.1", params: { ...d, scene: "cloth", fCloth: 0, vCloth: 10, L: 0.1 }, frames: 600 },
  { name: "cloth-f0.05-fT3", params: { ...d, scene: "cloth", fCloth: 0.05, fTable: 3 }, frames: 600 },
  { name: "edge-cloth-fT0", params: { ...d, scene: "cloth", fTable: 0 }, frames: 600 },
  { name: "edge-cloth-f0-fT0", params: { ...d, scene: "cloth", fCloth: 0, fTable: 0 }, frames: 600 },
  { name: "edge-cloth-v0.1-L1-f3", params: { ...d, scene: "cloth", vCloth: 0.1, L: 1, fCloth: 3, fTable: 3 } },
  { name: "edge-cloth-v10-L0.1-f3-fT0.05", params: { ...d, scene: "cloth", vCloth: 10, L: 0.1, fCloth: 3, fTable: 0.05 } },
  // 參數兩端
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
console.log("runs:", runs.length, "frames:", index.reduce((a: number, r: any) => a + r.frames, 0));
