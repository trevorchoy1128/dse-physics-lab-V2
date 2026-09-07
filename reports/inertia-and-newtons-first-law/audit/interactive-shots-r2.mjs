// 第 2 輪補拍（Scene 0.2.0）：自動截圖只有 early / end，拍不到「放手」「只看淨力」「煞車瞬間」「關引擎」「v布 = 10 / 1.0」「握扶手」。
// 需 dev server：npx vite --port 5199（worktree）。輸出 audit/shots-r2/。方法：暫停 → 跳到 t → 操作 → 播放 → 暫停，取確定時刻。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/audit/shots-r2/";
mkdirSync(OUT, { recursive: true });
const url = "http://localhost:5199/#/sim/inertia-and-newtons-first-law";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on("pageerror", e => errors.push(String(e))); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
const read = async () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".readouts tr")].map(r => [r.querySelector("th")?.innerText.split("\n")[0], r.querySelector("td")?.innerText])));
const shot = async n => { await page.screenshot({ path: OUT + n + ".png", clip: { x: 0, y: 60, width: 1440, height: 900 } }); const r = await read(); console.log(n, JSON.stringify(r)); return r; };
const setNum = async (i, v) => { const el = page.locator("input[type=number]").nth(i); await el.fill(String(v)); await el.dispatchEvent("input"); await el.dispatchEvent("change"); };
const scenario = async txt => { await page.getByText(txt, { exact: false }).first().click(); await page.waitForTimeout(400); };
const pause = async () => { const b = page.getByRole("button", { name: /暫停/ }); if (await b.count()) await b.click(); };
const play = async () => { const b = page.getByRole("button", { name: /播放/ }); if (await b.count()) await b.click(); };
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
// 現象 1：情景「物體在動…」（μ₂ = 0），t = 0.5 s 放手
await scenario("物體在動，就一定有一支力"); await pause(); await setNum(0, 0.5); await page.waitForTimeout(200); await shot("01-before-release-t0.5");
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(200); await shot("01b-released-t0.5");
await play(); await page.waitForTimeout(1500); await pause(); await shot("01c-released-later");
// 現象 2：情景「沒有力…」（μ₂ = 0.2），過 B 後 t = 1.2 s 放手
await scenario("沒有力，物體就會慢慢停下來"); await pause(); await setNum(0, 1.2); await page.waitForTimeout(200);
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(200); await shot("02-released-t1.2");
await play(); await page.waitForTimeout(350); await pause(); await shot("02b-decelerating");
await play(); await page.waitForTimeout(2000); await pause(); await shot("02c-stopped");
// 現象 4：靜止，只看淨力
await scenario("靜止即是沒有力"); await pause(); await page.waitForTimeout(200); await shot("04-rest-two-forces");
await page.getByText("只看淨力").first().click(); await page.waitForTimeout(300); await shot("04b-rest-net-only");
await page.getByText("只看淨力").first().click();
// 現象 5：兩個方塊 t = 0.5 s 放手
await scenario("重的物體慣性大"); await pause(); await setNum(0, 0.5); await page.waitForTimeout(200); await shot("05-two-blocks-before");
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(200); await shot("05b-two-blocks-released");
await play(); await page.waitForTimeout(1500); await pause(); await shot("05c-two-blocks-later");
// 現象 7：巴士急煞（跳到 t = 8.5 s）；再握扶手
await scenario("巴士急煞時有一股力"); await pause(); await setNum(0, 8.5); await page.waitForTimeout(400); await shot("07-bus-brake-t8.5");
await page.getByText("握扶手").first().click(); await page.waitForTimeout(300); await pause(); await setNum(0, 8.5); await page.waitForTimeout(400); await shot("07b-bus-brake-handrail-t8.5");
// 現象 8：巴士起步 μ = 0（情景 7）t = 1.5；μ = 0.4 t = 1.5
await scenario("巴士起步時乘客被拋向後"); await pause(); await setNum(0, 1.5); await page.waitForTimeout(400); await shot("08-bus-start-mu0-t1.5");
await setNum(3, 0.4); await page.waitForTimeout(300); await pause(); await setNum(0, 1.5); await page.waitForTimeout(400); await shot("08b-bus-start-mu0.4-t1.5");
// 現象 6：桌布 v布 = 5 / 10 / 1.0
await scenario("桌布抽得快"); await pause(); await setNum(0, 0.3); await page.waitForTimeout(300); await shot("06-cloth-v5");
await setNum(1, 10); await page.waitForTimeout(300); await pause(); await setNum(0, 0.3); await page.waitForTimeout(300); await shot("06b-cloth-v10");
await setNum(1, 1.0); await page.waitForTimeout(300); await pause(); await setNum(0, 1.5); await page.waitForTimeout(300); await shot("06c-cloth-v1.0-stuck");
// 現象 9：太空關引擎（情景 11），t = 1.0 s 關
await scenario("太空中沒有重力"); await pause(); await setNum(0, 1.0); await page.waitForTimeout(200); await shot("09-engine-on-t1");
await page.getByRole("button", { name: "關", exact: true }).click(); await page.waitForTimeout(200); await shot("09b-engine-off-t1");
await play(); await page.waitForTimeout(1500); await pause(); await shot("09c-engine-off-later");
// 三艘關引擎（情景 3）
await scenario("物體慢慢停下來是因為慣性"); await pause(); await setNum(0, 6); await page.waitForTimeout(300); await shot("09d-trio-engine-off-t6");
console.log("errors", JSON.stringify(errors));
await browser.close();
