// 閘 3 審核面板：把一個模擬的截圖、驗收報告結論、規格對照、待定項目合成一頁 HTML
// 用法：node tools/review-panel.mjs <simId>   →  reports/<simId>/review.html
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ROOT } from "./glossary.mjs";

const simId = process.argv[2];
if (!simId) { console.error("用法：node tools/review-panel.mjs <simId>"); process.exit(1); }
const dir = join(ROOT, "reports", simId);
const simDir = join(ROOT, "src", "sims", simId);

// 讀 manifest / scenarios / controls（經 tsx）
const tmp = join(dir, "_meta.mts");
writeFileSync(tmp, `
import { manifest } from "${pathToFileURL(join(simDir, "manifest")).href}";
import { scenarios } from "${pathToFileURL(join(simDir, "scenarios")).href}";
import { controls, defaults } from "${pathToFileURL(join(simDir, "controls")).href}";
process.stdout.write(JSON.stringify({ manifest, scenarios, controls: controls.map(c => ({ ...c, visible: undefined })), defaults }));
`);
const r = spawnSync("npx", ["tsx", "--tsconfig", "tsconfig.app.json", tmp], { cwd: ROOT, encoding: "utf8", shell: true, maxBuffer: 1 << 26 });
unlinkSync(tmp);
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
const { manifest, scenarios, controls, defaults } = JSON.parse(r.stdout);

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const md = f => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "");
const section = (text, title) => { const m = text.match(new RegExp(`^##+\\s*(?:\\d+\\.\\s*)?${title}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|\\Z)`, "m")); return m ? m[1].trim() : ""; };
const mdToHtml = s => esc(s).replace(/^\|(.+)\|$/gm, l => `<tr>${l.split("|").slice(1, -1).map(c => `<td>${c.trim()}</td>`).join("")}</tr>`).replace(/(<tr>[\s\S]+?<\/tr>)(?!\s*<tr>)/g, "<table>$1</table>").replace(/<tr>(<td>-+<\/td>)+<\/tr>/g, "").replace(/^- (.*)$/gm, "<li>$1</li>").replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`).replace(/\n{2,}/g, "<br>").replace(/\n/g, " ");

const reports = [
  { key: "physics-audit", zh: "物理核數員", file: "physics-audit.md" },
  { key: "second-impl", zh: "第二實作者", file: "second-impl.md" },
  { key: "student-test", zh: "學生試用者", file: "student-test.md" },
  { key: "apparatus-review", zh: "儀器審核員", file: "apparatus-review.md" },
].map(x => ({ ...x, text: md(x.file) })).filter(x => x.text);

// 規格「學生應該看見的現象」段
let phenomena = "";
if (manifest.spec) {
  const spec = readFileSync(join(ROOT, manifest.spec.doc), "utf8");
  const sec = spec.split(new RegExp(`^### ${manifest.spec.section}`, "m"))[1] ?? "";
  const m = sec.match(/#### 學生應該看見的現象\n([\s\S]*?)(?=\n####|\n---)/);
  phenomena = m ? m[1].trim() : "";
}

// 截圖（base64 內嵌）
const shotsDir = join(dir, "shots");
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter(f => f.endsWith(".png")).sort() : [];
const img = f => `data:image/png;base64,${readFileSync(join(shotsDir, f)).toString("base64")}`;
const scenarioLabel = f => { const m = f.match(/scenario-(\d+)-(early|end)/); if (!m) return f; const s = scenarios[Number(m[1]) - 1]; return `試試看 ${m[1]}${m[2] === "early" ? "（起始）" : "（末端）"}：「${s?.misconception.zh ?? ""}」`; };

const decisions = [
  ...manifest.beyondSpec.map(x => ({ kind: "規格以外", text: x })),
  ...manifest.pendingTerms.map(x => ({ kind: "術語", text: x })),
  ...(manifest.pendingPapers.length ? [{ kind: "考題回歸", text: `未有評卷參考：${manifest.pendingPapers.join("、")}` }] : []),
  ...reports.flatMap(rp => { const s = section(rp.text, "規格待釐清"); return s ? [{ kind: `${rp.zh}提出`, text: s }] : []; }),
];

