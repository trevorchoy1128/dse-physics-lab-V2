// 第 7 輪：全寬掃描 scenario-9-end.png（全頁圖）y 280–360 的橙色填色與深色框列，找衝量條位置。
import { chromium } from "playwright";
import fs from "node:fs";
const ROOT = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/";
const browser = await chromium.launch(); const page = await browser.newPage();
const b64 = fs.readFileSync(ROOT + "shots/scenario-9-end.png").toString("base64");
const rows = await page.evaluate(async ({ b64 }) => {
  const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const Y0 = 280, H = 80, W = img.width; const d = g.getImageData(0, Y0, W, H).data; const out = [];
  for (let y = 0; y < H; y++) { let first = -1, last = -1, n = 0, dFirst = -1, dLast = -1, dark = 0;
    for (let x = 0; x < 700; x++) { const i = (y * W + x) * 4; const r = d[i], gg = d[i + 1], b = d[i + 2];
      if (r > 200 && gg > 90 && gg < 200 && b < 120) { n++; if (first < 0) first = x; last = x; }
      if (r < 110 && gg < 110 && b < 110) { dark++; if (dFirst < 0) dFirst = x; dLast = x; } }
    out.push({ y: Y0 + y, n, first, last, dark, dFirst, dLast }); }
  return out;
}, { b64 });
await browser.close();
const fill = rows.filter(r => r.n > 0); const frame = rows.filter(r => r.dark > 300);
console.log("fill rows:", fill.length ? `${fill[0].y}–${fill.at(-1).y}` : "none", "max fill width", Math.max(0, ...fill.map(r => r.last - r.first + 1)), fill.length ? JSON.stringify([...fill].sort((a, b) => (b.last - b.first) - (a.last - a.first))[0]) : "");
console.log("frame rows:", frame.map(r => `${r.y}:${r.dFirst}-${r.dLast}`).join(" "));
