// 探查控制面板 DOM（找參數輸入格的選擇器），供 air / photo / 小質量播放測試用
import { chromium } from "playwright";
const url = "http://localhost:5173/#/sim/projectile-motion-independence-of-components";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-HK" });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" }); await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("input, select, button").forEach((el) => { const r = el.getBoundingClientRect(); out.push({ tag: el.tagName, type: el.type, name: el.name, id: el.id, cls: el.className, val: el.value, min: el.min, max: el.max, step: el.step, txt: (el.textContent || "").trim().slice(0, 30), lab: el.closest("label")?.textContent?.trim().slice(0, 30), x: Math.round(r.x), y: Math.round(r.y) }); });
  return out;
});
for (const i of info) console.log(JSON.stringify(i));
const panel = await page.evaluate(() => { const els = [...document.querySelectorAll("*")].filter((e) => /讀數/.test(e.textContent || "") && e.children.length < 40); return els.slice(-3).map((e) => e.tagName + "." + e.className + " :: " + (e.innerText || "").replace(/\s+/g, " ").slice(0, 400)); });
console.log(panel.join("\n"));
await browser.close();
