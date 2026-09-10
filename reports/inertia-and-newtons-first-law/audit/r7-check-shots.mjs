// 第 7 輪主流程核實截圖：分段標籤（情境 5 兩段都粗糙）、三艘飛船真實位置（情境 3 末端、情境 9 末端）、乘客滑出車廂（f = 0 末端）
// 用法：node reports/inertia-and-newtons-first-law/audit/r7-check-shots.mjs [url] [outDir]
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:5175";
const out = process.argv[3] ?? "C:/Users/trevor/AppData/Local/Temp/claude/C--Users-trevor-OneDrive-DSE-Physics-Lab/472da062-da6a-4cab-b00c-a76c2956f859/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/#/sim/inertia-and-newtons-first-law`); await page.waitForTimeout(1500);
const ok = page.getByRole("button", { name: "知道了" }); if (await ok.count()) await ok.first().click();
const seek = async t => { const el = page.getByLabel(/跳到/).first(); await el.fill(String(t)); await el.dispatchEvent("input"); await el.dispatchEvent("change"); await page.waitForTimeout(300); };
const pause = async () => { const b = page.getByRole("button", { name: /暫停/ }); if (await b.count()) await b.first().click(); };
const shot = name => page.locator("canvas").first().screenshot({ path: `${out}/${name}.png` });
const scenario = async i => { await page.locator(".scenarios > button").nth(i).click(); await page.waitForTimeout(500); await pause(); };
const setNum = async (label, v) => { const el = page.getByLabel(label).last(); await el.fill(String(v)); await el.dispatchEvent("input"); await el.dispatchEvent("change"); await page.waitForTimeout(250); };
await scenario(4); await seek(0.5); await shot("r7-scenario5-labels");                 // 兩段都粗糙 0.4 N
await scenario(2); await seek(12); await shot("r7-trio-engine-off-end");               // 三艘關引擎 12 s
await scenario(8); await seek(12); await shot("r7-trio-engine-on-end");                // 三艘同一推力 12 s
await scenario(6); await seek(14); await shot("r7-bus-f0-end");
await seek(2.8); await shot("r7-bus-f0-outside");                                    // 乘客剛滑出車尾、仍在畫面內：施力物改寫「地面」                        // 乘客 f = 0，滑出車廂
await scenario(5); await seek(8.5); await shot("r7-bus-brake");                        // 預設 150 N 煞車
await page.setViewportSize({ width: 768, height: 1024 }); await page.waitForTimeout(400);
await scenario(5); await seek(1.0); await shot("r7-ipad-bus-start");
await scenario(4); await seek(0.5); await shot("r7-ipad-scenario5-labels");
await browser.close(); console.log("done");
