// 核實學生試用者第 1 輪的兩個卡點：(1) 巴士情景按播放後時間是否前進；(2)「還原預設」是否把「已放手」重設為「施力中」
import { chromium } from "playwright";
const url = process.argv[2] ?? "http://localhost:4174/#/sim/inertia-and-newtons-first-law";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle" });
const tOf = async () => page.evaluate(() => document.querySelector(".readouts tr td")?.innerText);
const seg = async () => page.evaluate(() => [...document.querySelectorAll(".segment button")].map(b => b.textContent + ":" + b.getAttribute("aria-pressed")).join(" | "));
// (1) 巴士：切換情景後等 3 s
await page.getByRole("button", { name: "巴士上的乘客" }).click();
await page.waitForTimeout(500); const t1 = await tOf(); await page.waitForTimeout(3000); const t2 = await tOf();
console.log("bus t after 0.5 s:", t1, "→ after 3.5 s:", t2);
// (2) 放手 → 還原預設 → 段狀態與 t、s
await page.getByRole("button", { name: "水平桌面上的方塊" }).click(); await page.waitForTimeout(800);
await page.getByRole("button", { name: "已放手" }).click(); await page.waitForTimeout(300);
console.log("after release:", await seg());
await page.getByRole("button", { name: "⟲ 還原預設" }).click(); await page.waitForTimeout(1200);
console.log("after restore:", await seg(), "t =", await tOf(), "s =", await page.evaluate(() => [...document.querySelectorAll(".readouts tr")].find(r => r.innerText.startsWith("s"))?.querySelector("td")?.innerText));
await browser.close();
