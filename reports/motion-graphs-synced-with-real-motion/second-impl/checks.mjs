// 第 9 輪額外檢查（只用第二實作 model.mjs，不讀主實作程式）：
// nodeDt 規則在 T = 10 兩側的連續性、凍結、量綱、對稱、極限（T 掃描 2–60、全零 vt）、規格驗證條件、主實作逐幀梯形誤差上界估算
import fs from "node:fs";
import path from "node:path";
import { observe, simulate, nodeDtOf } from "./model.mjs";
const root = "C:/Users/trevor/dev/dse-physics-lab/reports/motion-graphs-synced-with-real-motion";
const out = [];
const log = (...a) => { const s = a.join(" "); out.push(s); console.log(s); };
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const VT = [0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0];
const VT2 = [2, 1.6, 1.2, 0.8, 0.4, 0, -0.4, -0.8, -1.2, -1.6, -2];
const VT3 = [0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 1.5];
const KEYS = ["s", "dist", "v", "a", "speed", "area", "avgSpeed", "avgVel"];
// 解析：draw 模式在 t = T 的位移 = nodeDt × Σ 梯形（T > 10 恰走完 10 段；T ≤ 10 走 ⌊T⌋ 段 + 部分段）
function sAnalytic(vt, T) {
  const h = nodeDtOf(T), tau = T / h; let s = 0;
  const full = Math.min(10, Math.floor(tau));
  for (let i = 0; i < full; i++) s += h * (vt[i] + vt[i + 1]) / 2;
  if (full < 10) { const f = tau - full, v0 = vt[full], dv = vt[full + 1] - vt[full]; s += h * (v0 * f + 0.5 * dv * f * f); }
  else s += vt[10] * (T - 10 * h);
  return s;
}

// ---------- 0. nodeDt 規則本身 ----------
{
  const cases = [[2, 1], [9.999, 1], [10, 1], [10.001, 1.0001], [13.316564376147728, 1.3316564376147728], [20, 2], [60, 6]];
  let ok = true; for (const [T, h] of cases) ok &&= close(nodeDtOf(T), h, 1e-15);
  log("nodeDt = max(1, T/10)：T = 2, 9.999, 10, 10.001, 13.3166, 20, 60 → 1, 1, 1, 1.0001, 1.33166, 2, 6:", ok);
}

