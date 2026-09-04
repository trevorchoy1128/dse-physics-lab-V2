// 用法：node tools/term.mjs "path difference" ["snell's law" ...]
// 由英文查權威中譯；查不到即以非零狀態退出（不得自行翻譯）
import { term } from "./glossary.mjs";
const args = process.argv.slice(2);
if (!args.length) { console.error('用法：node tools/term.mjs "<english term>" ...'); process.exit(1); }
let fail = 0;
for (const a of args) {
  try { const t = term(a); console.log(`${a}\t${t.zh}${t.alts.length ? `\t別稱：${t.alts.join(" / ")}` : ""}\t${t.src}`); }
  catch (e) { console.error(e.message); fail = 1; }
}
process.exit(fail);
