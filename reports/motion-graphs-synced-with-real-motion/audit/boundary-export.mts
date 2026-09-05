// 邊界運行導出（只執行 model / plan，不讀其源碼）。用法（repo 根目錄）：
//   npx tsx --tsconfig tsconfig.app.json reports/motion-graphs-synced-with-real-motion/audit/boundary-export.mts > reports/motion-graphs-synced-with-real-motion/audit/boundary-runs.json
import { model } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/model";
import { plan } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/plan";
import { defaults } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/controls";
import { layers } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/charts";
const allLayers = Object.fromEntries(layers.map((l: any) => [l.key, true]));
const runs = [
  { name: "b-T2-a10-u5", params: { ...defaults, mode: "live", u: 5, a: 10, T: 2 } },
  { name: "b-T2-a-10-u-5", params: { ...defaults, mode: "live", u: -5, a: -10, T: 2 } },
  { name: "b-T60-a10-u-5", params: { ...defaults, mode: "live", u: -5, a: 10, T: 60 } },
  { name: "b-T60-a-10-u5", params: { ...defaults, mode: "live", u: 5, a: -10, T: 60 } },
  { name: "b-T60-a0-u0", params: { ...defaults, mode: "live", u: 0, a: 0, T: 60 } },
  { name: "b-T60-a0-u5", params: { ...defaults, mode: "live", u: 5, a: 0, T: 60 } },
  { name: "b-draw-zero-T10", params: { ...defaults, mode: "draw", T: 10, vt: [0,0,0,0,0,0,0,0,0,0,0] } },
  { name: "b-draw-zero-T2", params: { ...defaults, mode: "draw", T: 2, vt: [0,0,0,0,0,0,0,0,0,0,0] } },
  { name: "b-draw-max-T60", params: { ...defaults, mode: "draw", T: 60, vt: [5,-5,5,-5,5,-5,5,-5,5,-5,5] } },
  { name: "b-draw-end-nonzero-T60", params: { ...defaults, mode: "draw", T: 60, vt: [0,1,2,3,3,3,2,1,0,-1,-2] } },
  { name: "b-draw-T2-partial", params: { ...defaults, mode: "draw", T: 2, vt: [1,-1,1,-1,1,-1,1,-1,1,-1,1] } },
];
const result: any[] = [];
for (const r of runs) {
  let s = model.init(r.params as any); const frames: any[] = [];
  const N = 60001; const DT = 0.001;
  for (let i = 0; i < N; i++) {
    const obs = model.observe(s, r.params as any);
    const p = plan(s, r.params as any, obs, allLayers);
    // 只保留每 1 ms 幀但把 arrows 壓成向量 x 分量，減少體積
    frames.push({ t: (s as any).t ?? i * DT, obs, ax: p.arrows.map((a: any) => [a.kind, a.origin[0], a.vector[0], a.vector[1], a.vector[2]]), scales: p.scales, meta: p.meta });
    s = model.step(s, r.params as any, DT);
  }
  result.push({ name: r.name, params: r.params, dt: DT, frames });
}
process.stdout.write(JSON.stringify(result));
