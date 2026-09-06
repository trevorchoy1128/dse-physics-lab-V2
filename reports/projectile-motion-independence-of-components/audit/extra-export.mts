// 核數用：以作者的 model/plan 產生額外運行（角度掃描、第二顆球「同時自由下落」、參數邊界）。
// 核數員不讀 model.ts / plan.ts，只呼叫並比對輸出。
import { model } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/projectile-motion-independence-of-components/model";
import { plan } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/projectile-motion-independence-of-components/plan";
import { defaults } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/projectile-motion-independence-of-components/controls";
import { layers } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/projectile-motion-independence-of-components/charts";
import { writeFileSync, mkdirSync } from "node:fs";
const allLayers = Object.fromEntries(layers.map(l => [l.key, true]));
const N = Number(process.argv[2] ?? 4000);
const runs: { name: string; params: any }[] = [
  ...[15, 30, 45, 60, 75].map(th => ({ name: `angle-${th}`, params: { ...defaults, u: 15, theta: th, h: 0, companion: "none" } })),
  { name: "drop-default", params: { ...defaults, companion: "drop" } },
  { name: "drop-h20-theta0", params: { ...defaults, u: 10, theta: 0, h: 20, companion: "drop" } },
  { name: "edge-theta90-h0", params: { ...defaults, theta: 90, h: 0, companion: "none" } },
  { name: "edge-theta-30-h0", params: { ...defaults, theta: -30, h: 0, companion: "none" } },
  { name: "edge-theta-30-h0-fast", params: { ...defaults, theta: -30, h: 0, companion: "fast" } },
  { name: "edge-u1-theta90-h0-g1.6", params: { ...defaults, u: 1, theta: 90, h: 0, g: 1.6, companion: "drop" } },
  { name: "edge-u50-theta45-h50-g1.6", params: { ...defaults, u: 50, theta: 45, h: 50, g: 1.6, companion: "fast" } },
  { name: "edge-u50-theta45-h50-g10-air", params: { ...defaults, u: 50, theta: 45, h: 50, g: 10, air: true, companion: "fast" } },
  { name: "edge-u50-theta-30-h50-air", params: { ...defaults, u: 50, theta: -30, h: 50, air: true, companion: "drop" } },
  { name: "edge-u1-theta0-h0", params: { ...defaults, u: 1, theta: 0, h: 0, companion: "fast" } },
];
const outDir = "C:/Users/trevor/dev/dse-physics-lab/reports/projectile-motion-independence-of-components/audit/extra-data";
mkdirSync(outDir, { recursive: true });
const index: any[] = [];
for (const r of runs) {
  let s = model.init(r.params); const frames: any[] = [];
  for (let i = 0; i < N; i++) {
    const obs = model.observe(s, r.params);
    const p = plan(s, r.params, obs, allLayers);
    frames.push({ t: s.t ?? i * 0.001, obs, arrows: p.arrows, labels: p.labels, scales: p.scales, meta: p.meta });
    s = model.step(s, r.params, 0.001);
  }
  writeFileSync(`${outDir}/${r.name}.json`, JSON.stringify({ name: r.name, params: r.params, dt: 0.001, frames }));
  index.push({ name: r.name, params: r.params });
  console.error("wrote", r.name, "tf(meta)=", frames[0].meta.tf, "last obs.t=", frames[N - 1].obs.t, "x=", frames[N - 1].obs.x, "y=", frames[N - 1].obs.y);
}
writeFileSync(`${outDir}/index.json`, JSON.stringify({ frames: N, dt: 0.001, runs: index }, null, 1));
