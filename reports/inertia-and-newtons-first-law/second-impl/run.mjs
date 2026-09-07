// 依 data/index.json 與 data/index-extra.json 的參數與幀數跑第二實作，輸出 second-impl/<run>.json
// 格式：{name, params, change?, dt, frames:[{t, obs}]}。
// 第 2 輪：extra 運行的 change = {t, params}（由 t 起把 params 換成該值，之後保持）交給 model.run 處理。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./model.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
for (const idxName of ["index.json", "index-extra.json"]) {
  const index = JSON.parse(fs.readFileSync(path.join(dataDir, idxName), "utf8"));
  for (const r of index.runs) {
    const frames = run(r.params, index.frames, index.dt, r.change ?? null);
    const out = { name: r.name, params: r.params, dt: index.dt, frames };
    if (r.change) out.change = r.change;
    fs.writeFileSync(path.join(here, r.name + ".json"), JSON.stringify(out));
    const last = frames[frames.length - 1];
    console.log(r.name.padEnd(32), "T=", last.obs.T, r.change ? `change@${r.change.t} ${JSON.stringify(r.change.params)}` : "", "final:", JSON.stringify(last.obs).slice(0, 140));
  }
}
