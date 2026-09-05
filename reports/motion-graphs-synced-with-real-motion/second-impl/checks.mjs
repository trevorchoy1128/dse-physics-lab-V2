// 第 7 輪額外檢查（只用第二實作 model.mjs，不讀主實作程式）：量綱、對稱、極限、規格驗證條件、幀時刻規則
import fs from "node:fs";
import path from "node:path";
import { observe, simulate } from "./model.mjs";
const root = "C:/Users/trevor/dev/dse-physics-lab/reports/motion-graphs-synced-with-real-motion";
const out = [];
const log = (...a) => { const s = a.join(" "); out.push(s); console.log(s); };
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const VT = [0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0];

// ---------- 1. 量綱 ----------
// live：長度 ×L、時間 ×Θ 後，s→L s、v→(L/Θ) v、a→(L/Θ²) a、avgVel→(L/Θ)、avgSpeed→(L/Θ)、dist→L
{
  const L = 100, Th = 1000; // m→cm，s→ms
  const p = { mode: "live", u: 2.5, a: -3, T: 10, vt: VT };
  const q = { mode: "live", u: 2.5 * L / Th, a: -3 * L / Th / Th, T: 10 * Th, vt: VT };
  let ok = true;
  for (const t of [0, 0.5, 0.8333, 3.7, 9.99, 10]) {
    const A = observe(p, t).obs, B = observe(q, t * Th).obs;
    ok &&= close(B.s, A.s * L) && close(B.dist, A.dist * L) && close(B.area, A.area * L)
      && close(B.v, A.v * L / Th) && close(B.speed, A.speed * L / Th) && close(B.a, A.a * L / Th / Th)
      && close(B.avgVel, A.avgVel * L / Th) && close(B.avgSpeed, A.avgSpeed * L / Th);
  }
  log("量綱(live) 長度×100、時間×1000 後各量按 L、L/Θ、L/Θ² 縮放:", ok);
  // draw：節點固定於整數秒，只能縮放長度（速度單位）；s、dist、v、a 皆 ×L
  const pd = { mode: "draw", T: 10, vt: [0, 1.5, -2, 0.5, 0.5, 3, 0, 0, 0, 0, 0] };
  const qd = { ...pd, vt: pd.vt.map(x => x * L) };
  let ok2 = true;
  for (const t of [0.3, 1, 2.5, 4.999, 7.2, 10]) {
    const A = observe(pd, t).obs, B = observe(qd, t).obs;
    ok2 &&= close(B.s, A.s * L) && close(B.dist, A.dist * L) && close(B.v, A.v * L) && close(B.a, A.a * L) && close(B.avgVel, A.avgVel * L);
  }
  log("量綱(draw) 節點速度×100 後 s、dist、v、a、avgVel 皆×100:", ok2);
}

