// 第 5 輪：量度 0.2.3 桌布截圖衝量條的填色寬度（像素）與條框內寬，算像素比。條闊已由 260 px 改為畫面一半，掃描區加闊至 620 px。只讀 PNG，不碰模擬檔案。
import { chromium } from "playwright";
import fs from "node:fs";
const SHOTS = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/shots/";
const targets = [
  { file: "scenario-10-end.png", y0: 285, tag: "v5 (J=0.119)", J: 0.11913937 },
  { file: "extra-cloth-t0.04.png", y0: 115, tag: "t=0.04 (J=0.0589)", J: 0.05886 },
  { file: "extra-cloth-v10.png", y0: 115, tag: "v10 (J=0.0590)", J: 0.05903430 },
  { file: "extra-cloth-v1-stuck.png", y0: 115, tag: "v1 stuck (J=1)", J: 1.0 },
];
const Jmax = 1 * Math.sqrt(2 * 0.15 * 9.81 * 0.4); // m√(2 μ布 g L)，我算
const X0 = 20, W = 620, H = 60;
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
        if (r > 200 && gg > 90 && gg < 200 && b < 120) { n++; if (first < 0) first = x; last = x; }
        if (r + gg + b < 690 && !(r > 200 && gg > 90 && gg < 200 && b < 120)) { dark++; if (dFirst < 0) dFirst = x; dLast = x; }
      }
      rows.push({ y: y0 + y, orange: n, first: first + X0, last: last + X0, dark, dFirst: dFirst + X0, dLast: dLast + X0 });
    }
    const best = rows.reduce((a, r) => (r.orange > a.orange ? r : a), rows[0]);
    // 條框：在填色那一行往上找第一條「暗像素橫跨最闊」的列（框頂邊），取其左右端
    const frame = rows.find(r => r.y === best.y);
    // 框左右豎邊：在填色列上，最左暗像素與最右暗像素
    const fillRow = rows.find(r => r.y === best.y);
    return { best, frame, fillRow, imgW: img.width, imgH: img.height };
  }, { b64, y0: t.y0, X0, W, H });
  const inner = res.frame.dLast - res.frame.dFirst - 1; // 框頂邊兩端之間（含邊線像素各 1）
  const fillPx = res.best.orange;
  const ratio = fillPx / inner, expect = t.J / Jmax;
  out.push({ file: t.file, fillPx, fillX: [res.best.first, res.best.last], fillY: res.best.y, frameX: [res.frame.dFirst, res.frame.dLast], frameY: res.frame.y, frameDarkCount: res.frame.dark, inner, ratio, expect, expectPx: expect * inner, imgW: res.imgW });
  console.log(t.tag.padEnd(22), "圖寬=" + res.imgW, "填色 px=" + fillPx, "x=" + res.best.first + "–" + res.best.last, "@y=" + res.best.y, "| 框（填色列非白非橙）x=" + res.frame.dFirst + "–" + res.frame.dLast, "@y=" + res.frame.y, "內寬=" + inner, "| 比=" + ratio.toFixed(4), "預期 J/Jmax=" + expect.toFixed(4), "預期 px=" + (expect * inner).toFixed(1));
}
console.log("Jmax(我算)=" + Jmax);
console.log("v5 : v10 填色比 = " + out[0].fillPx + " : " + out[2].fillPx + " = " + (out[0].fillPx / out[2].fillPx).toFixed(3));
fs.writeFileSync("C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/audit/bar-measure-r5.json", JSON.stringify(out, null, 1));
await browser.close();
