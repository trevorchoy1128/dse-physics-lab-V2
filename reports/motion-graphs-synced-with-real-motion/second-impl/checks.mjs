import fs from "node:fs";
import path from "node:path";
import { observe, simulate } from "./model.mjs";
const root = "C:/Users/trevor/dev/dse-physics-lab/reports/motion-graphs-synced-with-real-motion";
const index = JSON.parse(fs.readFileSync(path.join(root, "data/index.json"), "utf8"));
const out = [];
const log = (...a) => { const s = a.join(" "); out.push(s); console.log(s); };
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

// ---------- 1. 量綱：把單位換算成 cm 與 ms（s→cm 因子 100，t→ms 因子 1000），結果應按量綱縮放 ----------
{
  const p = { mode: "live", u: 2.5, a: -3, T: 10, vt: [] };
  const L = 100, Tm = 1000; // 長度、時間縮放
  const p2 = { mode: "live", u: 2.5 * L / Tm, a: -3 * L / Tm / Tm, T: 10 * Tm, vt: [] };
  let ok = true;
  for (const t of [0.5, 1, 3.7, 9.99]) {
    const A = observe(p, t).obs, B = observe(p2, t * Tm).obs;
    ok &&= close(B.s, A.s * L) && close(B.dist, A.dist * L) && close(B.v, A.v * L / Tm)
      && close(B.a, A.a * L / Tm / Tm) && close(B.avgVel, A.avgVel * L / Tm) && close(B.area, A.area * L);
  }
  log("量綱(live) 單位縮放一致:", ok);
  // draw 模式：只能縮放長度（節點固定在整數秒）
  const pd = { mode: "draw", T: 10, vt: [0, 1.5, -2, 0.5, 0.5, 3, 0, 0, 0, 0, 0] };
  const pd2 = { ...pd, vt: pd.vt.map(x => x * L) };
  let ok2 = true;
  for (const t of [0.3, 1, 2.5, 4.999, 7.2]) {
    const A = observe(pd, t).obs, B = observe(pd2, t).obs;
    ok2 &&= close(B.s, A.s * L) && close(B.dist, A.dist * L) && close(B.v, A.v * L) && close(B.a, A.a * L);
  }
  log("量綱(draw) 長度縮放一致:", ok2);
}

// ---------- 2. 對稱：反號 (u,a)→(-u,-a) 或 vt→-vt，s、v、a、avgVel 反號，dist、speed、avgSpeed 不變 ----------
{
  let ok = true;
  const p = { mode: "live", u: 3, a: -9.81, T: 5, vt: [] };
  const q = { mode: "live", u: -3, a: 9.81, T: 5, vt: [] };
  for (const t of [0, 0.1, 0.3058, 0.5, 2, 4.999, 5]) {
    const A = observe(p, t).obs, B = observe(q, t).obs;
    ok &&= close(A.s, -B.s) && close(A.v, -B.v) && close(A.a, -B.a) && close(A.avgVel, -B.avgVel)
      && close(A.dist, B.dist) && close(A.speed, B.speed) && close(A.avgSpeed, B.avgSpeed);
  }
  log("對稱(live) 反號:", ok);
  const vt = [2, 1.6, 1.2, 0.8, 0.4, 0, -0.4, -0.8, -1.2, -1.6, -2];
  const pd = { mode: "draw", T: 10, vt }, qd = { mode: "draw", T: 10, vt: vt.map(x => -x) };
  let ok2 = true;
  for (const t of [0, 0.7, 2.3, 5, 5.001, 7.7, 9.999, 10]) {
    const A = observe(pd, t).obs, B = observe(qd, t).obs;
    ok2 &&= close(A.s, -B.s) && close(A.v, -B.v) && close(A.a, -B.a) && close(A.dist, B.dist) && close(A.speed, B.speed);
  }
  log("對稱(draw) 反號:", ok2);
  // 時間反演對稱：vt 為奇對稱折線（scenario-below-axis）時，s(10) = 0 且 s(5+τ) = s(5-τ)
  let ok3 = true;
  for (const tau of [0.5, 1, 2.25, 4.999]) ok3 &&= close(observe(pd, 5 + tau).obs.s, observe(pd, 5 - tau).obs.s);
  ok3 &&= close(observe(pd, 10).obs.s, 0) && close(observe(pd, 10).obs.dist, 10);
  log("對稱(draw) 奇對稱 v–t 的 s 鏡像、s(10)=0、dist(10)=10:", ok3);
}

