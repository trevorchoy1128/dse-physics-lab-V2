// 術語表核心：讀取 reference/08_中英術語對照表.csv，提供 term() 查詢與 lint() 掃描
// 規則來源：reference/08_中英術語對照表.md —— 絕對不自行翻譯物理名詞
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSV = join(ROOT, "reference/08_中英術語對照表.csv");
const ALLOW = join(ROOT, "content/term-allow.txt");

// 已知錯誤用詞 → 正確用詞。level: error = 自創（表內完全沒有）；warn = 表內別稱，正文應用「採用」欄
export const DENY = [
  ["建設性干涉", "相長干涉", "error"], ["破壞性干涉", "相消干涉", "error"],
  ["路徑差", "程差", "error"], ["路程差", "程差", "error"], ["光程差", "程差", "warn"],
  ["波前", "波陣面", "error"], ["縫距", "狹縫間距", "error"], ["縫寬", "狹縫闊度", "error"],
  ["麥克風", "微音器", "error"], ["喇叭", "揚聲器", "error"],
  ["司乃耳", "斯涅耳", "error"], ["都卜勒", "多普勒", "error"], ["表觀深度", "視深", "error"],
  ["克卜勒", "開普勒", "error"], ["波耳模型", "玻爾模型", "error"], ["霍爾效應", "霍耳效應", "error"],
  ["弗萊明", "弗林明", "error"], ["氣墊軌道", "氣墊導軌", "error"], ["氣墊軌", "氣墊導軌", "error"],
  ["煙室", "烟霧盒", "error"], ["共振管", "共鳴管", "error"], ["梅爾德", "邁爾德", "error"],
  ["壓強定律", "氣壓定律", "error"], ["穿隧", "隧穿", "error"], ["放射治療", "放射療法", "error"],
  ["鏈式反應", "連鎖反應", "error"], ["衰變系列", "衰變系", "error"], ["奈米", "納米", "error"],
  ["碳定年", "碳 14 年代測定法", "error"], ["音色", "音品", "warn"], ["腹點", "波腹", "error"],
  ["場線", "場力線", "error"], ["內阻", "內電阻", "warn"],
  ["繞射", "衍射", "warn"], ["熱泵", "抽熱機", "warn"], ["火線", "活線", "warn"],
  ["系統誤差", "規律性誤差", "warn"], ["放大率", "放大", "warn"], ["電位差", "電勢差", "warn"],
  ["節點", "波節", "warn"], ["超聲", "超聲波", "warn"],
];

function parseCSVLine(line) {
  const out = []; let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur); return out;
}
const stripParen = s => s.replace(/[（(][^）)]*[）)]/g, "").trim();

