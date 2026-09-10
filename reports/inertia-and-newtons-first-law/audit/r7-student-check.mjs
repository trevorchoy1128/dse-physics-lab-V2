// 第 7 輪學生試用者的三個環境疑問：桌面版側欄空白、「重播」不歸零、404 資源。用 Playwright 在靜態版（4174）核實。
// 用法：node reports/inertia-and-newtons-first-law/audit/r7-student-check.mjs [url]
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:4174";
const out = "C:/Users/trevor/AppData/Local/Temp/claude/C--Users-trevor-OneDrive-DSE-Physics-Lab/472da062-da6a-4cab-b00c-a76c2956f859/scratchpad";
const browser = await chromium.launch();
for (const vp of [{ width: 1000, height: 800 }, { width: 1180, height: 700 }]) {
  const page = await browser.newPage({ viewport: vp });
  const bad = [];
  page.on("response", r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${base}/#/sim/inertia-and-newtons-first-law`); await page.waitForTimeout(1500);
  const ok = page.getByRole("button", { name: "知道了" }); if (await ok.count()) await ok.first().click();
  await page.screenshot({ path: `${out}/r7-student-${vp.width}.png`, fullPage: true });
  const side = await page.getByText("參數").first().boundingBox();
  const slider = await page.getByLabel(/方塊質量/).first().boundingBox();
  const readT = async () => (await page.getByText(/^t = /).first().textContent().catch(() => "?"));
  await page.waitForTimeout(2000); const t1 = await readT();
  await page.getByRole("button", { name: /重播/ }).click(); await page.waitForTimeout(150); const t2 = await readT();
  await page.waitForTimeout(1000); const t3 = await readT();
  console.log(JSON.stringify({ vp, side, slider, t1, t2, t3, bad }));
  await page.close();
}
await browser.close();
