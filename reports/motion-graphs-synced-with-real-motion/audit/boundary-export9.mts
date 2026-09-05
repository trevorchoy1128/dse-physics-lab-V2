// 第 9 輪邊界運行導出（只執行 model / plan，不讀其源碼）。用法（repo 根目錄）：
//   npx tsx --tsconfig tsconfig.app.json reports/motion-graphs-synced-with-real-motion/audit/boundary-export9.mts > reports/motion-graphs-synced-with-real-motion/audit/boundary-runs9.ndjson
// 每行一個運行。index.json 的 10 個運行只輸出 trails 摘要（framesOut = false），其餘輸出全部 60 001 幀（緊湊格式）。
import fs from "node:fs";
import { model } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/model";
import { plan } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/plan";
import { defaults } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/controls";
import { layers } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/charts";
const allLayers = Object.fromEntries(layers.map((l: any) => [l.key, true]));
const idx = JSON.parse(fs.readFileSync("C:/Users/trevor/dev/dse-physics-lab/reports/motion-graphs-synced-with-real-motion/data/index.json", "utf8"));
const Z = [0,0,0,0,0,0,0,0,0,0,0];
const A = [0,1,3,2,0,-1,-3,-2,0,2,4];
const runs: any[] = [
  ...idx.runs.map((r: any) => ({ name: "idx-" + r.name, params: r.params, framesOut: false })),
  // 本輪重點：nodeDt = max(1, T/10)
  { name: "d-T20-alt5", params: { ...defaults, mode: "draw", T: 20, vt: [0,5,0,5,0,5,0,5,0,5,0] } },        // nodeDt 2，a = ±2.5；amax 應 2.5（舊規則會給 5）
  { name: "d-T45-ramp", params: { ...defaults, mode: "draw", T: 45, vt: [0,1,2,3,3,3,2,1,0,-1,-2] } },     // nodeDt 4.5，11 點在 0, 4.5, …, 45
  { name: "d-T45-alt4", params: { ...defaults, mode: "draw", T: 45, vt: [4,-4,4,-4,4,-4,4,-4,4,-4,4] } },   // 節點 s 全 0，段內 |s| 峰 4.5
  { name: "d-T60-alt5", params: { ...defaults, mode: "draw", T: 60, vt: [5,-5,5,-5,5,-5,5,-5,5,-5,5] } },   // nodeDt 6，a = ±10/6
  { name: "d-T60-lastneg3", params: { ...defaults, mode: "draw", T: 60, vt: [0,0,0,0,0,0,0,0,0,0,-3] } },   // 末段 54–60 s 斜率 −0.5
  { name: "d-T60-ramp", params: { ...defaults, mode: "draw", T: 60, vt: [0,1,2,3,3,3,2,1,0,-1,-2] } },
  { name: "d-T10-A", params: { ...defaults, mode: "draw", T: 10, vt: A } },                                  // nodeDt 1
  { name: "d-T10.5-A", params: { ...defaults, mode: "draw", T: 10.5, vt: A } },                              // nodeDt 1.05
  { name: "d-T11-A", params: { ...defaults, mode: "draw", T: 11, vt: A } },                                  // nodeDt 1.1
  { name: "d-T13.3-ramp", params: { ...defaults, mode: "draw", T: 13.316564376147728, vt: [0,1,2,3,3,3,2,1,0,-1,-2] } },
  { name: "d-T2-pm1", params: { ...defaults, mode: "draw", T: 2, vt: [1,-1,1,-1,1,-1,1,-1,1,-1,1] } },       // 只用前 3 點
  { name: "d-T2-L2-R0", params: { ...defaults, mode: "draw", T: 2, vt: [0,1,3,3,3,3,3,3,3,3,3] } },
  { name: "d-T3-L0-R5", params: { ...defaults, mode: "draw", T: 3, vt: [0,0,0,0,5,5,5,5,5,5,5] } },
  { name: "d-T5-default", params: { ...defaults, mode: "draw", T: 5 } },                                     // 6 個控制點
  { name: "d-T9-LR", params: { ...defaults, mode: "draw", T: 9, vt: [0,0,0,0,0,0,0,0,2,-3,4] } },
  { name: "d-T10-zero", params: { ...defaults, mode: "draw", T: 10, vt: Z } },
  { name: "d-T60-zero", params: { ...defaults, mode: "draw", T: 60, vt: Z } },
  { name: "d-T10-alt4", params: { ...defaults, mode: "draw", T: 10, vt: [4,-4,4,-4,4,-4,4,-4,4,-4,4] } },
  // live 兩端
  { name: "l-T2-u5-a10", params: { ...defaults, mode: "live", u: 5, a: 10, T: 2 } },
  { name: "l-T2-u-5-a-10", params: { ...defaults, mode: "live", u: -5, a: -10, T: 2 } },
  { name: "l-T2-u5-a-10", params: { ...defaults, mode: "live", u: 5, a: -10, T: 2 } },
  { name: "l-T60-u-5-a10", params: { ...defaults, mode: "live", u: -5, a: 10, T: 60 } },
  { name: "l-T60-u5-a-10", params: { ...defaults, mode: "live", u: 5, a: -10, T: 60 } },
  { name: "l-T60-u0-a0", params: { ...defaults, mode: "live", u: 0, a: 0, T: 60 } },
  { name: "l-T60-u5-a0", params: { ...defaults, mode: "live", u: 5, a: 0, T: 60 } },
  { name: "l-T10-u5-a-1", params: { ...defaults, mode: "live", u: 5, a: -1, T: 10 } },
];
for (const r of runs) {
  let s = model.init(r.params as any); const frames: any[] = [];
  const N = 60001; const DT = 0.001;
  const handleSet = new Set<string>(); let trailKeys: string[] = []; let handles0: any = null;
  const trailLast = { st: 0, vt: 0, at: 0, count: 0 }; let lenAtT = -1, lenEnd = -1, lenGrowAfterT = 0; const trailLastFail: any[] = [];
  let firstTrailLens: any = null;
  for (let i = 0; i < N; i++) {
    const obs = model.observe(s, r.params as any);
    const p: any = plan(s, r.params as any, obs, allLayers);
    const t = (s as any).t ?? i * DT;
    const tr = Object.fromEntries((p.trails || []).map((x: any) => [x.key, x.points]));
    if (i === 0) { trailKeys = (p.trails || []).map((x: any) => x.key); handles0 = tr["vt-handles"] ?? null; firstTrailLens = Object.fromEntries(Object.entries(tr).map(([k, v]: any) => [k, v.length])); }
    handleSet.add(JSON.stringify(tr["vt-handles"] ?? null));
    // 三條曲線最後一點 = [t, obs, 0]？
    const chk = (k: string, val: number, tag: string) => { const pts = tr[k]; if (!pts || !pts.length) { trailLast.count++; return; } const L = pts[pts.length - 1]; if (!(L[0] === t && L[1] === val)) { (trailLast as any)[tag]++; if (trailLastFail.length < 6) trailLastFail.push({ i, t, k, L, val }); } };
    chk("s-t", obs.s, "st"); chk("v-t", obs.v, "vt"); chk("a-t", obs.a, "at");
    const stLen = tr["s-t"] ? tr["s-t"].length : -1;
    if (t >= r.params.T) { if (lenAtT < 0) lenAtT = stLen; else if (stLen > lenEnd) lenGrowAfterT++; }
    lenEnd = stLen;
    if (r.framesOut !== false) frames.push({ t, obs, ax: p.arrows.map((a: any) => [a.kind, a.origin[0], a.vector[0], a.vector[1], a.vector[2]]), scales: p.scales, meta: p.meta, nb: p.bodies.length, bx: p.bodies[0]?.position?.[0] });
    s = model.step(s, r.params as any, DT);
  }
  process.stdout.write(JSON.stringify({ name: r.name, params: r.params, dt: DT, trailKeys, handles0, handleVariants: handleSet.size, trailLast, trailLastFail, firstTrailLens, lenAtT, lenEnd, lenGrowAfterT, frames }) + "\n");
}