// ---------- 1. 連續性：T = 10 兩側（檢查 ①） ----------
{
  // 同一 vt，T = 10 對 T = 10 + ε：在 t ∈ [0, 10] 的共同格點上，s、v 的最大差應隨 ε 線性趨零；a 差為 O(ε)（斜率 Δv/nodeDt）
  const lines = [];
  let okLin = true, prev = null;
  for (const eps of [1e-1, 1e-2, 1e-3, 1e-6, 1e-9]) {
    const p0 = { mode: "draw", T: 10, vt: VT2 }, p1 = { mode: "draw", T: 10 + eps, vt: VT2 };
    let ds = 0, dv = 0, da = 0, dd = 0;
    for (let k = 0; k <= 10000; k++) { const t = k / 1000; const A = observe(p0, t).obs, B = observe(p1, t).obs; ds = Math.max(ds, Math.abs(A.s - B.s)); dv = Math.max(dv, Math.abs(A.v - B.v)); da = Math.max(da, Math.abs(A.a - B.a)); dd = Math.max(dd, Math.abs(A.dist - B.dist)); }
    lines.push(`ε=${eps}: max|Δs|=${ds.toExponential(2)} max|Δv|=${dv.toExponential(2)} max|Δa|=${da.toExponential(2)} max|Δdist|=${dd.toExponential(2)} (Δs/ε=${(ds / eps).toFixed(3)}, Δv/ε=${(dv / eps).toFixed(3)})`);
    // 線性：Δs/ε、Δv/ε 應有界，且 ε 縮小 10 倍時 Δ 亦縮小約 10 倍
    if (prev) okLin &&= ds <= prev.ds * (eps / prev.eps) * 1.5 + 1e-15 && dv <= prev.dv * (eps / prev.eps) * 1.5 + 1e-15;
    prev = { eps, ds, dv };
  }
  log("連續性 T=10 對 T=10+ε（t∈[0,10] 共 10001 格點，vt 奇對稱折線）：");
  for (const l of lines) log("   " + l);
  log("   Δs、Δv 隨 ε 線性趨零（ε 每縮小 10 倍 Δ 亦縮小 ≈10 倍）:", okLin);
  // T = 10 − ε 側：nodeDt 恆為 1，t < T 時 obs 與 T = 10 逐位相同
  let okBelow = true;
  for (const eps of [1e-3, 1e-6]) { const p0 = { mode: "draw", T: 10, vt: VT2 }, p1 = { mode: "draw", T: 10 - eps, vt: VT2 }; for (let k = 0; k < 9999; k++) { const t = k / 1000; const A = observe(p0, t).obs, B = observe(p1, t).obs; for (const key of KEYS) okBelow &&= A[key] === B[key]; } }
  log("連續性 T=10−ε 側：nodeDt 仍為 1，t < T 的 obs 與 T=10 逐位相同:", okBelow);
  // 另一 vt（末節點 1.5）在 T=10 兩側：T=10 凍結於節點 10；T=10+ε 節點 10 在 10+ε，兩者在 t=10 的 v、a 相差 O(ε)
  const q0 = observe({ mode: "draw", T: 10, vt: VT3 }, 10).obs, q1 = observe({ mode: "draw", T: 10.001, vt: VT3 }, 10).obs;
  log("   VT3（末節點 1.5）t=10：T=10 → v=" + q0.v + " a(凍結,左段)=" + q0.a + "；T=10.001 → v=" + q1.v.toFixed(6) + " a=" + q1.a.toFixed(6) + "；|Δv|=" + Math.abs(q0.v - q1.v).toExponential(2) + "，|Δa|=" + Math.abs(q0.a - q1.a).toExponential(2), close(q0.v, q1.v, 2e-3) && close(q0.a, q1.a, 2e-3));
}

// ---------- 2. 凍結（檢查 ②） ----------
{
  let ok = true; const lines = [];
  for (const p of [{ mode: "draw", T: 13.316564376147728, vt: VT }, { mode: "draw", T: 7.5, vt: VT2 }, { mode: "draw", T: 20, vt: VT3 }, { mode: "live", u: -4.5, a: 10, T: 2, vt: VT }, { mode: "live", u: 5, a: 10, T: 60, vt: VT }]) {
    const fr = simulate(p, 0.001, 60001); const i = fr.findIndex(f => f.t >= p.T);
    let frozen = true; for (let j = i; j < fr.length; j++) { if (fr[j].t !== p.T) frozen = false; for (const k of KEYS) if (fr[j].obs[k] !== fr[i].obs[k] || !Number.isFinite(fr[j].obs[k])) frozen = false; }
    const o = fr[i].obs;
    let aExp;
    if (p.mode === "draw") { const h = nodeDtOf(p.T), iL = Math.min(9, Math.ceil(p.T / h) - 1); aExp = (p.vt[iL + 1] - p.vt[iL]) / h; } else aExp = p.a;
    const sExp = p.mode === "draw" ? sAnalytic(p.vt, p.T) : p.u * p.T + 0.5 * p.a * p.T * p.T;
    const pass = frozen && fr[i].t === p.T && i === Math.ceil(p.T / 0.001 - 1e-9) && close(o.a, aExp) && close(o.s, sExp);
    ok &&= pass;
    lines.push(`   ${p.mode} T=${p.T}: 首個凍結幀 idx=${i} t===T:${fr[i].t === p.T} 之後恆定:${frozen} a=${o.a}（期望 ${aExp}） s=${o.s}（解析 ${sExp}） v=${o.v}`);
  }
  log("凍結：首幀 t === T、之後 t 與 8 鍵恆定且有限、a 取 T⁻ 段斜率、s 等於解析值:", ok);
  for (const l of lines) log(l);
}

