// 第 6 輪：逐列列出箭嘴顏色的連續段（run），把箭桿與標籤文字分開。只讀 PNG。
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
// 每列：符合 test 的像素分成 run（間隔 > 2 px 即斷開），回傳長度 ≥ 3 的 run
const runs = (region, testName) => page.evaluate(({ region, testName }) => {
  const tests = {
    black: (r, g, b) => r < 60 && g < 60 && b < 60,
    orangeArrow: (r, g, b) => r > 200 && g > 100 && g < 150 && b < 30,   // 摩擦箭嘴 247,127,0；車身 245,166,35 排除
    orangeStrict: (r, g, b) => Math.abs(r - 232) < 25 && Math.abs(g - 131) < 25 && b < 60, // 待定：先印出樣本
    purple: (r, g, b) => r > 90 && r < 170 && g < 90 && b > 150,
    green: (r, g, b) => g > 110 && r < 90 && b < 120 && g - r > 70,
  };
  const t = tests[testName];
  const [X0, Y0, W, H] = region; const d = window.__g.getImageData(X0, Y0, W, H).data; const out = [];
  for (let y = 0; y < H; y++) {
    const rr = []; let cur = null;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (t(d[i], d[i + 1], d[i + 2])) { if (cur && x - cur.last <= 2) cur.last = x; else { cur = { first: x, last: x }; rr.push(cur); } }
    }
    const big = rr.filter(r => r.last - r.first + 1 >= 3).map(r => [X0 + r.first, X0 + r.last, r.last - r.first + 1]);
    if (big.length) out.push({ y: Y0 + y, runs: big });
  }
  return out;
}, { region, testName });
const col = (x, y0, y1) => page.evaluate(({ x, y0, y1 }) => { const o = []; for (let y = y0; y <= y1; y++) { const d = window.__g.getImageData(x, y, 1, 1).data; o.push(y + ":" + d[0] + "," + d[1] + "," + d[2]); } return o.join(" "); }, { x, y0, y1 });
const widest = (rs) => rs.reduce((a, row) => { for (const r of row.runs) if (r[2] > a.len) a = { y: row.y, x0: r[0], x1: r[1], len: r[2] }; return a; }, { len: 0 });

// 巴士：先看摩擦箭嘴所在列的顏色（extra-bus-start 箭嘴在 x≈615–690, y≈378–386）
await load("extra-bus-start.png");
console.log("extra-bus-start 直行 x=650 y=374–392:", await col(650, 374, 392));
for (const f of ["extra-bus-start-mu04.png", "extra-bus-start.png", "extra-bus-brake.png", "extra-bus-brake-handrail.png"]) {
  await load(f);
  const bk = widest(await runs([400, 345, 500, 22], "black"));
  const or = widest(await runs([400, 374, 500, 16], "orangeArrow"));
  const pu = widest(await runs([400, 318, 500, 16], "purple"));
  console.log(f.padEnd(30), `黑 y=${bk.y} x=${bk.x0}–${bk.x1} 長=${bk.len}`, `| 橙 y=${or.y} x=${or.x0}–${or.x1} 長=${or.len}`, `| 紫 y=${pu.y} x=${pu.x0}–${pu.x1} 長=${pu.len}`, `| 黑/橙=${(bk.len / or.len).toFixed(3)} 紫/橙=${(pu.len / or.len).toFixed(3)}`);
}
// 雙方塊：綠 run（箭桿列最闊 run；標籤 v 為另一個 run）
await load("extra-two-blocks-released.png");
for (const [tag, region] of [["上泳道 B", [480, 118, 200, 26]], ["下泳道 A", [480, 300, 200, 26]]]) {
  const rs = await runs(region, "green");
  console.log("two-blocks " + tag + " 綠 run 逐列:", JSON.stringify(rs));
}
// scenario-8-early（施力中，0.314 s）：v_A = 1.57、v_B = 0.314
await load("scenario-8-early.png");
for (const [tag, region] of [["上泳道 B", [500, 278, 200, 24]], ["下泳道 A", [500, 428, 200, 24]]]) {
  const rs = await runs(region, "green");
  console.log("scenario-8-early " + tag + " 綠 run 逐列:", JSON.stringify(rs));
}
await browser.close();
