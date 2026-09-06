// Claude Code PostToolUse hook：Write / Edit 內容檔後自動跑 termlint
// stdin 收到工具呼叫的 JSON；只對內容檔動作。發現 error 以退出碼 2 回報，Claude 會看到並修正。
import { lintFiles, isContentFile } from "./termlint.mjs";
import { lintDesign, isSceneFile } from "./designlint.mjs";

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", c => (raw += c));
process.stdin.on("end", () => {
  let file = "";
  try { const j = JSON.parse(raw); file = j?.tool_input?.file_path || j?.tool_input?.notebook_path || ""; } catch { }
  if (file && isSceneFile(file)) {   // 設計語言：Scene / Views 只可用 design.ts 的顏色、字體、工具
    const d = lintDesign([file]);
    if (d.errors) { console.error(d.lines.join("\n")); console.error("designlint：請改用 src/components/design.ts 的 theme / SCENE / SERIES / uiFont / monoFont / drawArrow2D / drawPane（見 .claude/skills/new-sim/references/design-language.md）"); process.exit(2); }
  }
  if (!file || !isContentFile(file)) process.exit(0);
  const { errors, warns } = lintFiles([file]);
  if (errors) {
    console.error(`termlint：${file} 有 ${errors} 個自創術語，請依 reference/08_中英術語對照表.csv 修正後再繼續。查詢：node tools/term.mjs "<english>"`);
    process.exit(2);
  }
  if (warns) console.error(`termlint：${warns} 個提示（別稱或未列出的組合），如確為正確用法請加入 content/term-allow.txt`);
  process.exit(0);
});
