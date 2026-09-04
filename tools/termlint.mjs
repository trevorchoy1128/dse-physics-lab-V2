// 用法：node tools/termlint.mjs [檔案...]   （不給檔案 = 掃描全部內容檔）
// 揪出自創術語。error 會令退出碼為 2；warn 只提示。
import { readFileSync, globSync, statSync } from "node:fs";
import { relative, join } from "node:path";
import { lint, lineOf, ROOT } from "./glossary.mjs";

export const CONTENT_GLOBS = [
  "content/**/*.md", "content/**/*.json", "BLUEPRINT.md", "site/index.html",
  "src/sims/**/*.md", "src/sims/**/*.json", "src/**/glossary*.ts", "src/**/ui*.ts",
];
export const isContentFile = f => {
  const r = relative(ROOT, f).replace(/\\/g, "/");
  return /^(content\/.*\.(md|json)|BLUEPRINT\.md|site\/index\.html|src\/sims\/.*\.(md|json)|src\/.*\/(glossary|ui)[^/]*\.ts)$/.test(r);
};

export function lintFiles(files, { strict = false } = {}) {
  let errors = 0, warns = 0;
  for (const f of files) {
    let text; try { text = readFileSync(f, "utf8"); } catch { continue; }
    const issues = lint(text, { file: f, strict });
    for (const it of issues) {
      const line = lineOf(text, it.index);
      console.log(`${it.level === "error" ? "✗" : "△"} ${relative(ROOT, f)}:${line}  ${it.msg}`);
      if (it.level === "error") errors++; else warns++;
    }
  }
  return { errors, warns };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (isMain) {
  const strict = process.argv.includes("--strict");
  let files = process.argv.slice(2).filter(a => !a.startsWith("--"));
  if (!files.length) files = CONTENT_GLOBS.flatMap(p => globSync(p, { cwd: ROOT })).map(f => join(ROOT, f));
  files = [...new Set(files)].filter(f => { try { return statSync(f).isFile(); } catch { return false; } });
  const { errors, warns } = lintFiles(files, { strict });
  console.log(`termlint：${files.length} 個檔案，${errors} 個錯誤，${warns} 個提示`);
  process.exit(errors ? 2 : 0);
}