// ---------- 2. 對稱 ----------
{
  // (u, a) → (−u, −a)：s、v、a、area、avgVel 反號；dist、speed、avgSpeed 不變
  let ok = true;
  for (const [u, a, T] of [[3, -9.81, 5], [-4.488447797246486, 5.315743356624498, 35.92592488505222], [0, 1, 10]]) {
    const p = { mode: "live", u, a, T, vt: VT }, q = { mode: "live", u: -u, a: -a, T, vt: VT };
    for (const t of [0, 0.1, 0.3058, 0.5, 2, 4.999, T - 0.001, T, T + 5]) {
      const A = observe(p, t).obs, B = observe(q, t).obs;
      ok &&= close(A.s, -B.s) && close(A.v, -B.v) && close(A.a, -B.a) && close(A.area, -B.area) && close(A.avgVel, -B.avgVel)
        && close(A.dist, B.dist) && close(A.speed, B.speed) && close(A.avgSpeed, B.avgSpeed);
    }
  }
  log("對稱(live) (u,a)→(−u,−a)：s、v、a、area、avgVel 反號，dist、speed、avgSpeed 不變:", ok);
  // 只反 u（a = 0）：s、v 反號
  let okU = true;
  for (const t of [0.5, 3, 9.999]) { const A = observe({ mode: "live", u: 2, a: 0, T: 10, vt: VT }, t).obs, B = observe({ mode: "live", u: -2, a: 0, T: 10, vt: VT }, t).obs; okU &&= close(A.s, -B.s) && close(A.v, -B.v) && close(A.dist, B.dist); }
  log("對稱(live) a=0 時 u→−u：s、v 反號、dist 不變:", okU);
  // 只反 a（u = 0）：s、v 反號
  let okA = true;
  for (const t of [0.5, 3, 9.999]) { const A = observe({ mode: "live", u: 0, a: 4, T: 10, vt: VT }, t).obs, B = observe({ mode: "live", u: 0, a: -4, T: 10, vt: VT }, t).obs; okA &&= close(A.s, -B.s) && close(A.v, -B.v) && close(A.dist, B.dist); }
  log("對稱(live) u=0 時 a→−a：s、v 反號、dist 不變:", okA);
  // draw：vt → −vt
  const vt = [2, 1.6, 1.2, 0.8, 0.4, 0, -0.4, -0.8, -1.2, -1.6, -2];
  const pd = { mode: "draw", T: 10, vt }, qd = { mode: "draw", T: 10, vt: vt.map(x => -x) };
  let ok2 = true;
  for (const t of [0, 0.7, 2.3, 5, 5.001, 7.7, 9.999, 10]) {
    const A = observe(pd, t).obs, B = observe(qd, t).obs;
    ok2 &&= close(A.s, -B.s) && close(A.v, -B.v) && close(A.a, -B.a) && close(A.dist, B.dist) && close(A.speed, B.speed) && close(A.avgSpeed, B.avgSpeed);
  }
  log("對稱(draw) vt→−vt：s、v、a 反號，dist、speed、avgSpeed 不變:", ok2);
  // 時間鏡像：奇對稱折線（scenario-below-axis）→ s(5+τ) = s(5−τ)，s(10) = 0，dist(10) = 10
  let ok3 = true;
  for (const tau of [0.5, 1, 2.25, 4.999]) ok3 &&= close(observe(pd, 5 + tau).obs.s, observe(pd, 5 - tau).obs.s);
  ok3 &&= close(observe(pd, 10).obs.s, 0) && close(observe(pd, 10).obs.dist, 10);
  log("對稱(draw) 奇對稱 v–t：s(5+τ)=s(5−τ)、s(10)=0、dist(10)=10:", ok3);
}