// ---------- 3. 量綱 ----------
{
  const L = 100, Th = 1000;
  const p = { mode: "live", u: 2.5, a: -3, T: 10, vt: VT }, q = { mode: "live", u: 2.5 * L / Th, a: -3 * L / Th / Th, T: 10 * Th, vt: VT };
  let ok = true;
  for (const t of [0, 0.5, 0.8333, 3.7, 9.99, 10]) { const A = observe(p, t).obs, B = observe(q, t * Th).obs; ok &&= close(B.s, A.s * L) && close(B.dist, A.dist * L) && close(B.area, A.area * L) && close(B.v, A.v * L / Th) && close(B.speed, A.speed * L / Th) && close(B.a, A.a * L / Th / Th) && close(B.avgVel, A.avgVel * L / Th) && close(B.avgSpeed, A.avgSpeed * L / Th); }
  log("量綱(live) 長度×100、時間×1000 後各量按 L、L/Θ、L/Θ² 縮放:", ok);
  // draw、T > 10：nodeDt = T/10 隨 T 縮放，故可同時縮放時間：T→ΘT、vt→vt·L/Θ，則 s(Θt)=L·s(t)、v=L/Θ、a=L/Θ²
  const Th2 = 3, pd = { mode: "draw", T: 13.316564376147728, vt: VT3 }, qd = { mode: "draw", T: 13.316564376147728 * Th2, vt: VT3.map(x => x * L / Th2) };
  let ok2 = true;
  for (const t of [0.3, 1.3316564376147728, 2.5, 4.999, 7.2, 10, 13, 13.316564376147728]) { const A = observe(pd, t).obs, B = observe(qd, t * Th2).obs; ok2 &&= close(B.s, A.s * L) && close(B.dist, A.dist * L) && close(B.v, A.v * L / Th2) && close(B.a, A.a * L / Th2 / Th2) && close(B.avgVel, A.avgVel * L / Th2) && close(B.avgSpeed, A.avgSpeed * L / Th2); }
  log("量綱(draw, T>10) T×3、vt×100/3 後 s×100、v×100/3、a×100/9、avg×100/3（含節點與凍結幀）:", ok2);
  // draw、T ≤ 10：節點固定於整數秒，只能縮放長度
  const pe = { mode: "draw", T: 10, vt: VT2 }, qe = { mode: "draw", T: 10, vt: VT2.map(x => x * L) };
  let ok3 = true;
  for (const t of [0.3, 1, 2.5, 4.999, 7.2, 10]) { const A = observe(pe, t).obs, B = observe(qe, t).obs; ok3 &&= close(B.s, A.s * L) && close(B.dist, A.dist * L) && close(B.v, A.v * L) && close(B.a, A.a * L) && close(B.avgVel, A.avgVel * L); }
  log("量綱(draw, T≤10) vt×100 後 s、dist、v、a、avgVel 皆×100:", ok3);
}

