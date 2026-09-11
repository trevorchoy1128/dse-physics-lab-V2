import { chromium } from "playwright";
const out = process.argv[2] ?? "C:/Users/trevor/AppData/Local/Temp/claude/C--Users-trevor-OneDrive-DSE-Physics-Lab/472da062-da6a-4cab-b00c-a76c2956f859/scratchpad";
const browser = await chromium.launch();
for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["ipad", { width: 768, height: 1024 }]]) {
  const page = await browser.newPage({ viewport: vp });
  await page.goto("http://localhost:5175/#/sim/inertia-and-newtons-first-law"); await page.waitForTimeout(1500);
  const btn = page.getByRole("button", { name: "知道了" }); if (await btn.count()) await btn.first().click();
  await page.getByRole("button", { name: "巴士上的乘客" }).click(); await page.waitForTimeout(400);
  const pause = page.getByRole("button", { name: /暫停/ }); if (await pause.count()) await pause.first().click();
  const seek = async t => { const el = page.getByLabel(/跳到/).first(); await el.fill(String(t)); await el.dispatchEvent("input"); await el.dispatchEvent("change"); await page.waitForTimeout(300); };
  for (const t of [1.5, 8.5, 12]) { await seek(t); await page.locator("canvas").first().screenshot({ path: `${out}/bus-${name}-t${t}.png` }); }
  await page.close();
}
await browser.close(); console.log("done");
