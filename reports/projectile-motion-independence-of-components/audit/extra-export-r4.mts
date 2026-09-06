// 第 4 輪核數用（v0.3.0：F = −k v、質量 m、預設無第二顆球、photo 圖層）：以作者的 model/plan 產生額外運行，
// 並額外記錄 plan.bodies / plan.trails / model.done。核數員不讀 model.ts / plan.ts，只呼叫並比對輸出。
import { model } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/projectile-motion-independence-of-components/model";
import { plan } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/projectile-motion-independence-of-components/plan";
import { defaults } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/projectile-motion-independence-of-components/controls";
import { scenarios } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/projectile-motion-independence-of-components/scenarios";
import { layers } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/projectile-motion-independence-of-components/charts";
import { writeFileSync, mkdirSync } from "node:fs";
const allLayers = Object.fromEntries(layers.map(l => [l.key, true]));
const noPhoto = { ...allLayers, photo: false };
const runs: { name: string; params: any; N?: number; layers?: any }[] = [
  { name: "official-default", params: { ...defaults } },
  ...scenarios.map(s => ({ name: "official-scenario-" + s.key, params: { ...defaults, ...s.params } })),
  { name: "official-random-0", params: { u: 5.73420989687285, theta: 70.07935528647124, h: 47.385124884259476, g: 9.81, m: 0.15657468082223772, air: true, companion: "fast" } },
  { name: "official-random-1-long", params: { u: 29.66155723047515, theta: 79.69560635727625, h: 39.190019475850285, g: 9.8, m: 1.056054576605584, air: true, companion: "fast" }, N: 12000 },
  { name: "official-random-3-long", params: { u: 11.247570425852933, theta: 79.99872810672909, h: 11.926370748284446, g: 1.6, m: 4.685220576210516, air: true, companion: "drop" }, N: 24000 },
  ...[15, 30, 45, 60, 75].map(th => ({ name: `angle-${th}`, params: { ...defaults, u: 15, theta: th, h: 0, companion: "none" } })),
  { name: "drop-default", params: { ...defaults, companion: "drop" } },
  { name: "fast-default", params: { ...defaults, companion: "fast" } },
  { name: "mass-0.1-noair", params: { ...defaults, m: 0.1 } },
  { name: "mass-5-noair", params: { ...defaults, m: 5 } },
  { name: "air-default-m1", params: { ...defaults, air: true } },
  { name: "air-default-m1-fast", params: { ...defaults, air: true, companion: "fast" } },
  { name: "air-default-m1-drop", params: { ...defaults, air: true, companion: "drop" } },
  { name: "air-default-m0.1", params: { ...defaults, air: true, m: 0.1 } },
  { name: "air-default-m5", params: { ...defaults, air: true, m: 5 } },
  { name: "air-u50-theta45-h50-m0.1", params: { ...defaults, u: 50, theta: 45, h: 50, m: 0.1, air: true, companion: "fast" }, N: 24000 },
  { name: "air-u50-theta-30-h50-m0.1", params: { ...defaults, u: 50, theta: -30, h: 50, m: 0.1, air: true, companion: "drop" }, N: 24000 },
  { name: "air-u50-theta90-h0-m0.1", params: { ...defaults, u: 50, theta: 90, h: 0, m: 0.1, air: true, companion: "none" }, N: 24000 },
  { name: "air-u50-theta90-h50-m0.1-g1.6", params: { ...defaults, u: 50, theta: 90, h: 50, m: 0.1, g: 1.6, air: true, companion: "none" }, N: 40000 },
  { name: "air-u50-theta45-h50-m5-g10", params: { ...defaults, u: 50, theta: 45, h: 50, m: 5, g: 10, air: true, companion: "fast" }, N: 12000 },
  { name: "air-u1-theta0-h50-m0.1", params: { ...defaults, u: 1, theta: 0, h: 50, m: 0.1, air: true, companion: "drop" }, N: 24000 },
  { name: "air-u50-theta40-h0-m1-drop", params: { ...defaults, u: 50, air: true, companion: "drop" }, N: 12000 },
  { name: "edge-theta90-h0", params: { ...defaults, theta: 90, h: 0, companion: "none" } },
  { name: "edge-theta-30-h0", params: { ...defaults, theta: -30, h: 0, companion: "none" } },
  { name: "edge-theta-30-h0-fast", params: { ...defaults, theta: -30, h: 0, companion: "fast" } },
  { name: "edge-u1-theta0-h0", params: { ...defaults, u: 1, theta: 0, h: 0, companion: "fast" } },
  { name: "edge-u1-theta90-h0-g1.6", params: { ...defaults, u: 1, theta: 90, h: 0, g: 1.6, companion: "drop" } },
  { name: "edge-u50-theta45-h50-g1.6", params: { ...defaults, u: 50, theta: 45, h: 50, g: 1.6, companion: "fast" }, N: 12000 },
  { name: "edge-u50-theta-30-h50-m5", params: { ...defaults, u: 50, theta: -30, h: 50, m: 5, companion: "drop" } },
  { name: "default-nophoto", params: { ...defaults }, layers: noPhoto },
];
const outDir = "C:/Users/trevor/dev/dse-physics-lab/reports/projectile-motion-independence-of-components/audit/extra-data-r4";
mkdirSync(outDir, { recursive: true });
const index: any[] = [];
for (const r of runs) {
  const N = r.N ?? 4000; const ly = r.layers ?? allLayers;
  let s: any = model.init(r.params); const frames: any[] = []; let doneAt: number | null = null;
  for (let i = 0; i < N; i++) {
    const obs = model.observe(s, r.params);
    const p = plan(s, r.params, obs, ly);
    const done = model.done ? model.done(s, r.params) : null;
    if (done && doneAt === null) doneAt = i;
    const keepB = N <= 4000 || i % 20 === 0;
    frames.push({ t: s.t ?? i * 0.001, obs, arrows: p.arrows, labels: p.labels, scales: p.scales, meta: p.meta, bodies: keepB ? (p.bodies ?? []) : null, trails: !keepB ? null : (p.trails ?? []).map(tr => ({ key: tr.key, n: tr.points.length, first: tr.points[0], last: tr.points[tr.points.length - 1] })), done });
    s = model.step(s, r.params, 0.001);
  }
  writeFileSync(`${outDir}/${r.name}.json`, JSON.stringify({ name: r.name, params: r.params, dt: 0.001, doneAt, frames }));
  index.push({ name: r.name, params: r.params, doneAt, frames: N });
  console.error("wrote", r.name, "N=", N, "doneAt=", doneAt, "tf(meta)=", frames[0].meta.tf, "last obs.t=", frames[N - 1].obs.t, "x=", frames[N - 1].obs.x, "y=", frames[N - 1].obs.y);
}
writeFileSync(`${outDir}/index.json`, JSON.stringify({ dt: 0.001, runs: index }, null, 1));
