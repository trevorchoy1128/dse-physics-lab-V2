// 核數員 第 3 輪：情境 1（h 20, drop）3D 視窗內自由下落的藍球何時可見——跳到 t = 0.3 / 0.6 / 1.0 s 截圖 3D 區域。只讀畫面，不改檔案。
import { chromium } from "playwright";
const url = "http://localhost:5173/#/sim/projectile-motion-independence-of-components";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-HK" });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" }); await page.waitForTimeout(3000);
await page.locator(".scenarios > button").nth(0).click(); await page.waitForTimeout(800);
const pauseBtn = page.locator("button", { hasText: "暫停" }); if (await pauseBtn.count()) await pauseBtn.first().click();
const inputs = page.locator(".transport input"); const n = await inputs.count(); const types = []; for (let i = 0; i < n; i++) types.push(await inputs.nth(i).getAttribute("type"));
console.log("transport inputs:", types);
const jump = page.locator('.transport input[type="number"], .transport input[type="text"]').first();
const canvasBox = await page.locator("canvas").first().boundingBox(); console.log("canvas box", JSON.stringify(canvasBox));
for (const t of ["0.3", "0.6", "1.0", "1.5"]) {
  await jump.fill(""); await jump.type(t); await jump.press("Enter"); await page.waitForTimeout(900);
  const txt = await page.evaluate(() => { const t = document.body.innerText; const m = (re) => { const r = t.match(re); return r ? r[1] : null; }; return { clock: m(/t = ([\d.]+) s/), ry: m(/當前高度\s*([\d.]+) m/), ry2: m(/第二顆球高度\s*([\d.]+) m/) }; });
  console.log("t =", t, JSON.stringify(txt));
  await page.screenshot({ path: `C:/Users/trevor/dev/dse-physics-lab/reports/projectile-motion-independence-of-components/audit/r3-s1-t${t}.png`, clip: { x: canvasBox.x, y: canvasBox.y, width: canvasBox.width, height: canvasBox.height } });
}
await browser.close();