let _g;
export function loadGlossary() {
  if (_g) return _g;
  const lines = readFileSync(CSV, "utf8").replace(/^﻿/, "").split(/\r?\n/).slice(1);
  const byEn = new Map();       // english(lower) → {zh, alts, src}
  const zhSet = new Set();      // 採用
  const altSet = new Set();     // 別稱
  for (const l of lines) {
    if (!l.trim()) continue;
    const [en, zh, alt, src] = parseCSVLine(l);
    if (!en || !zh) continue;
    const zhs = stripParen(zh); if (!zhs) continue;
    const alts = (alt || "").split("/").map(stripParen).filter(Boolean);
    byEn.set(en.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " "), { zh: zhs, zhRaw: zh, alts, src });
    zhSet.add(zhs); alts.forEach(a => altSet.add(a));
  }
  const allow = existsSync(ALLOW)
    ? readFileSync(ALLOW, "utf8").split(/\r?\n/).map(s => s.replace(/#.*/, "").trim()).filter(Boolean)
    : [];
  // 「詞頭」：表內存在「修飾語 + 詞頭」形式的術語（如 相長干涉 → 干涉、電子衍射 → 衍射）。只對詞頭做前綴檢查，減少誤報
  const all = [...zhSet, ...altSet];
  const heads = new Set();
  for (const t of all) for (const h of all) if (h !== t && t.endsWith(h) && h.length >= 2 && t.length - h.length <= 3) heads.add(h);
  // 每個已知錯誤詞可能是更長合法詞的子串（如 超聲 ⊂ 超聲波），記下容器詞以免誤報
  const containers = new Map();
  for (const [bad] of DENY) containers.set(bad, all.filter(t => t !== bad && t.includes(bad)));
  _g = { byEn, zhSet, altSet, heads, containers, allow: new Set(allow) };
  return _g;
}

/** 由英文查中譯；查不到即拋錯（不准自己譯） */
export function term(en) {
  const g = loadGlossary();
  const k = en.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
  const hit = g.byEn.get(k) || g.byEn.get(k + "s") || g.byEn.get(k.replace(/s$/, ""));
  if (!hit) throw new Error(`術語表無「${en}」：停下問老師，不得自行翻譯（來源次序：牛津詞彙欄 → 教育局 2020 → 歷屆試卷）`);
  return hit;
}

const CJK = /[一-鿿]/;
const STOP = new Set("的與和及或在之成為種個兩三一二四五六七八九十有無不可對於由把將用作與跟同各每該此其這那些此等某來去上下前後中內外新舊大小高低長短多少同不非");

/** 掃描一段文字，回傳 {level, msg, index} 陣列 */
export function lint(text, { file = "", strict = false } = {}) {
  const g = loadGlossary();
  const issues = [];
  // 1. 已知錯誤用詞
  for (const [bad, good, level] of DENY) {
    let i = -1;
    while ((i = text.indexOf(bad, i + 1)) !== -1) {
      const ctx = text.slice(Math.max(0, i - 1), i + bad.length + 1);
      if (/[（(]/.test(text[i - 1] || "") && /[）)]/.test(text[i + bad.length] || "")) continue; // 括號內的別稱註解，如「熱泵（EDB）」
      if (g.allow.has(bad)) continue;
      // 是更長合法詞的一部分（如「超聲」在「超聲波」內）→ 不是錯
      const inLonger = (g.containers.get(bad) || []).some(c => { const off = c.indexOf(bad); return text.slice(i - off, i - off + c.length) === c; });
      if (inLonger) continue;
      issues.push({ level, index: i, msg: `「${bad}」→ 應用「${good}」`, ctx });
    }
  }
  // 2.（--strict 才啟用）詞頭前面黐住不明修飾語（例：「破壞性」＋「干涉」）。對普通詞（模擬、系統）誤報多，只作人手覆核用
  if (!strict) return issues.sort((a, b) => a.index - b.index);
  const terms = [...g.zhSet, ...g.altSet].filter(t => t.length >= 2 && CJK.test(t)).sort((a, b) => b.length - a.length);
  const covered = new Array(text.length).fill(false);
  const found = [];
  for (const t of terms) {
    let i = -1;
    while ((i = text.indexOf(t, i + 1)) !== -1) {
      let already = false; for (let k = i; k < i + t.length; k++) if (covered[k]) { already = true; break; }
      if (already) continue;
      for (let k = i; k < i + t.length; k++) covered[k] = true;
      if (g.heads.has(t)) found.push([i, t]);
    }
  }
  for (const [i, t] of found) {
    // 前綴：緊貼的 2–3 個 CJK 字，不可含停用字，不可與其他合法術語重疊
    let p = i - 1, pre = "";
    while (p >= 0 && CJK.test(text[p]) && pre.length < 3 && !covered[p]) { pre = text[p] + pre; p--; }
    if (pre.length < 2 || [...pre].some(c => STOP.has(c))) continue;
    const whole = pre + t;
    if (g.zhSet.has(whole) || g.altSet.has(whole) || g.allow.has(whole) || g.allow.has(pre)) continue;
    issues.push({ level: "warn", index: i - pre.length, msg: `「${whole}」：「${pre}」+「${t}」不在術語表；若是自創譯名請改正，若是普通描述請加入 content/term-allow.txt`, ctx: whole });
  }
  return issues.sort((a, b) => a.index - b.index);
}

export function lineOf(text, index) { return text.slice(0, index).split("\n").length; }
