// 核數員 第 3 輪：3D 自動取景是否可重現。流程 A：新載入 → 按情境 1 → 播放中 3 s 截圖；流程 B：新載入 → 按情境 1 → 暫停 → 跳到 0.6 s 截圖；流程 C：新載入（預設）→ 3 s 截圖。
import { chromium } from "playwright";
const url = "http://localhost:5173/#/sim/projectile-motion-independence-of-components";
const browser = await chromium.launch();
const OUT = "C:/Users/trevor/dev/dse-physics-lab/reports/projectile-motion-independence-of-components/audit/";
const fresh = async () => { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-HK" }); const page = await ctx.newPage(); await page.goto(url, { waitUntil: "networkidle" }); await page.waitForTimeout(2500); return page; };
const shot = async (page, name) => { const b = await page.locator("canvas").first().boundingBox(); await page.screenshot({ path: OUT + name, clip: { x: b.x, y: b.y, width: b.width, height: b.height } }); console.log(name, JSON.stringify(b)); };
{ const page = await fresh(); await page.locator(".transport .speed select").selectOption("0.1"); await page.locator(".scenarios > button").nth(0).click(); await page.waitForTimeout(3000); await shot(page, "r3-framing-A-s1-playing.png"); await page.context().close(); }
{ const page = await fresh(); await page.locator(".scenarios > button").nth(0).click(); await page.waitForTimeout(800); const p = page.locator("button", { hasText: "暫停" }); if (await p.count()) await p.first().click(); const j = page.locator('.transport input[type="number"]').first(); await j.fill(""); await j.type("0.6"); await j.press("Enter"); await page.waitForTimeout(1500); await shot(page, "r3-framing-B-s1-jump06.png"); await page.context().close(); }
{ const page = await fresh(); await page.locator(".scenarios > button").nth(0).click(); await page.waitForTimeout(6000); await shot(page, "r3-framing-D-s1-playing-6s.png"); await page.context().close(); }
{ const page = await fresh(); await page.waitForTimeout(1000); await shot(page, "r3-framing-C-default.png"); await page.context().close(); }
await browser.close();
