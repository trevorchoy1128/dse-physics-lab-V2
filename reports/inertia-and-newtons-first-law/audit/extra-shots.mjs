// 補拍儀器審核員第 1 輪要求的畫面：桌布抽出前、急煞當刻（握／不握扶手）、運動中放手、只看淨力、v布 = 10 / 1.0
// 用法：node reports/inertia-and-newtons-first-law/audit/extra-shots.mjs [url]   → reports/inertia-and-newtons-first-law/shots/extra-*.png
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:5175";
const url = `${base}/#/sim/inertia-and-newtons-first-law`;
const out = "reports/inertia-and-newtons-first-law/shots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "知道了" }).click().catch(() => {});
const seek = async t => { const box = page.locator("input[type=number]").first(); await box.fill(String(t)); await box.dispatchEvent("input"); await box.dispatchEvent("change"); await page.waitForTimeout(250); };
const pause = async () => { const b = page.getByRole("button", { name: /暫停/ }); if (await b.count()) await b.click(); };
const play = async () => { const b = page.getByRole("button", { name: /播放/ }); if (await b.count()) await b.click(); };
const shot = async name => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200); await page.screenshot({ path: `${out}/${name}.png`, clip: { x: 0, y: 60, width: 1440, height: 900 } }); console.log(name); };
const scene = async name => { await page.getByRole("button", { name }).click(); await page.waitForTimeout(300); };
const setNum = async (label, v) => { const el = page.getByLabel(label).last(); await el.fill(String(v)); await el.dispatchEvent("input"); await el.dispatchEvent("change"); await page.waitForTimeout(250); };

// 情景 1：運動中放手（t ≈ 0.5 s，仍在光滑段），放手後 0.5 s
await page.getByRole("button", { name: "⟲ 還原預設" }).click(); await play(); await page.waitForTimeout(550);
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(500); await pause(); await shot("extra-release-moving");
// 光滑段運動中放手（μ₂ = 0）：2 支力、水平 0 支、v 不變（核數員第 3 輪 G-i）
await page.getByRole("button", { name: "⟲ 還原預設" }).click(); await setNum("後段桌面（B 之後）的摩擦係數", 0); await play(); await page.waitForTimeout(600);
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(600); await pause(); await shot("extra-release-smooth-2forces");
// 放手後停下：摩擦箭嘴消失（G-ii）：預設參數 t ≈ 1.2 s 放手，跳到末端
await page.getByRole("button", { name: "⟲ 還原預設" }).click(); await play(); await page.waitForTimeout(1200); await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(2500); await pause(); await shot("extra-release-stopped");
// 兩方塊放手後並肩（G-iii）
await page.getByRole("button", { name: "⟲ 還原預設" }).click(); await setNum("後段桌面（B 之後）的摩擦係數", 0); await page.getByLabel("第二個方塊（同一推力）").check(); await play(); await page.waitForTimeout(700);
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(1000); await pause(); await shot("extra-two-blocks-released"); await page.getByLabel("第二個方塊（同一推力）").uncheck();
// 只看淨力（靜止方塊）
await page.getByRole("button", { name: "⟲ 還原預設" }).click(); await page.getByRole("button", { name: "已放手" }).click(); await seek(0);
await page.getByLabel("只看淨力（隱藏個別力）").check(); await shot("extra-net-only"); await page.getByLabel("只看淨力（隱藏個別力）").uncheck();
// 情景 2：抽出前 t = 0 與 t = 0.04；v布 = 10；v布 = 1.0 抽不出
await scene("桌布實驗"); await pause(); await seek(0); await shot("extra-cloth-t0"); await seek(0.04); await shot("extra-cloth-t0.04");
await setNum("桌布抽出速率", 10); await pause(); await seek(0.5); await shot("extra-cloth-v10");
await setNum("桌布抽出速率", 1.0); await pause(); await seek(2.5); await shot("extra-cloth-v1-stuck");
// 情景 3：急煞當刻 t = 8.5（不握／握扶手）；起步 t = 1.5
await scene("巴士上的乘客"); await pause(); await seek(1.5); await shot("extra-bus-start"); await seek(8.5); await shot("extra-bus-brake");
await page.getByLabel("握扶手").check(); await pause(); await seek(8.5); await shot("extra-bus-brake-handrail"); await page.getByLabel("握扶手").uncheck();
await setNum("乘客（鞋）與地板的摩擦係數", 0.4); await pause(); await seek(1.5); await shot("extra-bus-start-mu04"); await setNum("乘客（鞋）與地板的摩擦係數", 0.2);   // μ ≥ a/g：乘客與巴士一起走（§8 第 8 條第三子項）
// 情景 4：三艘關引擎
await scene("太空中的飛船"); await setNum("引擎推力", 2); await page.getByLabel("三艘飛船（靜止、向右、向左）").check(); await play(); await page.waitForTimeout(1000);
await pause(); await shot("extra-space-engine-on");   // 關引擎前一刻（G-iv）
await page.getByRole("button", { name: "▶ 播放" }).click().catch(() => {}); await page.getByRole("button", { name: "關", exact: true }).click(); await page.waitForTimeout(600); await pause(); await shot("extra-space-engine-off");
await browser.close();
