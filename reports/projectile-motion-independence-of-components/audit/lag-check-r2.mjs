// 核數員：3D 視窗 x/y 標籤與右欄讀數是否同一時刻（播放中 vs 暫停）。只讀 DOM 文字，不改任何檔案。
import { chromium } from "playwright";
const url = "http://localhost:5173/#/sim/projectile-motion-independence-of-components";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-HK" });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" }); await page.waitForTimeout(3000);
const grab = async () => page.evaluate(() => {
  const t = document.body.innerText;
  const m = (re) => { const r = t.match(re); return r ? r[1] : null; };
  return { t3d_x: m(/x = ([\d.]+) m/), t3d_y: m(/y = ([\d.]+) m/), t_clock: m(/t = ([\d.]+) s/), ro_t: m(/飛行時間[\s\S]*?([\d.]+) s/), ro_x: m(/水平距離\s*([\d.]+) m/), ro_y: m(/當前高度\s*([\d.]+) m/) };
});
const speed = page.locator(".transport .speed select");
for (const i of [0, 1]) {
  const btn = page.locator(".scenarios > button").nth(i); const label = (await btn.textContent())?.trim();
  await speed.selectOption("0.1"); await btn.click(); await page.waitForTimeout(3000);
  const playing = await grab();
  // 暫停：按含「暫停」的按鈕
  const pauseBtn = page.locator("button", { hasText: "暫停" }); if (await pauseBtn.count()) await pauseBtn.first().click();
  await page.waitForTimeout(600); const paused1 = await grab(); await page.waitForTimeout(1000); const paused2 = await grab();
  console.log(`scenario ${i + 1} ${label}`);
  console.log("  播放中同一次 DOM 讀取:", JSON.stringify(playing));
  console.log("  暫停後 0.6 s:", JSON.stringify(paused1));
  console.log("  暫停後 1.6 s:", JSON.stringify(paused2));
  await speed.selectOption("1");
}
await browser.close();
