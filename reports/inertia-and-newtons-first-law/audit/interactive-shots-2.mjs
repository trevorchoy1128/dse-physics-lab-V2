// 補拍第二輪：用「暫停 → 跳到 t → 已放手 → 播放」取得確定時刻（第一輪按實時等候，頁面載入耗時令放手落在 B 之後）
import { chromium } from "playwright";
const OUT = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/audit/shots/";
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
await page.waitForTimeout(500);
// 現象 1：情景「物體在動…」（μ₂ = 0），t = 0.5 s 放手
await scenario("物體在動，就一定有一支力"); await pause(); await setNum(0, 0.5); await page.waitForTimeout(200); await shot("01-before-release-t0.5");
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(200); await shot("01b-released-t0.5");
await play(); await page.waitForTimeout(1500); await pause(); await shot("01c-released-later");
// 現象 2：情景「沒有力…」（μ₂ = 0.2），過 B 後 t = 1.2 s 放手
await scenario("沒有力，物體就會慢慢停下來"); await pause(); await setNum(0, 1.2); await page.waitForTimeout(200);
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(200); await shot("02-released-t1.2");
await play(); await page.waitForTimeout(350); await pause(); await shot("02b-decelerating");
await play(); await page.waitForTimeout(1500); await pause(); await shot("02c-stopped");
// 現象 5：兩個方塊 t = 0.5 s 放手
await scenario("重的物體慣性大"); await pause(); await setNum(0, 0.5); await page.waitForTimeout(200); await shot("05-two-blocks-before");
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(200); await shot("05b-two-blocks-released");
await play(); await page.waitForTimeout(1500); await pause(); await shot("05c-two-blocks-later");
console.log("errors", JSON.stringify(errors));
await browser.close();