const html = `<title>審核：${esc(manifest.title.zh)}</title>
<style>
:root{--bg:#f5f7f4;--paper:#fff;--ink:#1b2530;--ink2:#4a5563;--ink3:#7b8591;--line:#d8ddd7;--accent:#0e6f6a;--soft:#dceeec;--star:#b7761b;--starsoft:#f6e9d3;--bad:#b3261e;--badsoft:#f7dcdb}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#131920;--paper:#1b2229;--ink:#e6eaee;--ink2:#b4bcc5;--ink3:#7f8993;--line:#2c353e;--accent:#4fb8b1;--soft:#173634;--star:#e0a24c;--starsoft:#3d2e16;--bad:#f28b82;--badsoft:#4a2320}}
:root[data-theme="dark"]{--bg:#131920;--paper:#1b2229;--ink:#e6eaee;--ink2:#b4bcc5;--ink3:#7f8993;--line:#2c353e;--accent:#4fb8b1;--soft:#173634;--star:#e0a24c;--starsoft:#3d2e16;--bad:#f28b82;--badsoft:#4a2320}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;font-size:15px;line-height:1.6}
.wrap{max-width:1100px;margin:0 auto;padding:32px 24px 80px}
h1{font-family:"Noto Serif TC",serif;font-size:26px;margin:0 0 4px}
.meta{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--ink3);letter-spacing:.04em}
section{background:var(--paper);border:1px solid var(--line);padding:20px 24px;margin-top:18px}
h2{font-family:"Noto Serif TC",serif;font-size:19px;margin:0 0 10px}
h3{font-size:14px;margin:14px 0 6px;color:var(--ink2)}
.badge{display:inline-block;font-size:12px;padding:2px 9px;border-radius:3px;margin-right:6px;font-weight:500}
.ok{background:var(--soft);color:var(--accent)}.warn{background:var(--starsoft);color:var(--star)}.bad{background:var(--badsoft);color:var(--bad)}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.shots figure{margin:0;border:1px solid var(--line);background:var(--bg)}
.shots img{width:100%;display:block}
.shots figcaption{font-size:12.5px;padding:6px 8px;color:var(--ink2)}
table{border-collapse:collapse;width:100%;font-size:13.5px;margin:6px 0}
td,th{border-bottom:1px solid var(--line);padding:5px 8px;vertical-align:top;text-align:left}
ul{margin:4px 0;padding-left:20px}
.report{font-size:13.5px;color:var(--ink2);max-width:80ch}
.decide{display:grid;gap:8px}
.decide div{display:grid;grid-template-columns:110px 1fr;gap:12px;padding:8px 10px;border:1px solid var(--line);background:var(--bg);font-size:13.5px}
.decide b{color:var(--star);font-weight:500}
.how{border-left:3px solid var(--accent);padding:8px 14px;background:var(--soft);font-size:13.5px}
pre{white-space:pre-wrap;font-family:"IBM Plex Mono",monospace;font-size:12.5px}
</style>
<div class="wrap">
<p class="meta">審核面板 · 閘 3 · ${esc(manifest.chapter)}${manifest.spec ? " · " + esc(manifest.spec.code ?? manifest.spec.section) : ""} · v${esc(manifest.version)} · ${esc(simId)}</p>
<h1>${esc(manifest.title.zh)}</h1>
<p>${esc(manifest.summary.zh)}</p>

<section>
<h2>驗收結論</h2>
${reports.map(rp => { const c = section(rp.text, "結論"); const bad = /不通過|不一致|需修改|卡住/.test(c); const ok = /^(通過|一致|可接受)/.test(c.trim()); return `<h3><span class="badge ${ok ? "ok" : bad ? "bad" : "warn"}">${ok ? "通過" : bad ? "未通過" : "見報告"}</span>${rp.zh}</h3><div class="report">${mdToHtml(c || "（報告無結論段）")}</div>`; }).join("")}
<p class="meta">完整報告：reports/${esc(simId)}/</p>
</section>

<section>
<h2>截圖</h2>
<div class="shots">
${shots.map(f => `<figure><img src="${img(f)}" alt="${esc(f)}"><figcaption>${esc(f.startsWith("scenario") ? scenarioLabel(f) : f === "desktop.png" ? "桌面 1440×900" : f === "ipad-portrait.png" ? "iPad 直向 768×1024" : f === "ipad-landscape.png" ? "iPad 橫向 1024×768" : f)}</figcaption></figure>`).join("")}
</div>
</section>

<section>
<h2>規格「學生應該看見的現象」對照</h2>
<div class="report">${mdToHtml(phenomena || "（規格無此段）")}</div>
<p class="report">核數員在報告第 5 節逐項指出截圖位置。</p>
</section>

<section>
<h2>參數與試試看</h2>
<table><tr><th>參數</th><th>範圍</th><th>預設</th></tr>
${controls.map(c => `<tr><td>${c.symbol ? `<i>${esc(c.symbol)}</i> ` : ""}${esc(c.label.zh)}${c.unit ? ` / ${esc(c.unit)}` : ""}</td><td>${c.kind === "select" || c.kind === "segment" ? esc(c.options.map(o => o.label.zh).join(" / ")) : `${c.min} 至 ${c.max}，步進 ${c.step}`}</td><td>${esc(String(defaults[c.key] ?? c.default))}</td></tr>`).join("")}
</table>
<table><tr><th>迷思</th><th>參數</th><th>會見到</th></tr>
${scenarios.map(s => `<tr><td>「${esc(s.misconception.zh)}」</td><td class="meta">${esc(JSON.stringify(s.params))}</td><td>${esc(s.expect.zh)}</td></tr>`).join("")}
</table>
<h3>假設（畫面固定位置列明）</h3><ul>${manifest.assumptions.map(a => `<li>${esc(a.zh)}</li>`).join("")}</ul>
</section>

<section>
<h2>請老師決定</h2>
<div class="decide">
${decisions.map((d, i) => `<div><b>${i + 1}. ${esc(d.kind)}</b><span>${mdToHtml(d.text)}</span></div>`).join("") || "<p>無</p>"}
</div>
<p class="how" style="margin-top:14px">簽收方式：在對話中回覆「簽收 ${esc(simId)}」，或列出要改的項目編號。簽收後此版本的截圖與逐幀輸出會凍結為基準，狀態轉為 approved；有待定項目未清則只作內部預覽。</p>
</section>
</div>
`;
writeFileSync(join(dir, "review.html"), html);
console.log(`審核面板 → reports/${simId}/review.html（${Math.round(html.length / 1024)} KB，${shots.length} 張截圖，${reports.length} 份報告，${decisions.length} 項待決定）`);
