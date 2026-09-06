// 設計語言 lint：src/sims/**/*.tsx 只可以用 src/components/design.ts 的顏色、字體、刻度與畫圖工具。
// 用法：node tools/designlint.mjs [檔案…]（不給檔案即掃全部模擬）。退出碼 2 = 有錯。
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "..");
export const isSceneFile = f => /[\\/]src[\\/]sims[\\/][^\\/]+[\\/][^\\/]+\.tsx$/.test(f);

const RULES = [
  { re: /\.font\s*=\s*(?!.*\b(uiFont|monoFont|symbolFont)\()/, msg: "ctx.font 只可用 uiFont / monoFont / symbolFont（design.ts）" },
  { re: /\b(const|let|function)\s+(nice|tick|fmt|trim3|arrow2d|drawArrow|theme|Theme)\b/, msg: "不可自定義 nice / tick / fmt / arrow / theme，請 import 自 @/components/design" },
  { re: /getPropertyValue\("--/, msg: "主題色請用 theme()（design.ts），不要自己讀 CSS 變數" },
  { re: /(["'`]|\s)#[0-9a-fA-F]{3,8}\b(?!.*design-ok)/, msg: "不可直接寫十六進位顏色，請用 SCENE / SERIES / theme()（確有例外時在該行加註 // design-ok）" },
  { re: /rgba?\((?!.*design-ok)/, msg: "不可直接寫 rgb / rgba 顏色，請用 SCENE / SERIES / AREA_FILL（例外加註 // design-ok）" },
];

export function lintDesign(files) {
  let errors = 0; const lines = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, "utf8").split("\n");
    src.forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;   // 純註解行不檢
      for (const r of RULES) if (r.re.test(line)) { errors++; lines.push(`✗ ${path.relative(ROOT, f)}:${i + 1}  ${r.msg}`); break; }
    });
  }
  return { errors, lines };
}

function allSceneFiles() {
  const out = []; const simsDir = path.join(ROOT, "src", "sims");
  for (const d of fs.readdirSync(simsDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(simsDir, d.name))) if (f.endsWith(".tsx")) out.push(path.join(simsDir, d.name, f));
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  const files = process.argv.slice(2).length ? process.argv.slice(2).map(f => path.resolve(f)) : allSceneFiles();
  const { errors, lines } = lintDesign(files.filter(isSceneFile));
  for (const l of lines) console.log(l);
  console.log(`designlint：${files.length} 個檔案，${errors} 個錯誤`);
  process.exit(errors ? 2 : 0);
}
