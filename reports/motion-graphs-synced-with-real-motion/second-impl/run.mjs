import fs from "node:fs";
import path from "node:path";
import { simulate } from "./model.mjs";
const root = "C:/Users/trevor/dev/dse-physics-lab/reports/motion-graphs-synced-with-real-motion";
const index = JSON.parse(fs.readFileSync(path.join(root, "data/index.json"), "utf8"));
for (const run of index.runs) {
  const frames = simulate(run.params, index.dt, index.frames);
  fs.writeFileSync(path.join(root, "second-impl", run.name + ".json"),
    JSON.stringify({ name: run.name, params: run.params, dt: index.dt, frames }));
  console.log("wrote", run.name, frames.length, "last t", frames[frames.length - 1].t);
}
