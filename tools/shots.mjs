// 用 Playwright 為一個模擬截圖：桌面、iPad 直向、每個「試試看」情境。存到 reports/<simId>/shots/
// 用法：node tools/shots.mjs <simId> [--url http://localhost:5173] [--wait 3000]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./glossary.mjs";

const [simId, ...rest] = process.argv.slice(2);
if (!simId) { console.error("用法：node tools/shots.mjs <simId>"); process.exit(1); }
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const BASE = opt("--url", "http://localhost:5173");
const WAIT = Number(opt("--wait", 3000));
const out = join(ROOT, "reports", simId, "shots");
mkdirSync(out, { recursive: true });
const url = `${BASE}/#/sim/${simId}`;

const browser = await chromium.launch();
const shot = async (name, viewport, actions) => {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "zh-HK" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(WAIT);
  if (actions) await actions(page);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
  await ctx.close();
  console.log(`${name}.png${errors.length ? `  ⚠ console errors: ${errors.length}` : ""}`);
  return errors;
};

const allErrors = [];
allErrors.push(...await shot("desktop", { width: 1440, height: 900 }));
allErrors.push(...await shot("ipad-portrait", { width: 768, height: 1024 }));
allErrors.push(...await shot("ipad-landscape", { width: 1024, height: 768 }));

// 每個試試看兩張：early（0.1× 慢速播 3 s 實時 ≈ 0.3 s 模擬時間，捕捉起始瞬間）與 end（快進到時間窗末端，反差在此）
const scenarioCount = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); await page.goto(url, { waitUntil: "networkidle" }); await page.waitForTimeout(WAIT);
  const n = await page.locator(".scenarios > button").count(); await ctx.close(); return n;
})();
const scenarioShot = async (i, phase) => shot(`scenario-${i + 1}-${phase}`, { width: 1440, height: 900 }, async page => {
  const btn = page.locator(".scenarios > button").nth(i);
  const label = (await btn.textContent())?.trim();
  const speed = page.locator(".transport .speed select");
  if (phase === "early") { await speed.selectOption("0.1"); await btn.click(); await page.waitForTimeout(3000); }
  else {
    await btn.click(); await speed.selectOption("2");
    // 有時間拉桿就直接跳到末端；否則等 12 s 實時（2× → 24 s 模擬時間）
    const scrub = page.locator(".scrub input");
    if (await scrub.count()) {
      // range 輸入不能用 fill：以原生 setter 設值再派發 input 事件，React 的 onChange 才會收到
      await scrub.evaluate(el => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, el.max); el.dispatchEvent(new Event("input", { bubbles: true })); });
      await page.waitForTimeout(800);
    } else await page.waitForTimeout(12000);
  }
  if (phase === "early") console.log(`  scenario-${i + 1}: ${label}`);
});
for (let i = 0; i < scenarioCount; i++) { allErrors.push(...await scenarioShot(i, "early")); allErrors.push(...await scenarioShot(i, "end")); }
await browser.close();
if (allErrors.length) { console.error("console 錯誤：", [...new Set(allErrors)].join("\n")); process.exit(2); }
console.log(`完成 → reports/${simId}/shots/`);
