// 由 content/catalogue.json 生成：site/index.html 的 SIMS 資料、BLUEPRINT.md §6、藍圖網頁 §6
// 用法：node tools/build-catalogue.mjs [藍圖網頁路徑]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CAT = JSON.parse(readFileSync(join(ROOT, "content/catalogue.json"), "utf8"));
const SITE = join(ROOT, "site/index.html");
const MD = join(ROOT, "BLUEPRINT.md");
const HTML = process.argv[2] || join(process.env.LOCALAPPDATA || "", "Temp/claude/C--Users-trevor-OneDrive-DSE-Physics-Lab/518529cb-95ec-48b7-b334-4ccdcf91c4a5/scratchpad/dse-physics-lab-blueprint.html");

const UNITS = [
  ["c1", "必修 I", "熱和氣體", "Heat and Gases"],
  ["c2", "必修 II", "力和運動", "Force and Motion"],
  ["c3", "必修 III", "波動", "Wave Motion"],
  ["c4", "必修 IV", "電和磁", "Electricity and Magnetism"],
  ["c5", "必修 V", "放射現象和核能", "Radioactivity and Nuclear Energy"],
  ["e1", "選修 I", "天文學和航天科學", "Astronomy and Space Science"],
  ["e2", "選修 II", "原子世界", "Atomic World"],
  ["e3", "選修 III", "能量和能源的使用", "Energy and Use of Energy"],
  ["e4", "選修 IV", "醫學物理學", "Medical Physics"],
  ["sk", "跨單元", "基礎技能", "Cross-topic Skills"],
];
const NOTES = {
  c2: "本單元的概念模擬以 `reference/11_Book2_難點與3D模擬器規格.md`（v1.0）為準：S1–S14 對應該文件的模擬器 1–14，P1–P3 為該文件的優先次序（P1 = 第一階段）。B1–B10 為該文件及牛津課本的章節編號。",
};