// ---------- 3. 極限 ----------
{
  // a = 0：s = u t，dist = |u| t，v = u，a = 0，avgVel = u
  let ok = true;
  for (const u of [2, -1.5, 0]) for (const t of [0.25, 1, 4, 9.5]) {
    const o = observe({ mode: "live", u, a: 0, T: 10, vt: VT }, t).obs;
    ok &&= close(o.s, u * t) && close(o.dist, Math.abs(u) * t) && close(o.v, u) && o.a === 0 && close(o.avgVel, u);
  }
  log("極限 a=0：s = u t，dist = |u| t，v = u，avgVel = u:", ok);
  // u = 0：s = ½ a t²，v² = 2 a s，dist = |s|（不反向）
  ok = true;
  for (const a of [1, -4.5, 9.81]) for (const t of [0.001, 0.5, 3, 9.999]) {
    const o = observe({ mode: "live", u: 0, a, T: 10, vt: VT }, t).obs;
    ok &&= close(o.s, 0.5 * a * t * t) && close(o.v * o.v, 2 * a * o.s) && close(o.dist, Math.abs(o.s));
  }
  log("極限 u=0：s = ½at²，v² = 2as，dist = |s|:", ok);
  // u = 0 且 a = 0：全部為 0
  ok = true;
  for (const t of [0, 1, 9.999, 10]) { const o = observe({ mode: "live", u: 0, a: 0, T: 10, vt: VT }, t).obs; for (const k of Object.keys(o)) ok &&= o[k] === 0; }
  log("極限 u=a=0：所有讀數恆為 0:", ok);
  // T → 2（滑桿下限）：t=2 幀凍結，之後 obs 恆定且 = 解析值；幀數 60001 內凍結後 58000 幀恆定
  {
    const p = { mode: "live", u: -4.5, a: 10, T: 2, vt: VT };
    const fr = simulate(p, 0.001, 60001);
    const i2 = fr.findIndex(f => f.t >= 2);
    let frozen = true; for (let i = i2; i < fr.length; i++) { if (fr[i].t !== 2) frozen = false; for (const k in fr[i].obs) if (fr[i].obs[k] !== fr[i2].obs[k]) frozen = false; }
    const o = fr[i2].obs;
    const okT2 = i2 === 2000 && frozen && close(o.v, -4.5 + 20) && close(o.s, -9 + 20) && close(o.dist, 1.0125 + Math.abs(o.s + 1.0125));
    log("極限 T=2（滑桿下限）：第 2000 幀起凍結、obs 恆定、v=15.5、s=11、dist 依變號分割:", okT2, "| s=" + o.s + " dist=" + o.dist + " v=" + o.v);
    // T = 60（滑桿上限）：末幀 t=60 恰為 T，s = 60u + 1800a 無 NaN
    const q = { mode: "live", u: 5, a: 10, T: 60, vt: VT };
    const fq = simulate(q, 0.001, 60001), last = fq[60000];
    log("極限 T=60（滑桿上限）：末幀 t=" + last.t + "，s=" + last.obs.s + "（期望 18300），v=" + last.obs.v + "（期望 605），有限:", last.t === 60 && close(last.obs.s, 18300) && close(last.obs.v, 605) && Object.values(last.obs).every(Number.isFinite));
  }
  // draw：T 長於節點範圍（T=13.3，節點到 10 s）→ t>10 後 v 恆為末值、a=0、s 線性增長
  {
    const p = { mode: "draw", T: 13.316564376147728, vt: [0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0] };
    const s10 = observe(p, 10).obs.s;
    let ok4 = true;
    for (const t of [10.001, 11, 12.5, 13.3, 13.316564376147728, 20]) { const o = observe(p, t).obs; ok4 &&= o.v === 0 && o.a === 0 && close(o.s, s10); }
    const p2 = { mode: "draw", T: 20, vt: [0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 1.5] };
    for (const t of [10.5, 15, 20]) { const o = observe(p2, t).obs; ok4 &&= o.v === 1.5 && o.a === 0 && close(o.s, observe(p2, 10).obs.s + 1.5 * (t - 10)); }
    log("極限(draw) T 超出節點範圍：v 保持末值、a=0、s 線性延伸（末值 0 與 1.5 兩例）:", ok4, "| s(10)=" + s10);
  }
  // draw 單一節點、雙節點
  {
    const o1 = observe({ mode: "draw", T: 5, vt: [2] }, 3).obs;
    const o2 = observe({ mode: "draw", T: 5, vt: [2, -2] }, 0.75).obs; // 段 m=−4，v=0 於 0.5 s：s=0.5+(−0.125)=0.375, dist=0.5+0.125=0.625
    log("極限(draw) 單節點 vt=[2]：s=6、v=2、a=0:", close(o1.s, 6) && o1.v === 2 && o1.a === 0, "| 雙節點 [2,−2] t=0.75：s=0.375、dist=0.625、v=−1、a=−4:", close(o2.s, 0.375) && close(o2.dist, 0.625) && close(o2.v, -1) && o2.a === -4);
  }
}

