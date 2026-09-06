// 核數員 第 3 輪：3D 視窗 x/y 標籤（LiveLabel）與右欄讀數是否同一時刻。
// 方法：在頁面內以 setInterval 每 25 ms 讀一次 document.body.innerText（同一次讀取 = 同一 DOM 快照），
// 記錄 3D 標籤與讀數各自的變動時刻與數值；另量 requestAnimationFrame 幀率（無頭 Chromium 軟體 WebGL）。
// 只讀 DOM 文字，不改任何檔案。
import { chromium } from "playwright";
const url = "http://localhost:5173/#/sim/projectile-motion-independence-of-components";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-HK" });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" }); await page.waitForTimeout(3000);

const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
console.log("rAF 幀率（無頭 Chromium）≈", fps.toFixed(1), "fps");

const sample = async (ms) => page.evaluate((ms) => new Promise((res) => {
  const out = []; const t0 = performance.now();
  const id = setInterval(() => {
    const t = document.body.innerText; const m = (re) => { const r = t.match(re); return r ? r[1] : null; };
    out.push({ now: performance.now() - t0, l3x: m(/x = ([\d.]+) m/), l3y: m(/y = ([\d.]+) m/), clock: m(/t = ([\d.]+) s/), rx: m(/水平距離\s*([\d.]+) m/), ry: m(/當前高度\s*([\d.]+) m/), rt: m(/飛行時間[\s\S]*?([\d.]+) s/) });
    if (performance.now() - t0 > ms) { clearInterval(id); res(out); }
  }, 25);
}), ms);

const summarize = (name, S, ux) => {
  const changes = (key) => S.filter((s, i) => i > 0 && s[key] !== S[i - 1][key]).map((s) => s.now);
  const c3 = changes("l3x"), cr = changes("rx");
  const rate = (c) => c.length > 1 ? ((c.length - 1) / ((c[c.length - 1] - c[0]) / 1000)).toFixed(1) : "n/a";
  // 同一快照內 3D 標籤 x 與讀數 x 的差（換成模擬時間 Δt = Δx / vx）
  const lag = S.filter((s) => s.l3x && s.rx).map((s) => (parseFloat(s.rx) - parseFloat(s.l3x)) / ux);
  const mx = Math.max(...lag), mn = Math.min(...lag), mean = lag.reduce((a, b) => a + b, 0) / lag.length;
  const same = S.filter((s) => s.l3x === s.rx).length;
  console.log(`${name}: 樣本 ${S.length}（每 25 ms）| 3D 標籤 x 變動次數 ${c3.length}（≈ ${rate(c3)} 次/s）| 讀數 x 變動次數 ${cr.length}（≈ ${rate(cr)} 次/s）| 同一快照 讀數 − 3D 標籤 換算模擬時間：min ${mn.toFixed(3)} mean ${mean.toFixed(3)} max ${mx.toFixed(3)} s | 逐字相同的快照 ${same}/${S.length}`);
  // 一格落後檢驗：每次讀數 x 變動時，同一快照的 3D 標籤是否等於變動前的讀數值
  let ev = 0, oneBehind = 0, seq = []; for (let i = 1; i < S.length; i++) if (S[i].rx !== S[i - 1].rx && S[i].rx && S[i - 1].rx) { ev++; if (S[i].l3x === S[i - 1].rx) oneBehind++; seq.push(`[讀數 ${S[i - 1].rx}→${S[i].rx} | 3D ${S[i].l3x}]`); }
  console.log(`  讀數變動事件 ${ev} 次，其中 3D 標籤 = 變動前讀數值（恰好落後一格）${oneBehind} 次；序列: ${seq.join(" ")}`);
  console.log("  首 6 個樣本:", S.slice(0, 6).map((s) => `${s.now.toFixed(0)}ms 3D(${s.l3x},${s.l3y}) 讀數(${s.rx},${s.ry}) t=${s.rt}`).join(" | "));
};

const speed = page.locator(".transport .speed select");
const play = async () => { const b = page.locator("button", { hasText: "播放" }); if (await b.count()) await b.first().click(); };
const fpsWhilePlaying = async () => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
// 情境 1（u 10, θ 0, h 20, drop）：vx = 10
{ const btn = page.locator(".scenarios > button").nth(0); await speed.selectOption("0.1"); await btn.click(); await page.waitForTimeout(800); await play(); console.log("情境 1 播放中 rAF 幀率 ≈", (await fpsWhilePlaying()).toFixed(1), "fps"); await page.waitForTimeout(300);
  const S = await sample(3000); summarize("情境 1 0.1× 播放中", S, 10);
  const pauseBtn = page.locator("button", { hasText: "暫停" }); if (await pauseBtn.count()) await pauseBtn.first().click(); await page.waitForTimeout(800);
  const P = await sample(500); summarize("情境 1 暫停後", P, 10); }
// 預設（u 15, θ 40, fast）：vx = 11.4907，1×
{ await speed.selectOption("1"); const reset = page.locator("button", { hasText: "還原預設" }); await reset.first().click(); await page.waitForTimeout(500);
  const replay = page.locator("button", { hasText: "重播" }); await replay.first().click(); await page.waitForTimeout(200); await play(); await page.waitForTimeout(200);
  const S = await sample(1500); summarize("預設 1× 播放中", S, 11.49066664678467);
  await page.waitForTimeout(1500); const E = await sample(400); summarize("預設 落地後（時鐘停）", E, 11.49066664678467); }
// 預設 0.1×
{ await speed.selectOption("0.1"); const replay = page.locator("button", { hasText: "重播" }); await replay.first().click(); await page.waitForTimeout(200); await play(); await page.waitForTimeout(300);
  const S = await sample(3000); summarize("預設 0.1× 播放中", S, 11.49066664678467); }
// 情境 1 以 1× 播放（vx = 10）
{ const btn = page.locator(".scenarios > button").nth(0); await speed.selectOption("1"); await btn.click(); await page.waitForTimeout(300); await play(); await page.waitForTimeout(200);
  const S = await sample(1400); summarize("情境 1 1× 播放中", S, 10); }
await browser.close();