// ---------- 4. 對稱（檢查 ③） ----------
{
  let ok = true;
  for (const [u, a, T] of [[3, -9.81, 5], [-4.488447797246486, 5.315743356624498, 35.92592488505222], [0, 1, 10]]) {
    const p = { mode: "live", u, a, T, vt: VT }, q = { mode: "live", u: -u, a: -a, T, vt: VT };
    for (const t of [0, 0.1, 0.3058, 0.5, 2, 4.999, T - 0.001, T, T + 5]) { const A = observe(p, t).obs, B = observe(q, t).obs; ok &&= close(A.s, -B.s) && close(A.v, -B.v) && close(A.a, -B.a) && close(A.area, -B.area) && close(A.avgVel, -B.avgVel) && close(A.dist, B.dist) && close(A.speed, B.speed) && close(A.avgSpeed, B.avgSpeed); }
  }
  log("對稱(live) (u,a)→(−u,−a)：s、v、a、area、avgVel 反號，dist、speed、avgSpeed 不變:", ok);
  // draw vt → −vt：T = 2, 7.5, 10, 10.001, 13.3166, 20, 60，每 7 幀抽樣至 60 s
  let ok2 = true, worst = 0;
  for (const T of [2, 7.5, 10, 10.001, 13.316564376147728, 20, 60]) for (const vt of [VT, VT2, VT3]) {
    const p = { mode: "draw", T, vt }, q = { mode: "draw", T, vt: vt.map(x => -x) };
    for (let k = 0; k < 60001; k += 7) { const t = k / 1000; const A = observe(p, t).obs, B = observe(q, t).obs;
      const e = Math.max(Math.abs(A.s + B.s), Math.abs(A.v + B.v), Math.abs(A.a + B.a), Math.abs(A.area + B.area), Math.abs(A.avgVel + B.avgVel), Math.abs(A.dist - B.dist), Math.abs(A.speed - B.speed), Math.abs(A.avgSpeed - B.avgSpeed));
      worst = Math.max(worst, e); ok2 &&= e <= 1e-12; }
  }
  log("對稱(draw) vt→−vt：s、v、a、area、avgVel 反號，dist、speed、avgSpeed 不變（T = 2…60 七值 × 三組 vt，最大差 " + worst.toExponential(2) + "）:", ok2);
  // 時間鏡像：奇對稱折線 VT2 在 T = 10 與 T > 10 下 s(T/2 + τ) = s(T/2 − τ)、s(T) = 0、dist(T) = T
  let ok3 = true;
  for (const T of [10, 13.316564376147728, 20, 60]) { const p = { mode: "draw", T, vt: VT2 }; for (const tau of [0.1, 1, T / 4, T / 2 - 0.001]) ok3 &&= close(observe(p, T / 2 + tau).obs.s, observe(p, T / 2 - tau).obs.s); ok3 &&= close(observe(p, T).obs.s, 0) && close(observe(p, T).obs.dist, T); }
  log("對稱(draw) 奇對稱 v–t 在 T = 10, 13.3, 20, 60：s(T/2+τ)=s(T/2−τ)、s(T)=0、dist(T)=T:", ok3);
}