// ---------- 4. 規格驗證條件（以第二實作自身檢查） ----------
{
  // (a) v–t 線下面積 = s–t 位移變化：area(t2) − area(t1) = s(t2) − s(t1)，且 area = 數值積分 ∫v dt（辛普森，1e-4 步）
  let ok = true, maxErr = 0;
  const cases = [{ mode: "live", u: -4.488447797246486, a: 5.315743356624498, T: 40, vt: VT }, { mode: "draw", T: 10, vt: [2, 1.6, 1.2, 0.8, 0.4, 0, -0.4, -0.8, -1.2, -1.6, -2] }, { mode: "draw", T: 13.3, vt: VT }];
  for (const p of cases) for (const [t1, t2] of [[0, 3.3], [1.2, 7.7], [0, p.T - 0.5], [4, 9.999]]) {
    const N = 20000, h = (t2 - t1) / N; let sum = 0;
    for (let i = 0; i <= N; i++) { const w = i === 0 || i === N ? 1 : (i % 2 ? 4 : 2); sum += w * observe(p, t1 + i * h).obs.v; }
    const num = sum * h / 3;
    const A = observe(p, t1).obs, B = observe(p, t2).obs;
    const e = Math.max(Math.abs(num - (B.s - A.s)), Math.abs((B.area - A.area) - (B.s - A.s)));
    maxErr = Math.max(maxErr, e); ok &&= e < 1e-6;
  }
  log("驗證(a) 線下面積 = 位移變化（辛普森數值積分對照，最大差 " + maxErr.toExponential(2) + "）:", ok);
  // (b) 勻加速三條方程互相一致
  ok = true;
  for (const [u, a] of [[3, -9.81], [-4.49, 5.32], [2.9, 9.68], [0, 1]]) for (const t of [0.2, 1.3, 4.7, 9.999]) {
    const o = observe({ mode: "live", u, a, T: 10, vt: VT }, t).obs;
    ok &&= close(o.v, u + a * t) && close(o.s, u * t + 0.5 * a * t * t) && close(o.v * o.v, u * u + 2 * a * o.s);
  }
  log("驗證(b) v=u+at、s=ut+½at²、v²=u²+2as 互相一致:", ok);
  // (c) 未反向時 dist = |s|；反向後 dist > |s|
  {
    const p = { mode: "live", u: 3, a: -9.81, T: 5, vt: VT }; // 反向於 t = 3/9.81 ≈ 0.3058
    const tr = 3 / 9.81;
    let okc = true;
    for (const t of [0.1, 0.2, tr]) { const o = observe(p, t).obs; okc &&= close(o.dist, Math.abs(o.s)); }
    for (const t of [tr + 0.01, 0.5, 1, 4.999]) { const o = observe(p, t).obs; okc &&= o.dist > Math.abs(o.s) + 1e-9; }
    // 反向後解析：dist = 2·s_max − s，s_max = u²/(2|a|)
    const smax = 9 / (2 * 9.81); const o1 = observe(p, 1).obs;
    okc &&= close(o1.dist, 2 * smax - o1.s);
    log("驗證(c) 反向前 dist=|s|、反向後 dist>|s|、dist = 2·u²/(2|a|) − s:", okc);
  }
}

// ---------- 5. 幀時刻：主實作步進規則（t += min(dt, T−t)）與整數格點在 60001 幀內的最大偏差 ----------
{
  let worst = 0;
  for (const T of [10, 35.92592488505222, 60, 2]) {
    let t = 0;
    for (let k = 0; k < 60001; k++) { const tg = Math.min(k / 1000, T); worst = Math.max(worst, Math.abs(t - tg)); const h = t >= T ? 0 : Math.min(0.001, T - t); t = Math.min(t + h, T); }
  }
  log("幀時刻：累加步進 vs 整數格點在 60001 幀內最大偏差 " + worst.toExponential(2) + " s（對 v≈190 m/s 的 s 影響 ≤ " + (worst * 190).toExponential(2) + " m）");
}

fs.writeFileSync(path.join(root, "second-impl", "checks-output.txt"), out.join("\n"));
