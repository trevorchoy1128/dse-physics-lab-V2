// 核數員：1× 播放中 3D 標籤 vs 讀數（連續三次 DOM 讀取，各隔 300 ms）+ 播放中截圖
import { chromium } from "playwright";
const url = "http://localhost:5173/#/sim/projectile-motion-independence-of-components";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-HK" });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" }); await page.waitForTimeout(3000);
const grab = async () => page.evaluate(() => {
  const t = document.body.innerText; const m = (re) => { const r = t.match(re); return r ? r[1] : null; };
  return { t3d_x: m(/x = ([\d.]+) m/), t3d_y: m(/y = ([\d.]+) m/), t_clock: m(/t = ([\d.]+) s/), ro_x: m(/水平距離\s*([\d.]+) m/), ro_y: m(/當前高度\s*([\d.]+) m/), now: performance.now() };
});
const speed = page.locator(".transport .speed select"); await speed.selectOption("1");
const replay = page.locator("button", { hasText: "重播" }); await replay.first().click();
await page.waitForTimeout(700);
for (let i = 0; i < 4; i++) { const g = await grab(); console.log(`1× 播放中 #${i}:`, JSON.stringify(g), "→ 3D 標籤對應 t=", (g.t3d_x / 11.4907).toFixed(3), "s；讀數 t=", g.t_clock); await page.waitForTimeout(300); }
await page.screenshot({ path: "C:/Users/trevor/dev/dse-physics-lab/reports/projectile-motion-independence-of-components/audit/r2-playing-1x.png", clip: { x: 0, y: 250, width: 1060, height: 450 } });
const g = await grab(); console.log("截圖同刻:", JSON.stringify(g));
await browser.close();