// ---------- 5. 極限 ----------
{
  // 全零 vt：所有讀數恆為 0（含凍結後），T = 2, 10, 13.3, 60
  let ok = true;
  for (const T of [2, 10, 13.316564376147728, 60]) { const fr = simulate({ mode: "draw", T, vt: new Array(11).fill(0) }, 0.001, 60001); for (const f of fr) for (const k of KEYS) ok &&= f.obs[k] === 0; }
  log("極限(draw) 全零 vt：60001 幀 × 8 鍵全為 0（T = 2, 10, 13.3, 60）:", ok);
  // T 由 2 到 60 掃描（整數 + 隨機小數）：節點 v = vt[k]、段內 a = Δv/nodeDt、s(T) 解析、無 NaN、|a| ≤ 6/nodeDt
  let ok2 = true, worstS = 0; const Ts = []; for (let T = 2; T <= 60; T++) Ts.push(T); let seed = 7; for (let i = 0; i < 20; i++) { seed = (seed * 16807) % 2147483647; Ts.push(2 + 58 * seed / 2147483647); }
  for (const T of Ts) for (const vt of [VT, VT2, VT3]) {
    const p = { mode: "draw", T, vt }, h = nodeDtOf(T);
    for (let k = 0; k <= 10; k++) { const tk = k * h; if (tk <= T) { const o = observe(p, tk).obs; ok2 &&= close(o.v, vt[k]); if (k < 10 && tk < T) ok2 &&= close(o.a, (vt[k + 1] - vt[k]) / h); if (k < 10 && tk + h / 2 < T) ok2 &&= close(observe(p, tk + h / 2).obs.a, (vt[k + 1] - vt[k]) / h); } }
    const o = observe(p, T).obs; const e = Math.abs(o.s - sAnalytic(vt, T)); worstS = Math.max(worstS, e); ok2 &&= e < 1e-9;
    for (const k of KEYS) ok2 &&= Number.isFinite(o[k]);
    ok2 &&= Math.abs(o.a) <= 6 / h + 1e-12;
  }
  log("極限(draw) T 掃描 2–60（59 整數 + 20 隨機）× 三組 vt：節點 v=vt[k]、段中 a=Δv/nodeDt、s(T) 等於解析梯形和（最大差 " + worstS.toExponential(2) + "）、無 NaN:", ok2);
  // T ≤ 10 尾段：末節點 1.5、T = 10 凍結於節點 10；t > 10 被凍結，故尾段在 T ≤ 10 下不可達
  const pt = { mode: "draw", T: 10, vt: VT3 }; const o10 = observe(pt, 10).obs, o12 = observe(pt, 12);
  log("極限(draw) T=10 末節點 1.5：t=10 v=" + o10.v + "、a(凍結,左段 1.5)=" + o10.a + "；t=12 被凍結至 t=" + o12.t + "，尾段（v 保持 vt[10]、a=0）在 T ≤ 10 下不可達:", o10.v === 1.5 && o10.a === 1.5 && o12.t === 10);
  // live 極限
  let ok3 = true;
  for (const u of [2, -1.5, 0]) for (const t of [0.25, 1, 4, 9.5]) { const o = observe({ mode: "live", u, a: 0, T: 10, vt: VT }, t).obs; ok3 &&= close(o.s, u * t) && close(o.dist, Math.abs(u) * t) && close(o.v, u) && o.a === 0 && close(o.avgVel, u); }
  for (const a of [1, -4.5, 9.81]) for (const t of [0.001, 0.5, 3, 9.999]) { const o = observe({ mode: "live", u: 0, a, T: 10, vt: VT }, t).obs; ok3 &&= close(o.s, 0.5 * a * t * t) && close(o.v * o.v, 2 * a * o.s) && close(o.dist, Math.abs(o.s)); }
  for (const t of [0, 1, 9.999, 10]) { const o = observe({ mode: "live", u: 0, a: 0, T: 10, vt: VT }, t).obs; for (const k of KEYS) ok3 &&= o[k] === 0; }
  log("極限(live) a=0：s=ut、dist=|u|t；u=0：s=½at²、v²=2as；u=a=0：全 0:", ok3);
  // draw 退化：單節點、雙節點（nodeDt = 1）
  const o1 = observe({ mode: "draw", T: 5, vt: [2] }, 3).obs, o2 = observe({ mode: "draw", T: 5, vt: [2, -2] }, 0.75).obs;
  log("極限(draw) 單節點 vt=[2]：s=6、v=2、a=0:", close(o1.s, 6) && o1.v === 2 && o1.a === 0, "| 雙節點 [2,−2] t=0.75：s=0.375、dist=0.625、v=−1、a=−4:", close(o2.s, 0.375) && close(o2.dist, 0.625) && close(o2.v, -1) && o2.a === -4);
}

