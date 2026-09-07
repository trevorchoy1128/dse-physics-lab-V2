// 核數員補拍：自動截圖只有 early / end，拍不到「放手」「只看淨力」「煞車瞬間」「關引擎」「抽出速率 10 / 1.0」。
// 需 dev server：npx vite --port 5175。輸出到 audit/shots/。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/audit/shots/";
mkdirSync(OUT, { recursive: true });
const url = "http://localhost:5199/#/sim/inertia-and-newtons-first-law";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on("pageerror", e => errors.push(String(e))); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
const read = async () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".readouts tr")].map(r => [r.querySelector("th")?.innerText.split("\n")[0], r.querySelector("td")?.innerText])));
const shot = async n => { await page.screenshot({ path: OUT + n + ".png", clip: { x: 0, y: 60, width: 1440, height: 900 } }); const r = await read(); console.log(n, JSON.stringify(r)); return r; };
const setNum = async (i, v) => { const el = page.locator("input[type=number]").nth(i); await el.fill(String(v)); await el.dispatchEvent("input"); await el.dispatchEvent("change"); };
const scenario = async txt => { await page.getByText(txt, { exact: false }).first().click(); await page.waitForTimeout(400); };
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
// 1. 預設，t≈0.8 s 放手（仍在光滑段）→ 現象 1
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(150);
await shot("01-release-smooth"); await page.waitForTimeout(1200); await shot("01b-release-smooth-later");
// 2. 情景「沒有力，物體就會慢慢停下來」：過 B 後放手 → 現象 2
await scenario("沒有力，物體就會慢慢停下來"); await page.waitForTimeout(1400);
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(600); await shot("02-release-rough-decel");
await page.waitForTimeout(2500); await shot("02b-release-rough-stopped");
// 3. 靜止：只看淨力 → 現象 4
await scenario("靜止即是沒有力"); await page.waitForTimeout(300); await shot("04-rest-two-forces");
await page.getByText("只看淨力").first().click(); await page.waitForTimeout(300); await shot("04b-rest-net-only");
await page.getByText("只看淨力").first().click();
// 4. 兩個方塊放手 → 現象 5
await scenario("重的物體慣性大"); await page.waitForTimeout(600);
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(1500); await shot("05-two-blocks-released");
// 5. 巴士急煞瞬間（跳到 t = 8.5 s）→ 現象 7；再握扶手
await scenario("巴士急煞時有一股力"); await page.waitForTimeout(300);
await setNum(0, 8.5); await page.waitForTimeout(400); await shot("07-bus-brake-t8.5");
await page.getByText("握扶手").first().click(); await page.waitForTimeout(300); await setNum(0, 8.5); await page.waitForTimeout(400); await shot("07b-bus-brake-handrail-t8.5");
// 6. 巴士起步 μ = 0.4（≥ a/g = 0.306）→ 現象 8 第三分支
await scenario("巴士起步時乘客被拋向後"); await page.waitForTimeout(300);
await setNum(3, 0.4); await setNum(0, 1.5); await page.waitForTimeout(400); await shot("08-bus-start-mu0.4-t1.5");
// 7. 桌布 v布 = 10 及 1.0 → 現象 6
await scenario("桌布抽得快"); await page.waitForTimeout(1200); await shot("06-cloth-v5");
await setNum(1, 10); await page.waitForTimeout(1200); await shot("06b-cloth-v10");
await setNum(1, 1.0); await page.waitForTimeout(2500); await shot("06c-cloth-v1.0-stuck");
// 8. 太空：關引擎 → 現象 9
await scenario("太空中沒有重力"); await page.waitForTimeout(1500); await shot("09-engine-on");
await page.getByRole("button", { name: "關", exact: true }).click(); await page.waitForTimeout(200); await shot("09b-engine-off");
await page.waitForTimeout(1500); await shot("09c-engine-off-later");
console.log("errors", JSON.stringify(errors));
await browser.close();
