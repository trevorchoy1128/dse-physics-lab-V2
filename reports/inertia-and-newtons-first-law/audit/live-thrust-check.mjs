// 老師 2026-09-08：調推力時飛船閃動、大小不固定。核實：改 F引擎 不重設運行（t 續走），飛船像素大小不變
import { chromium } from "playwright";
const url = process.argv[2] ?? "http://localhost:5175/#/sim/inertia-and-newtons-first-law";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "太空中的飛船" }).click(); await page.waitForTimeout(800);
const tOf = async () => page.evaluate(() => document.querySelector(".readouts tr td")?.innerText);
const shipWidth = async () => page.evaluate(() => {   // 量琥珀色飛船在畫布上的橫向像素數（掃描中線附近）
  const c = document.querySelector(".stage-canvas canvas"); const ctx = c.getContext("2d"); const w = c.width, h = c.height;
  const d = ctx.getImageData(0, 0, w, Math.round(h * 0.56)).data; let minX = 1e9, maxX = -1; const rows = new Map();
  for (let y = 0; y < Math.round(h * 0.56); y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (Math.abs(d[i] - 0xf5) < 12 && Math.abs(d[i + 1] - 0xa6) < 12 && Math.abs(d[i + 2] - 0x23) < 12) { if (x < minX) minX = x; if (x > maxX) maxX = x; rows.set(y, (rows.get(y) ?? 0) + 1); } }
  return { span: maxX - minX, amberPixels: [...rows.values()].reduce((a, b) => a + b, 0) };   // 箭嘴會蓋住中線一行，改看總像素與整體跨度
});
const setFe = async v => { const el = page.getByLabel("引擎推力（可隨時改）").last(); await el.fill(String(v)); await el.dispatchEvent("input"); await el.dispatchEvent("change"); };
const t0 = await tOf(); const w0 = await shipWidth();
await setFe(3); await page.waitForTimeout(500); const t1 = await tOf(); const w1 = await shipWidth();
await setFe(1); await page.waitForTimeout(500); const t2 = await tOf(); const w2 = await shipWidth();
await setFe(5); await page.waitForTimeout(500); const t3 = await tOf(); const w3 = await shipWidth();
console.log(JSON.stringify({ t: [t0, t1, t2, t3], shipWidthPx: [w0, w1, w2, w3] }));
await browser.close();
