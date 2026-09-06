// 第 5 輪：瀏覽器實測（a）無阻力時 ½mvₓ² 參考線仍在（b）有阻力時參考線消失、拉桿盡頭已落地（c）m = 0.1 + 阻力 + u 50 / h 50：拉桿上限 = 落地 + 0.3、拉到盡頭 y = 0
//（d）θ = −30、drop 第二顆球、m 0.1：拉桿上限以較遲落地的一顆為準（e）u 50、θ 90、h 50、g 1.6、m 0.1：拉桿上限 125.6 s
import { chromium } from "playwright";
const url = "http://localhost:5173/#/sim/projectile-motion-independence-of-components";
const OUT = "C:/Users/trevor/dev/dse-physics-lab/reports/projectile-motion-independence-of-components/audit/";
const browser = await chromium.launch();
const fresh = async () => { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-HK" }); const page = await ctx.newPage(); await page.goto(url, { waitUntil: "networkidle" }); await page.waitForTimeout(2500); return page; };
const setRange = async (page, id, v) => { await page.locator("#" + id).evaluate((el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, v); await page.waitForTimeout(300); };
const readouts = async (page) => { const t = await page.locator("aside.panel").innerText(); const i = t.indexOf("讀數"); const j = t.indexOf("試試看"); return t.slice(i, j > i ? j : undefined).replace(/\s+/g, " "); };
const transport = async (page) => { const r = page.locator(".transport input[type=range]"); return { max: await r.getAttribute("max"), val: await r.inputValue(), t: (await page.locator(".transport").innerText()).replace(/\s+/g, " ").slice(-40) }; };
const pause = async (page) => { const p = page.locator("button", { hasText: "暫停" }); if (await p.count()) await p.first().click(); };
const jump = async (page, t) => { const j = page.locator(".transport input[type=number]").first(); await j.fill(String(t)); await j.press("Enter"); await page.waitForTimeout(600); };
const refLine = async (page) => page.evaluate(() => { const all = [...document.querySelectorAll("svg text, svg tspan, .chart *, canvas + *")]; const hits = all.filter((e) => /½\s*m\s*v/.test(e.textContent || "") && e.children.length === 0).map((e) => (e.textContent || "").trim()); const body = document.body.innerText; return { svgTextHits: hits, bodyHasHalfMvx: /½mv/.test(body), bodyMatches: (body.match(/½mv[^\n]{0,20}/g) || []) }; });
const chartBox = async (page) => { const cs = await page.locator(".charts, .projections, section").all(); return null; };
const shotChart = async (page, name) => { await page.screenshot({ path: OUT + name, fullPage: true }); };
const setCompanion = async (page, label) => { await page.getByRole("button", { name: label, exact: true }).first().click(); await page.waitForTimeout(300); };

// (a) 預設（無阻力）：參考線在；拉桿上限 = 1.9657 + 0.3
{ const page = await fresh(); await pause(page); await jump(page, 3); console.log("[a] no air: transport", JSON.stringify(await transport(page)), "| refLine", JSON.stringify(await refLine(page)), "| readouts", await readouts(page)); await page.context().close(); }
// (b) 預設 + 阻力：參考線應消失；拉桿上限 = 1.8038 + 0.3；盡頭 y = 0、a = 0
{ const page = await fresh(); await pause(page); await page.locator("#ctl-air").check(); await page.waitForTimeout(500);
  const tr = await transport(page); console.log("[b] air on: transport", JSON.stringify(tr), "| refLine", JSON.stringify(await refLine(page)));
  await jump(page, +tr.max); await page.waitForTimeout(500); console.log("[b] at max readouts:", await readouts(page), "| transport", JSON.stringify(await transport(page)), "| refLine", JSON.stringify(await refLine(page)));
  await shotChart(page, "r5-air-default-end.png");
  await jump(page, 0.9); console.log("[b] t=0.9 readouts:", await readouts(page)); await shotChart(page, "r5-air-default-t0.9.png");
  await page.context().close(); }
// (c) m 0.1、u 50、θ 45、h 50、阻力（無第二顆球）：解析落地 19.228 s；拉桿上限應為 19.528
{ const page = await fresh(); await pause(page); await setRange(page, "ctl-u", 50); await setRange(page, "ctl-theta", 45); await setRange(page, "ctl-h", 50); await setRange(page, "ctl-m", 0.1); await page.locator("#ctl-air").check(); await page.waitForTimeout(500);
  const tr = await transport(page); console.log("[c] params set; transport:", JSON.stringify(tr));
  await jump(page, +tr.max); await page.waitForTimeout(600); console.log("[c] at max readouts:", await readouts(page), "| transport", JSON.stringify(await transport(page)), "| refLine", JSON.stringify(await refLine(page)));
  await shotChart(page, "r5-m0.1-air-end.png");
  await jump(page, 19.2); console.log("[c] jump 19.2 readouts:", await readouts(page));
  await jump(page, 19.3); console.log("[c] jump 19.3 readouts:", await readouts(page), "| transport", JSON.stringify(await transport(page)));
  await page.context().close(); }
// (d) u 50、θ −30、h 50、m 0.1、阻力、第二顆球自由下落：主球 13.075 s、自由下落球 15.624 s；拉桿上限應為 15.924
{ const page = await fresh(); await pause(page); await setRange(page, "ctl-u", 50); await setRange(page, "ctl-theta", -30); await setRange(page, "ctl-h", 50); await setRange(page, "ctl-m", 0.1); await page.locator("#ctl-air").check(); await setCompanion(page, "同時自由下落"); await page.waitForTimeout(500);
  const tr = await transport(page); console.log("[d] params set; transport:", JSON.stringify(tr));
  await jump(page, +tr.max); await page.waitForTimeout(600); console.log("[d] at max readouts:", await readouts(page), "| transport", JSON.stringify(await transport(page)));
  await shotChart(page, "r5-m0.1-air-drop-end.png");
  await jump(page, 13.2); console.log("[d] t=13.2 readouts (A landed, B not):", await readouts(page));
  await page.context().close(); }
// (e) m 0.1、u 50、θ 90、h 50、g 1.6、阻力：解析落地 125.33 s；拉桿上限應為 125.63
{ const page = await fresh(); await pause(page); await setRange(page, "ctl-u", 50); await setRange(page, "ctl-theta", 90); await setRange(page, "ctl-h", 50); await setRange(page, "ctl-m", 0.1); const sel = page.locator("select").filter({ hasText: "月球" }).first(); await sel.selectOption({ label: "1.6（月球）" }); await page.locator("#ctl-air").check(); await page.waitForTimeout(500);
  const tr = await transport(page); console.log("[e] params set; transport:", JSON.stringify(tr));
  await jump(page, +tr.max); await page.waitForTimeout(600); console.log("[e] at max readouts:", await readouts(page), "| transport", JSON.stringify(await transport(page)));
  await page.context().close(); }
// (f) m 0.1 + 阻力 + 預設 u/θ/h：落地 1.2886 s；拉桿上限應為 1.5886
{ const page = await fresh(); await pause(page); await setRange(page, "ctl-m", 0.1); await page.locator("#ctl-air").check(); await page.waitForTimeout(400); const tr = await transport(page); await jump(page, +tr.max); await page.waitForTimeout(600); console.log("[f] m=0.1 air: transport", JSON.stringify(tr), "| at max readouts:", await readouts(page), "| refLine", JSON.stringify(await refLine(page))); await shotChart(page, "r5-m0.1-air-default-end.png"); await page.context().close(); }
await browser.close();
