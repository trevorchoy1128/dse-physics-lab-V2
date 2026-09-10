// 補充導出（第二實作者第 1 輪指出的覆蓋缺口）：放手事件、桌布抽不出、握扶手。格式與 tools/export-sim.mjs 相同。
// 用法：npx tsx --tsconfig tsconfig.app.json reports/inertia-and-newtons-first-law/audit/extra-export.mts
import { mkdirSync, writeFileSync } from "node:fs";
import { model, type P, type S } from "../../../src/sims/inertia-and-newtons-first-law/model";
import { plan } from "../../../src/sims/inertia-and-newtons-first-law/plan";
import { defaults } from "../../../src/sims/inertia-and-newtons-first-law/controls";
import { layers } from "../../../src/sims/inertia-and-newtons-first-law/charts";

const out = "reports/inertia-and-newtons-first-law/data";
mkdirSync(out, { recursive: true });
const allLayers = Object.fromEntries(layers.map(l => [l.key, !/Only$/.test(l.key)]));   // 「只看淨力」是排他開關，導出時關閉
const FRAMES = 3200, DT = 0.005;
interface Run { name: string; params: P; change?: { t: number; params: Partial<P> } }
const runs: Run[] = [
  { name: "extra-release-1s", params: { ...defaults, scene: "table" }, change: { t: 1.0, params: { push: "off" } } },                         // 2024 Q3：t = 1.0 s 越過 B 一刻放手
  { name: "extra-table-hold-6s", params: { ...defaults, scene: "table" }, frames: 6000 },   // 第二實作者第 7 輪：預設不放手 6 s——F = 0.30 < f₂ = 0.40，過 B 後減速至停（t = 4.0 s、s = 3.0 m），停後靜摩擦 = −F、淨力 0
  { name: "extra-release-smooth", params: { ...defaults, scene: "table", f2: 0 }, change: { t: 0.5, params: { push: "off" } } },             // 光滑：放手後 v 恆定
  { name: "extra-release-two-blocks", params: { ...defaults, scene: "table", f1: 0, f2: 0, F: 1, second: true, mB: 1 }, change: { t: 0.5, params: { push: "off" } } },
  { name: "extra-cloth-stuck", params: { ...defaults, scene: "cloth", vCloth: 1.0 } },                                                          // 低於臨界 1.085：抽不出
  { name: "extra-cloth-critical-above", params: { ...defaults, scene: "cloth", vCloth: 1.2 } },
  { name: "extra-bus-handrail", params: { ...defaults, scene: "bus", handrail: true } },
  { name: "extra-bus-f0", params: { ...defaults, scene: "bus", fBus: 0 } },
  { name: "extra-space-engine-off-1s", params: { ...defaults, scene: "space", Fe: 2, trio: true }, change: { t: 1.0, params: { engine: "off" } } },
];
const index: { name: string; params: P; change?: Run["change"] }[] = [];
for (const r of runs) {
  let p: P = r.params; let s: S = model.init(p); const frames = [];
  for (let i = 0; i < FRAMES; i++) {
    if (r.change && s.t >= r.change.t - 1e-12 && p === r.params) p = { ...p, ...r.change.params };
    const obs = model.observe(s, p); const pl = plan(s, p, obs, allLayers);
    frames.push({ t: s.t, obs, arrows: pl.arrows, labels: pl.labels, scales: pl.scales, meta: pl.meta });   // 與 tools/export-sim.mjs 同一結構
    s = model.step(s, p, DT);
  }
  writeFileSync(`${out}/${r.name}.json`, JSON.stringify({ name: r.name, params: r.params, change: r.change, dt: DT, frames }));
  index.push({ name: r.name, params: r.params, change: r.change });
  console.log(r.name, "done");
}
writeFileSync(`${out}/index-extra.json`, JSON.stringify({ simId: "inertia-and-newtons-first-law", frames: FRAMES, dt: DT, note: "change = 在 t 起把 params 換成該值（放手／關引擎），之後保持", runs: index }, null, 1));
