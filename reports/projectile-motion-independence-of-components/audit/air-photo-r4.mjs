// 第 4 輪：瀏覽器實測（a）空氣阻力開啟的畫面與讀數（b）頻閃照片模式（c）小質量 + 阻力：時間窗（拉桿上限 meta.tf）短於落地時刻時，播放是否停在半空
import { chromium } from "playwright";
const url = "http://localhost:5173/#/sim/projectile-motion-independence-of-components";
const OUT = "C:/Users/trevor/dev/dse-physics-lab/reports/projectile-motion-independence-of-components/audit/";
const browser = await chromium.launch();
const fresh = async () => { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-HK" }); const page = await ctx.newPage(); await page.goto(url, { waitUntil: "networkidle" }); await page.waitForTimeout(2500); return page; };
const setRange = async (page, id, v) => { await page.locator("#" + id).evaluate((el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, v); await page.waitForTimeout(300); };
const readouts = async (page) => { const t = await page.locator("aside.panel").innerText(); const i = t.indexOf("讀數"); const j = t.indexOf("試試看"); return t.slice(i, j > i ? j : undefined).replace(/\s+/g, " "); };
const transport = async (page) => { const r = page.locator(".transport input[type=range]"); return { max: await r.getAttribute("max"), val: await r.inputValue(), t: (await page.locator(".transport").innerText()).replace(/\s+/g, " ").slice(-40) }; };
const pause = async (page) => { const p = page.locator("button", { hasText: "暫停" }); if (await p.count()) await p.first().click(); };
const play = async (page) => { const p = page.locator("button", { hasText: "播放" }); if (await p.count()) await p.first().click(); };
const jump = async (page, t) => { const j = page.locator(".transport input[type=number]").first(); await j.fill(String(t)); await j.press("Enter"); await page.waitForTimeout(600); };

// (a) 預設 + 空氣阻力：早期（0.1×）與末端
{ const page = await fresh(); await pause(page); await page.locator("#ctl-air").check(); await page.waitForTimeout(500);
  console.log("[a] air on, transport:", JSON.stringify(await transport(page)));
  await jump(page, 0.4); await page.screenshot({ path: OUT + "r4-air-default-t0.4.png", fullPage: true }); console.log("[a] t=0.4 readouts:", await readouts(page));
  await jump(page, 0.9); console.log("[a] t=0.9 readouts:", await readouts(page));
  await jump(page, 3.2); await page.waitForTimeout(800); await page.screenshot({ path: OUT + "r4-air-default-end.png", fullPage: true }); console.log("[a] end readouts:", await readouts(page), "| transport", JSON.stringify(await transport(page)));
  await page.context().close(); }
// (b) 頻閃照片模式
{ const page = await fresh(); await page.getByLabel("頻閃照片模式", { exact: false }).check(); await page.waitForTimeout(800); await page.screenshot({ path: OUT + "r4-photo-default-end.png", fullPage: true }); console.log("[b] photo mode screenshot; readouts:", await readouts(page)); await page.context().close(); }
// (c) m=0.1、u=50、θ=45、h=50、空氣阻力：解析落地 19.23 s；meta.tf 12.93 s
{ const page = await fresh(); await pause(page); await setRange(page, "ctl-u", 50); await setRange(page, "ctl-theta", 45); await setRange(page, "ctl-h", 50); await setRange(page, "ctl-m", 0.1); await page.locator("#ctl-air").check(); await page.waitForTimeout(500);
  console.log("[c] params set; transport:", JSON.stringify(await transport(page)));
  await jump(page, 12.9); console.log("[c] jump 12.9 readouts:", await readouts(page), "| transport", JSON.stringify(await transport(page)));
  await page.screenshot({ path: OUT + "r4-m0.1-air-t12.9.png", fullPage: true });
  await jump(page, 19.3); console.log("[c] jump 19.3 readouts:", await readouts(page), "| transport", JSON.stringify(await transport(page)));
  await page.locator(".transport .speed select").selectOption("2"); await jump(page, 12.5); await play(page); await page.waitForTimeout(6000); await pause(page);
  console.log("[c] played 2x from 12.5 s for 6 s real:", await readouts(page), "| transport", JSON.stringify(await transport(page)));
  await page.screenshot({ path: OUT + "r4-m0.1-air-after-play.png", fullPage: true });
  await page.context().close(); }
// (d) m=0.1 + 阻力 + 預設 u/θ/h：落地 1.289 s；落地後讀數
{ const page = await fresh(); await pause(page); await setRange(page, "ctl-m", 0.1); await page.locator("#ctl-air").check(); await page.waitForTimeout(400); await jump(page, 3.2); await page.waitForTimeout(600); console.log("[d] m=0.1 air end readouts:", await readouts(page), "| transport", JSON.stringify(await transport(page))); await page.screenshot({ path: OUT + "r4-m0.1-air-default-end.png", fullPage: true }); await page.context().close(); }
// (e) 情境 1 早期 3D：藍球是否可見（t = 0.3 s）
{ const page = await fresh(); await page.locator(".scenarios > button").nth(0).click(); await page.waitForTimeout(800); await pause(page); await jump(page, 0.3); await page.waitForTimeout(800); const b = await page.locator("canvas").first().boundingBox(); await page.screenshot({ path: OUT + "r4-s1-t0.3-3d.png", clip: { x: b.x, y: b.y, width: b.width, height: b.height } }); console.log("[e] s1 t=0.3 3D crop", JSON.stringify(b), await readouts(page)); await page.context().close(); }
await browser.close();