// 編號：按單元 → 實驗 → 概念（檔案次序 = 課本次序）
const sims = [];
for (const [uid] of UNITS) {
  for (const t of ["e", "c"]) for (const s of CAT.sims.filter(x => x.unit === uid && x.type === t)) sims.push(s);
}
sims.forEach((s, i) => (s.id = i + 1));
const nE = sims.filter(s => s.type === "e").length, nC = sims.length - nE, nStar = sims.filter(s => s.star).length;
const isQ = ch => ch.endsWith("?");
const chLine = uid => CAT.chapters[uid].map(([c, t]) => `${c} ${t}`).join(" · ");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// ---------- site ----------
{
  let html = readFileSync(SITE, "utf8");
  const rows = sims.map(s => JSON.stringify([s.id, s.unit, s.type, s.star, s.zh, s.en, s.dzh, s.den, s.ch])).join(",\n");
  const block = `// SIMS-START（由 tools/build-catalogue.mjs 生成，請改 content/catalogue.json）\n// [id, unit, type(e/c), star, zh, en, descZh, descEn, chapter]\nconst SIMS=[\n${rows}\n];\nconst CHAPTERS=${JSON.stringify(CAT.chapters)};\n// SIMS-END`;
  if (html.includes("// SIMS-START")) html = html.replace(/\/\/ SIMS-START[\s\S]*?\/\/ SIMS-END/, block);
  else html = html.replace(/\/\/ \[id, unit, type\(e\/c\)[^\n]*\nconst SIMS=\[[\s\S]*?\n\];/, block);
  writeFileSync(SITE, html);
}

// ---------- markdown ----------
{
  let md = readFileSync(MD, "utf8");
  const out = [];
  for (const [uid, code, zh, en] of UNITS) {
    const list = sims.filter(s => s.unit === uid);
    out.push(`### ${code}　${zh} ${en}`, "");
    out.push(`課本章節：${chLine(uid)}${CAT.chapters[uid].some(([c]) => isQ(c)) ? "　（? = 推斷，待老師核對）" : ""}`, "");
    if (NOTES[uid]) out.push(`> ${NOTES[uid]}`, "");
    for (const [t, title] of [["e", "實驗 Experiments"], ["c", "概念 Concepts"]]) {
      const l = list.filter(s => s.type === t);
      if (!l.length) continue;
      out.push(`**${title}**`, "", "| # | 章節 | 模擬 Simulation | | 內容 |", "|---|---|---|---|---|");
      for (const s of l) out.push(`| ${s.id} | ${s.ch} | ${s.zh} ${s.en} | ${t === "e" ? "🧪" : "💡"}${s.star ? "⭐" : ""} | ${s.dzh} |`);
      out.push("");
    }
  }
  out.push(`**合共 ${sims.length} 個模擬：${nE} 個實驗、${nC} 個概念；${nStar} 個標為第一階段優先。** 目錄唯一來源：\`content/catalogue.json\`，以 \`node tools/build-catalogue.mjs\` 生成本節、首頁資料及藍圖網頁。`);
  const block = `<!-- CATALOGUE-START -->\n${out.join("\n")}\n<!-- CATALOGUE-END -->`;
  if (md.includes("<!-- CATALOGUE-START -->")) md = md.replace(/<!-- CATALOGUE-START -->[\s\S]*?<!-- CATALOGUE-END -->/, block);
  else md = md.replace(/### 必修 I　熱和氣體[\s\S]*?\*\*合共[^\n]*\*\*/, block);
  writeFileSync(MD, md);
}

// ---------- blueprint html ----------
if (existsSync(HTML)) {
  let h = readFileSync(HTML, "utf8");
  const out = [];
  for (const [uid, code, zh, en] of UNITS) {
    const list = sims.filter(s => s.unit === uid);
    const e = list.filter(s => s.type === "e").length, c = list.length - e;
    out.push(`  <h3>${code}　${zh} <span class="en">${en}</span><span class="unit-stat">${e ? e + " 實驗 · " : ""}${c} 概念</span></h3>`);
    out.push(`  <p class="chs">課本章節：${esc(chLine(uid))}${CAT.chapters[uid].some(([ch]) => isQ(ch)) ? "　<span class=\"q\">? = 推斷，待老師核對</span>" : ""}</p>`);
    if (NOTES[uid]) out.push(`  <p style="font-size:13px;color:var(--ink-2)">${esc(NOTES[uid].replace(/`/g, ""))}</p>`);
    for (const [t, title] of [["e", "實驗 Experiments"], ["c", "概念 Concepts"]]) {
      const l = list.filter(s => s.type === t);
      if (!l.length) continue;
      out.push(`  <h4>${title}</h4>`, `  <div class="tablewrap"><table><tbody>`);
      for (const s of l) out.push(`  <tr><td class="num">${s.id}</td><td class="ch">${esc(s.ch)}</td><td class="k">${esc(s.zh)}<span class="en">${esc(s.en)}</span></td><td class="t">${t === "e" ? '<span class="badge b-exp">實驗</span>' : '<span class="badge b-con">概念</span>'}${s.star ? '<span class="badge b-star">優先</span>' : ""}</td><td class="d">${esc(s.dzh)}</td></tr>`);
      out.push(`  </tbody></table></div>`, "");
    }
  }
  const block = `<!-- CATALOGUE-START -->\n${out.join("\n")}\n<!-- CATALOGUE-END -->\n`;
  if (h.includes("<!-- CATALOGUE-START -->")) h = h.replace(/<!-- CATALOGUE-START -->[\s\S]*?<!-- CATALOGUE-END -->\n/, block);
  else h = h.replace(/  <h3>必修 I　熱和氣體[\s\S]*?(?=  <h3>全站通用物理規範)/, block);
  h = h.replace(/模擬總數 Total <b>\d+<\/b>/, `模擬總數 Total <b>${sims.length}</b>`)
       .replace(/實驗 Experiments <b>\d+<\/b>/, `實驗 Experiments <b>${nE}</b>`)
       .replace(/概念 Concepts <b>\d+<\/b>/, `概念 Concepts <b>${nC}</b>`)
       .replace(/第一階段優先 Phase 1 <b>\d+<\/b>/, `第一階段優先 Phase 1 <b>${nStar}</b>`);
  writeFileSync(HTML, h);
} else console.warn("blueprint html not found:", HTML);

console.log(`built: ${sims.length} sims (${nE} exp, ${nC} con, ${nStar} phase-1)`);
