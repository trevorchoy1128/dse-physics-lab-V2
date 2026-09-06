import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runFrames } from "./model.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
const index = JSON.parse(fs.readFileSync(path.join(dataDir, "index.json"), "utf8"));
const { dt, frames } = index;

for (const run of index.runs) {
  const out = runFrames(run.params, dt, frames);
  fs.writeFileSync(path.join(here, run.name + ".json"), JSON.stringify({ name: run.name, params: run.params, dt, frames: out }));
  console.log("wrote", run.name, out.length, "frames; final t =", out[out.length - 1].t);
}
