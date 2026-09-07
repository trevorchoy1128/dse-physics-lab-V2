// 第 6 輪：量度 0.2.4 截圖箭嘴的水平像素長度（只讀 PNG）。
// 巴士：黑（淨力）、橙（摩擦，以箭嘴自身顏色為樣本，避開車身橙色）、紫（扶手）。
// 不滑時黑 = 橙；握扶手時 紫/橙 = 62.28/117.72 = 0.529、黑/橙 = 180/117.72 = 1.529；滑動時黑 = 橙。
// 雙方塊：上泳道（B）與下泳道（A）綠速度箭嘴長度；太空：灰船綠像素（放寬門檻）。
import { chromium } from "playwright";
import fs from "node:fs";
const SHOTS = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/shots/";
const browser = await chromium.launch();
const page = await browser.newPage();
async function load(file) {
  const b64 = fs.readFileSync(SHOTS + file).toString("base64");
  await page.evaluate(async ({ b64 }) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0); window.__g = g;
  }, { b64 });
}
const px = (x, y) => page.evaluate(({ x, y }) => Array.from(window.__g.getImageData(x, y, 1, 1).data).slice(0, 3), { x, y });
// 在 region 內逐列找「與樣本色距離 < tol」像素的最闊延伸列
const extent = (region, sample, tol) => page.evaluate(({ region, sample, tol }) => {
  const [X0, Y0, W, H] = region; const d = window.__g.getImageData(X0, Y0, W, H).data;
  let best = { n: 0, y: -1, first: -1, last: -1 }, total = 0;
  for (let y = 0; y < H; y++) {
    let n = 0, first = -1, last = -1;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; const dr = d[i] - sample[0], dg = d[i + 1] - sample[1], db = d[i + 2] - sample[2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) < tol) { n++; total++; if (first < 0) first = x; last = x; }
    }
    if (n > best.n) best = { n, y: Y0 + y, first: X0 + first, last: X0 + last };
  }
  return { ...best, extent: best.n ? best.last - best.first + 1 : 0, total };
}, { region, sample, tol });
const fmt = (tag, r) => `${tag}: y=${r.y} x=${r.first}–${r.last} 延伸=${r.extent} px（區內 ${r.total} px）`;

// ---- 巴士：先取樣顏色 ----
await load("extra-bus-start.png");
const body = await px(100, 350), floorArrow = await px(700, 382), netArrow = await px(650, 356);
console.log("樣本色 車身=" + body + " 摩擦箭嘴=" + floorArrow + " 淨力箭嘴=" + netArrow);
for (const f of ["extra-bus-start-mu04.png", "extra-bus-start.png", "extra-bus-brake.png", "extra-bus-brake-handrail.png"]) {
  await load(f);
  const bk = await extent([400, 340, 500, 30], [0, 0, 0], 90);
  const or = await extent([400, 372, 500, 20], floorArrow, 40);
  const pu = await extent([400, 315, 500, 22], [150, 60, 210], 90);
  const pcol = await px(700, 326);
  console.log(f.padEnd(32), fmt("黑淨力", bk), "|", fmt("橙摩擦", or), "|", fmt("紫扶手", pu), "紫樣本@(700,326)=" + pcol, "| 黑/橙=" + (bk.extent / or.extent).toFixed(3), "紫/橙=" + (pu.extent / or.extent).toFixed(3));
}
// ---- 雙方塊綠箭嘴 ----
await load("extra-two-blocks-released.png");
const green = await px(590, 312);
console.log("綠樣本@(590,312)=" + green);
console.log("two-blocks 上泳道 B:", fmt("綠", await extent([480, 115, 200, 40], green, 60)));
console.log("two-blocks 下泳道 A:", fmt("綠", await extent([480, 295, 200, 40], green, 60)));
// ---- 太空灰船綠像素（放寬：g 比 r、b 都高 25 以上且 g > 70）----
const loose = (region) => page.evaluate(({ region }) => {
  const [X0, Y0, W, H] = region; const d = window.__g.getImageData(X0, Y0, W, H).data; let n = 0, xs = [], ys = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const r = d[i], g = d[i + 1], b = d[i + 2]; if (g > 70 && g - r > 25 && g - b > 25) { n++; xs.push(X0 + x); ys.push(Y0 + y); } }
  return { n, x: n ? [Math.min(...xs), Math.max(...xs)] : null, y: n ? [Math.min(...ys), Math.max(...ys)] : null };
}, { region });
for (const f of ["extra-space-engine-on.png", "extra-space-engine-off.png"]) {
  await load(f);
  console.log(f, "灰船周圍 [400,360,320,130] 綠像素:", JSON.stringify(await loose([400, 360, 320, 130])), "| 主船周圍 [480,230,300,60]:", JSON.stringify(await loose([480, 230, 300, 60])));
}
await load("scenario-3-end.png");
console.log("scenario-3-end 灰船周圍 [250,480,300,60] 綠像素:", JSON.stringify(await loose([250, 480, 300, 60])), "| 主船周圍 [480,400,200,60]:", JSON.stringify(await loose([480, 400, 200, 60])));
await browser.close();
