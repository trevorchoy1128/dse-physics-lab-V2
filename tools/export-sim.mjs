// 導出一個模擬的逐幀數據，供 physics-auditor 獨立核數
// 用法：node tools/export-sim.mjs <simId> [--frames 2000] [--dt 0.001] [--random 5]
// 輸出：reports/<simId>/data/<run>.json，每個運行含 params、每幀 t / observe / plan.arrows / plan.labels
// 需要正式項目已建立（src/sims/<simId>/{model,plan,controls,scenarios}.ts）並安裝 tsx：npm i -D tsx
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { ROOT } from "./glossary.mjs";

const [simId, ...rest] = process.argv.slice(2);
if (!simId) { console.error("用法：node tools/export-sim.mjs <simId>"); process.exit(1); }
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? Number(rest[i + 1]) : d; };
const FRAMES = opt("--frames", 2000), DT = opt("--dt", 0.001), RANDOM = opt("--random", 5);
const out = join(ROOT, "reports", simId, "data");
const SRC = pathToFileURL(join(ROOT, "src")).href;
mkdirSync(out, { recursive: true });

// 在 tsx 內執行：讀 model / plan / controls / scenarios，跑各個運行
const script = `
import { model } from "${SRC}/sims/${simId}/model";
import { plan } from "${SRC}/sims/${simId}/plan";
import { controls, defaults } from "${SRC}/sims/${simId}/controls";
import { scenarios } from "${SRC}/sims/${simId}/scenarios";
import { layers } from "${SRC}/sims/${simId}/charts";
const allLayers = Object.fromEntries(layers.map(l => [l.key, true]));
let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const runs = [
  { name: "default", params: { ...defaults } },
  ...scenarios.map(s => ({ name: "scenario-" + s.key, params: { ...defaults, ...s.params } })),
  ...Array.from({ length: ${RANDOM} }, (_, k) => ({ name: "random-" + k, params: { ...defaults, ...Object.fromEntries(controls.map(c =>
      [c.key, (c.kind === "select" || c.kind === "segment") ? c.options[Math.floor(rnd() * c.options.length)].value
            : c.kind === "toggle" ? rnd() < 0.5
            : c.min + rnd() * (c.max - c.min)])) } })),
];
const result = [];
for (const r of runs) {
  let s = model.init(r.params); const frames = [];
  for (let i = 0; i < ${FRAMES}; i++) {
    const obs = model.observe(s, r.params);
    const p = plan(s, r.params, obs, allLayers);
    frames.push({ t: s.t ?? i * ${DT}, obs, arrows: p.arrows, labels: p.labels, scales: p.scales });
    s = model.step(s, r.params, ${DT});
  }
  result.push({ name: r.name, params: r.params, dt: ${DT}, frames });
}
process.stdout.write(JSON.stringify(result));
`;
const scriptPath = join(out, "_export.mts");
writeFileSync(scriptPath, script);
const r = spawnSync("npx", ["tsx", "--tsconfig", "tsconfig.app.json", scriptPath], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 30, shell: true });
if (r.status !== 0) { console.error(r.stderr); process.exit(r.status ?? 1); }
const runs = JSON.parse(r.stdout);
for (const run of runs) writeFileSync(join(out, run.name + ".json"), JSON.stringify(run));
writeFileSync(join(out, "index.json"), JSON.stringify({ simId, frames: FRAMES, dt: DT, runs: runs.map(x => ({ name: x.name, params: x.params })) }, null, 2));
console.log(`導出 ${runs.length} 個運行 × ${FRAMES} 幀 → reports/${simId}/data/`);
