// 第 7 輪：量度 v0.4.0 桌布截圖的衝量條（滿格 = 剛好抽不出時的衝量 m·√(2 f布 L/m) = √(2·1.5·0.4·1) = 1.0954 N s）。
// 方法沿第 6 輪：框寬取暗像素橫跨最闊的一列；填色寬取各列橙色 first–last 最大延伸。只讀 PNG，不碰模擬檔案。
import { chromium } from "playwright";
import fs from "node:fs";
const ROOT = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/";
const SHOTS = ROOT + "shots/";
const Jmax = Math.sqrt(2 * 1.5 * 0.4 * 1);
const targets = [
  { file: "scenario-10-end.png", y0: 285, tag: "v5 (J=0.121)", J: 0.12147563 },
  { file: "extra-cloth-t0.png", y0: 115, tag: "t=0 (J=0)", J: 0 },
  { file: "extra-cloth-t0.04.png", y0: 115, tag: "t=0.04 (J=0.0600)", J: 0.06 },
  { file: "extra-cloth-v10.png", y0: 115, tag: "v10 (J=0.0602)", J: 0.06018109 },
  { file: "extra-cloth-v1-stuck.png", y0: 115, tag: "v1 stuck (J=1)", J: 1.0 },
];
const X0 = 15, W = 640, H = 70;
const browser = await chromium.launch();
const page = await browser.newPage();
const out = [];
for (const t of targets) {
  const b64 = fs.readFileSync(SHOTS + t.file).toString("base64");
  const res = await page.evaluate(async ({ b64, y0, X0, W, H }) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(X0, y0, W, H).data; const rows = [];
    for (let y = 0; y < H; y++) {
      let first = -1, last = -1, dFirst = -1, dLast = -1, dark = 0, n = 0;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4; const r = d[i], gg = d[i + 1], b = d[i + 2];
        const isOr = r > 200 && gg > 90 && gg < 200 && b < 120;
        const isDark = r < 110 && gg < 110 && b < 110;
        if (isOr) { n++; if (first < 0) first = x; last = x; }
        if (isDark) { dark++; if (dFirst < 0) dFirst = x; dLast = x; }
      }
      rows.push({ y: y0 + y, n, first, last, dark, dFirst, dLast });
    }
    return rows;
  }, { b64, y0: t.y0, X0, W, H });
  const frame = res.filter(r => r.dark > 300).sort((a, b) => (b.dLast - b.dFirst) - (a.dLast - a.dFirst))[0];
  const fill = res.filter(r => r.n > 0).sort((a, b) => (b.last - b.first) - (a.last - a.first))[0];
  const frameW = frame ? frame.dLast - frame.dFirst + 1 : null;
  const fillW = fill ? fill.last - fill.first + 1 : 0;
  const fillRows = res.filter(r => r.n > 0).map(r => r.y);
  out.push({ file: t.file, tag: t.tag, frameRow: frame && { y: frame.y, x: [X0 + frame.dFirst, X0 + frame.dLast], w: frameW }, fill: fill && { y: fill.y, x: [X0 + fill.first, X0 + fill.last], w: fillW }, fillRows: fillRows.length ? [fillRows[0], fillRows.at(-1)] : null, expectedFrac: t.J / Jmax, measuredFrac: frameW ? fillW / (frameW - 2) : null });
}
await browser.close();
for (const o of out) console.log(JSON.stringify(o));
fs.writeFileSync(ROOT + "audit/r7-bar-measure.json", JSON.stringify({ Jmax, out }, null, 1));
