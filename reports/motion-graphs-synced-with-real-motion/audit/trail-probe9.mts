// 第 9 輪：導出 t = T 幀（或 60 s 末幀）的三條曲線 trails 全部點（只執行 model/plan）。輸出 ndjson。
import fs from "node:fs";
import { model } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/model";
import { plan } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/plan";
import { defaults } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/controls";
import { layers } from "file:///C:/Users/trevor/dev/dse-physics-lab/src/sims/motion-graphs-synced-with-real-motion/charts";
const allLayers = Object.fromEntries(layers.map((l: any) => [l.key, true]));
const idx = JSON.parse(fs.readFileSync("C:/Users/trevor/dev/dse-physics-lab/reports/motion-graphs-synced-with-real-motion/data/index.json", "utf8"));
const runs: any[] = [
  ...idx.runs.map((r: any) => ({ name: "idx-" + r.name, params: r.params })),
  { name: "d-T45-alt4", params: { ...defaults, mode: "draw", T: 45, vt: [4,-4,4,-4,4,-4,4,-4,4,-4,4] } },
  { name: "d-T20-alt5", params: { ...defaults, mode: "draw", T: 20, vt: [0,5,0,5,0,5,0,5,0,5,0] } },
  { name: "d-T45-ramp", params: { ...defaults, mode: "draw", T: 45, vt: [0,1,2,3,3,3,2,1,0,-1,-2] } },
  { name: "l-T60-u-5-a10", params: { ...defaults, mode: "live", u: -5, a: 10, T: 60 } },
];
for (const r of runs) {
  let s = model.init(r.params as any); const DT = 0.001; const snaps: any[] = [];
  const iT = Math.min(60000, Math.ceil(r.params.T / DT - 1e-9));
  const want = new Set([Math.floor(iT / 2), iT, Math.min(60000, iT + 1000)]);
  for (let i = 0; i <= Math.min(60000, iT + 1000); i++) {
    if (want.has(i)) { const obs = model.observe(s, r.params as any); const p: any = plan(s, r.params as any, obs, allLayers); snaps.push({ i, t: (s as any).t, obs, trails: p.trails, meta: p.meta }); }
    s = model.step(s, r.params as any, DT);
  }
  process.stdout.write(JSON.stringify({ name: r.name, params: r.params, snaps }) + "\n");
}
