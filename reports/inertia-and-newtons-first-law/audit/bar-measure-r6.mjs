// 第 6 輪：量度 0.2.4 桌布截圖衝量條（條高改 22 px、深色外框、條內右側寫「J = … N s」）。
// 方法改動：框寬取「暗像素橫跨最闊」的一列（框頂邊）；填色寬取各列橙色 first–last 最大延伸（避開條內文字列）。只讀 PNG，不碰模擬檔案。
import { chromium } from "playwright";
import fs from "node:fs";
const ROOT = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/";
const SHOTS = ROOT + "shots/";
const targets = [
  { file: "scenario-10-end.png", y0: 285, tag: "v5 (J=0.119)", J: 0.11913937 },
  { file: "extra-cloth-t0.png", y0: 115, tag: "t=0 (J=0)", J: 0 },
  { file: "extra-cloth-t0.04.png", y0: 115, tag: "t=0.04 (J=0.0589)", J: 0.05886 },
  { file: "extra-cloth-v10.png", y0: 115, tag: "v10 (J=0.0590)", J: 0.05903430 },
  { file: "extra-cloth-v1-stuck.png", y0: 115, tag: "v1 stuck (J=1)", J: 1.0 },
];
const Jmax = 1 * Math.sqrt(2 * 0.15 * 9.81 * 0.4); // m√(2 μ布 g L)，我算
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
      let n = 0, first = -1, last = -1, dark = 0, dFirst = -1, dLast = -1;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4; const r = d[i], gg = d[i + 1], b = d[i + 2];
        const isOr = r > 200 && gg > 90 && gg < 200 && b < 120;
        if (isOr) { n++; if (first < 0) first = x; last = x; }
        if (r + gg + b < 450 && !isOr) { dark++; if (dFirst < 0) dFirst = x; dLast = x; }
      }
      rows.push({ y: y0 + y, orange: n, first: first < 0 ? -1 : first + X0, last: last < 0 ? -1 : last + X0, extent: n ? last - first + 1 : 0, dark, dFirst: dFirst < 0 ? -1 : dFirst + X0, dLast: dLast < 0 ? -1 : dLast + X0 });
    }
    const frame = rows.reduce((a, r) => (r.dark > a.dark ? r : a), rows[0]);     // 框頂邊（暗像素最多的一列）
    const frameRows = rows.filter(r => r.dark >= frame.dark - 4);                 // 頂邊與底邊
    const fill = rows.reduce((a, r) => (r.extent > a.extent ? r : a), rows[0]);   // 填色最闊延伸列
    const fillRows = rows.filter(r => r.orange > 0).map(r => r.y);
    return { frame, frameTop: frameRows[0]?.y, frameBottom: frameRows[frameRows.length - 1]?.y, fill, fillRows: [fillRows[0], fillRows[fillRows.length - 1]], imgW: img.width, imgH: img.height };
  }, { b64, y0: t.y0, X0, W, H });
  const inner = res.frame.dLast - res.frame.dFirst - 1;
  const fillPx = res.fill.extent;
  const ratio = fillPx / inner, expect = t.J / Jmax;
  const barH = res.frameBottom - res.frameTop + 1;
  out.push({ file: t.file, fillPx, fillCount: res.fill.orange, fillX: [res.fill.first, res.fill.last], fillY: res.fill.y, fillRows: res.fillRows, frameX: [res.frame.dFirst, res.frame.dLast], frameY: res.frame.y, frameTop: res.frameTop, frameBottom: res.frameBottom, barH, inner, ratio, expect, expectPx: expect * inner, diffPx: fillPx - expect * inner, imgW: res.imgW });
  console.log(t.tag.padEnd(20), "圖寬=" + res.imgW, "| 框 x=" + res.frame.dFirst + "–" + res.frame.dLast, "y=" + res.frameTop + "–" + res.frameBottom, "高=" + barH, "內寬=" + inner, "| 填色延伸 px=" + fillPx, "(該列橙像素 " + res.fill.orange + ") x=" + res.fill.first + "–" + res.fill.last, "@y=" + res.fill.y, "填色列 y=" + res.fillRows.join("–"), "| 比=" + ratio.toFixed(4), "預期 J/Jmax=" + expect.toFixed(4), "預期 px=" + (expect * inner).toFixed(1), "差=" + (fillPx - expect * inner).toFixed(1) + " px");
}
console.log("Jmax(我算)=" + Jmax);
const v5 = out.find(o => o.file === "scenario-10-end.png"), v10 = out.find(o => o.file === "extra-cloth-v10.png");
console.log("v5 : v10 填色比 = " + v5.fillPx + " : " + v10.fillPx + " = " + (v5.fillPx / v10.fillPx).toFixed(3) + "（Δv 比 0.1191394/0.0590343 = " + (0.11913937 / 0.0590343).toFixed(3) + "）");
fs.writeFileSync(ROOT + "audit/bar-measure-r6.json", JSON.stringify(out, null, 1));
await browser.close();
