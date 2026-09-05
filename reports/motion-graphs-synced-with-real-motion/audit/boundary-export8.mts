// 第 8 輪邊界運行導出（只執行 model / plan，不讀其源碼）。用法（repo 根目錄）：
//   npx tsx --tsconfig tsconfig.app.json reports/motion-graphs-synced-with-real-motion/audit/boundary-export8.mts > reports/motion-graphs-synced-with-real-motion/audit/boundary-runs8.ndjson   （每運行一行）
import { model } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/model";
import { plan } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/plan";
import { defaults } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/controls";
import { layers } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/charts";
const allLayers = Object.fromEntries(layers.map((l: any) => [l.key, true]));
const Z = [0,0,0,0,0,0,0,0,0,0,0];
const runs = [
  // 第 7 輪 11 組
  { name: "b-T2-a10-u5", params: { ...defaults, mode: "live", u: 5, a: 10, T: 2 } },
  { name: "b-T2-a-10-u-5", params: { ...defaults, mode: "live", u: -5, a: -10, T: 2 } },
  { name: "b-T60-a10-u-5", params: { ...defaults, mode: "live", u: -5, a: 10, T: 60 } },
  { name: "b-T60-a-10-u5", params: { ...defaults, mode: "live", u: 5, a: -10, T: 60 } },
  { name: "b-T60-a0-u0", params: { ...defaults, mode: "live", u: 0, a: 0, T: 60 } },
  { name: "b-T60-a0-u5", params: { ...defaults, mode: "live", u: 5, a: 0, T: 60 } },
  { name: "b-draw-zero-T10", params: { ...defaults, mode: "draw", T: 10, vt: Z } },
  { name: "b-draw-zero-T2", params: { ...defaults, mode: "draw", T: 2, vt: Z } },
  { name: "b-draw-max-T60", params: { ...defaults, mode: "draw", T: 60, vt: [5,-5,5,-5,5,-5,5,-5,5,-5,5] } },        // F9 反例 2：期望 smax ≥ 250
  { name: "b-draw-end-nonzero-T60", params: { ...defaults, mode: "draw", T: 60, vt: [0,1,2,3,3,3,2,1,0,-1,-2] } }, // F9 反例 1：期望 smax ≥ 87
  { name: "b-draw-T2-partial", params: { ...defaults, mode: "draw", T: 2, vt: [1,-1,1,-1,1,-1,1,-1,1,-1,1] } },     // F10 原例：左段 [1,2] 斜率 +2、右段 −2
  // 第 8 輪新增：T 在內部節點且左右段斜率不同
  { name: "b-draw-T2-L2-R0", params: { ...defaults, mode: "draw", T: 2, vt: [0,1,3,3,3,3,3,3,3,3,3] } },            // 左 +2、右 0
  { name: "b-draw-T3-L0-R5", params: { ...defaults, mode: "draw", T: 3, vt: [0,0,0,0,5,5,5,5,5,5,5] } },            // 左 0、右 +5
  { name: "b-draw-T3-default", params: { ...defaults, mode: "draw", T: 3 } },                                        // 預設 vt：左 +1、右 0
  { name: "b-draw-T9-L-R", params: { ...defaults, mode: "draw", T: 9, vt: [0,0,0,0,0,0,0,0,2,-3,4] } },              // 左 −5、右 +7
  // 第 8 輪新增：s 軸取整（live 準確極值在頂點；draw 極值在段內而非節點）
  { name: "b-live-vertex-u5-a-1-T10", params: { ...defaults, mode: "live", u: 5, a: -1, T: 10 } },                   // s(10)=0，頂點 t=5 s=12.5 → 20
  { name: "b-live-vertex-u-5-a1-T10", params: { ...defaults, mode: "live", u: -5, a: 1, T: 10 } },                   // 鏡像 → 20
  { name: "b-live-T2-u5-a-10", params: { ...defaults, mode: "live", u: 5, a: -10, T: 2 } },                          // s(2)=−10，頂點 1.25 → 10
  { name: "b-live-T2-u0.5-a0", params: { ...defaults, mode: "live", u: 0.5, a: 0, T: 2 } },                          // s=1 → 1
  { name: "b-draw-intra-peak-T10", params: { ...defaults, mode: "draw", T: 10, vt: [4,-4,4,-4,4,-4,4,-4,4,-4,4] } },// 節點 s 全 0，段內 |s| 峰 1 → 期望 smax ≥ 1
  { name: "b-draw-intra-peak-T1.5", params: { ...defaults, mode: "draw", T: 1.5, vt: [3,-3,0,0,0,0,0,0,0,0,0] } },   // |s|max = 1.125（t = 1.5）→ 2
  { name: "b-draw-hold-T20", params: { ...defaults, mode: "draw", T: 20, vt: [0,0,0,0,0,0,0,0,0,0,-3] } },           // 保持段：s(20) = −1.5 − 30 = −31.5 → 50
];
for (const r of runs) {
  let s = model.init(r.params as any); const frames: any[] = [];
  const N = 60001; const DT = 0.001;
  for (let i = 0; i < N; i++) {
    const obs = model.observe(s, r.params as any);
    const p = plan(s, r.params as any, obs, allLayers);
    frames.push({ t: (s as any).t ?? i * DT, obs, ax: p.arrows.map((a: any) => [a.kind, a.origin[0], a.vector[0], a.vector[1], a.vector[2]]), scales: p.scales, meta: p.meta });
    s = model.step(s, r.params as any, DT);
  }
  process.stdout.write(JSON.stringify({ name: r.name, params: r.params, dt: DT, frames }) + "\n");
}