// ---------- 6. 規格驗證條件（以第二實作自身檢查） ----------
{
  let ok = true, maxErr = 0;
  const cases = [{ mode: "live", u: -4.488447797246486, a: 5.315743356624498, T: 40, vt: VT }, { mode: "draw", T: 10, vt: VT2 }, { mode: "draw", T: 13.316564376147728, vt: VT }, { mode: "draw", T: 60, vt: VT3 }];
  for (const p of cases) for (const [t1, t2] of [[0, 3.3], [1.2, 7.7], [0, p.T - 0.5], [4, 9.999]]) {
    const N = 20000, hh = (t2 - t1) / N; let sum = 0;
    for (let i = 0; i <= N; i++) { const w = i === 0 || i === N ? 1 : (i % 2 ? 4 : 2); sum += w * observe(p, t1 + i * hh).obs.v; }
    const num = sum * hh / 3, A = observe(p, t1).obs, B = observe(p, t2).obs;
    const e = Math.max(Math.abs(num - (B.s - A.s)), Math.abs((B.area - A.area) - (B.s - A.s))); maxErr = Math.max(maxErr, e); ok &&= e < 1e-6;
  }
  log("驗證(a) 線下面積 = 位移變化（辛普森 20000 步對照，4 個運動 × 4 區間，最大差 " + maxErr.toExponential(2) + "）:", ok);
  ok = true;
  for (const [u, a] of [[3, -9.81], [-4.49, 5.32], [2.9, 9.68], [0, 1]]) for (const t of [0.2, 1.3, 4.7, 9.999]) { const o = observe({ mode: "live", u, a, T: 10, vt: VT }, t).obs; ok &&= close(o.v, u + a * t) && close(o.s, u * t + 0.5 * a * t * t) && close(o.v * o.v, u * u + 2 * a * o.s); }
  log("驗證(b) v=u+at、s=ut+½at²、v²=u²+2as 互相一致:", ok);
  {
    const p = { mode: "live", u: 3, a: -9.81, T: 5, vt: VT }, tr = 3 / 9.81; let okc = true;
    for (const t of [0.1, 0.2, tr]) { const o = observe(p, t).obs; okc &&= close(o.dist, Math.abs(o.s)); }
    for (const t of [tr + 0.01, 0.5, 1, 4.999]) { const o = observe(p, t).obs; okc &&= o.dist > Math.abs(o.s) + 1e-9; }
    const smax = 9 / (2 * 9.81), o1 = observe(p, 1).obs; okc &&= close(o1.dist, 2 * smax - o1.s);
    // draw 反向：VT2 於 T = 10 在 5 s 反向；T = 20 在 10 s 反向
    for (const T of [10, 20]) { const q = { mode: "draw", T, vt: VT2 }; for (const t of [T / 4, T / 2]) { const o = observe(q, t).obs; okc &&= close(o.dist, Math.abs(o.s)); } for (const t of [T / 2 + 0.01, 0.9 * T]) { const o = observe(q, t).obs; okc &&= o.dist > Math.abs(o.s) + 1e-9; } }
    log("驗證(c) 反向前 dist=|s|、反向後 dist>|s|（live 上拋；draw VT2 於 T=10、20）:", okc);
  }
}

// ---------- 7. 主實作逐幀積分在節點跨幀的誤差上界（依 random-2 觀察到的 Δa·dt²·θ(1−θ)/2 型式估算） ----------
{
  const dt = 0.001;
  const h = nodeDtOf(13.316564376147728), da = 1 / h;
  log("主實作逐幀積分誤差（節點落在幀內時）：random-2 每個斜率改變節點最大 |Δa|·dt²/8 = " + (da * dt * dt / 8).toExponential(2) + " m，3 個節點合計上界 " + (3 * da * dt * dt / 8).toExponential(2) + " m（觀察到 8.72e-8）");
  const hw = nodeDtOf(10.001), daw = 12 / hw;
  log("   最壞情況（vt = ±3 交替、T = 10.001）：每節點 ≤ " + (daw * dt * dt / 8).toExponential(2) + " m，10 節點合計 ≤ " + (10 * daw * dt * dt / 8).toExponential(2) + " m（顯示解析度 0.01 m 以下三個數量級）");
}

fs.writeFileSync(path.join(root, "second-impl", "checks-output.txt"), out.join("\n"));