// ---------- 3. 極限 ----------
{
  // a = 0：s = u t 線性，dist = |u| t
  let ok = true;
  for (const u of [2, -1.5, 0]) for (const t of [0.25, 1, 4, 9.5]) {
    const o = observe({ mode: "live", u, a: 0, T: 10, vt: [] }, t).obs;
    ok &&= close(o.s, u * t) && close(o.dist, Math.abs(u) * t) && close(o.v, u) && o.a === 0;
  }
  log("極限 a=0：s = u t, dist = |u| t:", ok);
  // u = 0：s = ½ a t²，v² = 2 a s
  ok = true;
  for (const a of [1, -4.5, 9.81]) for (const t of [0.001, 0.5, 3, 9.999]) {
    const o = observe({ mode: "live", u: 0, a, T: 10, vt: [] }, t).obs;
    ok &&= close(o.s, 0.5 * a * t * t) && close(o.v * o.v, 2 * a * o.s) && close(o.dist, Math.abs(o.s));
  }
  log("極限 u=0：s = ½at², v² = 2as:", ok);
  // 三條運動方程互相一致（一般 u,a）
  ok = true;
  for (const [u, a] of [[3, -9.81], [-4.49, 5.32], [2.9, 9.68]]) for (const t of [0.2, 1.3, 4.7]) {
    const o = observe({ mode: "live", u, a, T: 10, vt: [] }, t).obs;
    ok &&= close(o.v, u + a * t) && close(o.s, u * t + 0.5 * a * t * t) && close(o.v * o.v, u * u + 2 * a * o.s);
  }
  log("極限/一致：v=u+at, s=ut+½at², v²=u²+2as 互相一致:", ok);
  // draw 模式每段 s 為二次：取三點擬合二次式，第四點應吻合；a 等於段斜率
  ok = true;
  const vt = [0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0];
  const pd = { mode: "draw", T: 10, vt };
  for (let i = 0; i < 10; i++) {
    const f = tau => observe(pd, i + tau).obs.s;
    const s0 = f(0), s1 = f(0.25), s2 = f(0.5), s3 = f(0.75);
    // 二次式過 (0,s0),(0.25,s1),(0.5,s2)：以二階差分預測 s3
    const pred = s0 + 3 * (s1 - s0) + 3 * (s2 - 2 * s1 + s0); // 三階差分為零
    ok &&= close(pred, s3, 1e-9);
    // 二階差分 = m·h²，m = 段斜率
    ok &&= close((s2 - 2 * s1 + s0) / 0.0625, vt[i + 1] - vt[i]);
    ok &&= close(observe(pd, i + 0.3).obs.a, vt[i + 1] - vt[i]);
  }
  log("極限(draw)：每段 s 為二次、二階差分 = 段斜率、a = 段斜率:", ok);
  // 超出末節點：v 保持最後值、a = 0（T 大於節點範圍）
  const pl = { mode: "draw", T: 20, vt: [0, 2, 1] };
  const o15 = observe(pl, 15).obs, o2 = observe(pl, 2).obs;
  log("極限(draw)：超出末節點 v 恆為末值、a=0、s 線性:", close(o15.v, 1) && o15.a === 0 && close(o15.s, o2.s + 13));
  // t → 0：所有量趨零（除 v→u, a）
  const o0 = observe({ mode: "live", u: 1.2, a: 3, T: 10, vt: [] }, 0).obs;
  log("極限 t=0：s=dist=area=avg=0, v=u, a=a:", o0.s === 0 && o0.dist === 0 && o0.avgSpeed === 0 && o0.v === 1.2 && o0.a === 3);
  // 大 a：s ∝ a，dist 隨 |a| 線性
  const big = observe({ mode: "live", u: 0, a: 1e6, T: 10, vt: [] }, 2).obs;
  log("極限 a 極大：s = ½·1e6·4 = 2e6:", close(big.s, 2e6));
  // 零加速度且 u = 0：靜止，s–t 為水平線但 dist = 0
  const still = observe({ mode: "live", u: 0, a: 0, T: 10, vt: [] }, 7).obs;
  log("極限 靜止：s=dist=v=0:", still.s === 0 && still.dist === 0 && still.v === 0);
}

// ---------- 4. 規格驗證條件（用主實作輸出數據檢驗） ----------
{
  for (const run of index.runs) {
    const A = JSON.parse(fs.readFileSync(path.join(root, "data", run.name + ".json"), "utf8")).frames;
    let areaEqS = true, speedAbs = true, avgOk = true, distEqS = true, distNeS = true, reversed = false, vtLive = true, tRev = null;
    for (const f of A) {
      const o = f.obs;
      areaEqS &&= o.area === o.s;
      speedAbs &&= o.speed === Math.abs(o.v);
      if (f.t > 0) avgOk &&= close(o.avgSpeed * f.t, o.dist, 1e-9) && close(o.avgVel * f.t, o.s, 1e-9);
      // 判斷是否已反向：v 與初速反號（先判斷，再檢查）
      const v0 = A[0].obs.v;
      if (!reversed && v0 !== 0 && o.v * v0 < 0) { reversed = true; tRev = f.t; }
      if (!reversed) {
        // 未反向前 dist = |s|
        distEqS &&= close(o.dist, Math.abs(o.s), 1e-9);
      } else if (f.t > tRev + 0.01) {
        // 反向後 dist > |s|（反向後 10 ms 起檢查，避免剛反向時差額低於浮點解析度）
        distNeS &&= o.dist > Math.abs(o.s) + 1e-12;
      }
      if (run.params.mode === "live" && f.t < run.params.T) {
        const { u, a } = run.params;
        vtLive &&= close(o.v * o.v, u * u + 2 * a * o.s, 1e-8) && close(o.v, u + a * f.t, 1e-8);
      }
    }
    log(`規格驗證[${run.name}] 面積=位移:${areaEqS} speed=|v|:${speedAbs} 平均量一致:${avgOk} 未反向 dist=|s|:${distEqS} 反向後 dist>|s|:${distNeS}(曾反向:${reversed}) 運動方程一致:${vtLive}`);
  }
}
fs.writeFileSync(path.join(root, "second-impl", "checks-output.txt"), out.join("\n"));
