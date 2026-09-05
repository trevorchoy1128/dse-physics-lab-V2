import fs from "node:fs";
import path from "node:path";
import { observe, simulate, simulateMainRule } from "./model.mjs";
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

// ---------- 5. 第 2/5 輪：凍結後 a 保持 T⁻ 值（第 5 輪起凍結幀 t 恰等於 T），最後一幀 a 與 v 的一致性（主實作與第二實作各自檢驗） ----------
{
  for (const src of ["data", "second-impl"]) {
    for (const run of index.runs) {
      const F = JSON.parse(fs.readFileSync(path.join(root, src, run.name + ".json"), "utf8")).frames;
      const T = run.params.T, dt = index.dt;
      const last = F[F.length - 1];
      // 凍結前最後一幀（t < T − dt/2）與凍結後第一幀
      let iFreeze = F.findIndex(fr => fr.t >= T - dt / 2);
      if (iFreeze < 0) iFreeze = F.length - 1;
      const pre = F[iFreeze - 1], at = F[iFreeze];
      // (a) 凍結後所有幀 a、v、s 完全相同（狀態凍結）
      let frozen = true;
      for (let i = iFreeze; i < F.length; i++) frozen &&= F[i].obs.a === at.obs.a && F[i].obs.v === at.obs.v && F[i].obs.s === at.obs.s;
      // (b) a 跨越 T 不跳變：a(T) = a(T − dt)（即 T⁻ 的值）
      const aHold = at.obs.a === pre.obs.a;
      // (c) 最後一幀 a 與 v 一致
      let aExpected, vExpected, note;
      if (run.params.mode === "draw") {
        const vt = run.params.vt, seg = Math.min(Math.ceil(T) - 1, vt.length - 2);
        aExpected = seg >= vt.length - 1 ? 0 : vt[seg + 1] - vt[seg];   // 折線末段斜率
        vExpected = vt[Math.min(Math.round(T), vt.length - 1)];         // 節點值
        note = "折線末段斜率";
      } else {
        aExpected = run.params.a;
        vExpected = run.params.u + run.params.a * T;                     // v = u + aT
        note = "v = u + aT";
      }
      const aOk = close(last.obs.a, aExpected, 1e-9);
      const vOk = close(last.obs.v, vExpected, 1e-9);
      // (d) 差分斜率：(v(T) − v(T−dt)) / dt 應等於最後一幀的 a（T⁻ 段內）
      const slope = (at.obs.v - pre.obs.v) / (at.t - pre.t);
      const slopeOk = close(slope, last.obs.a, 1e-6);
      log(`末幀[${src}/${run.name}] 凍結後狀態不變:${frozen} a(T)=a(T−dt):${aHold} a_last=${last.obs.a.toFixed(6)} 期望 ${aExpected.toFixed(6)}:${aOk} v_last=${last.obs.v.toFixed(6)} 期望(${note}) ${vExpected.toFixed(6)}:${vOk} 差分斜率 ${slope.toFixed(6)}=a_last:${slopeOk}`);
    }
  }
}
fs.writeFileSync(path.join(root, "second-impl", "checks-output.txt"), out.join("\n"));

// ---------- 6. 第 4 輪：歸零（|x| < 1e-9 → 0）專項 ----------
{
  const { snapZero, SNAP_KEYS, SNAP_EPS } = await import("./model.mjs");
  // (a) 歸零規則本身：冪等、只動 |x|<1e-9、反號對稱
  const o1 = { s: 5e-10, dist: -9.99e-10, v: 1e-9, a: 3e-10, speed: 1e-9, area: 5e-10, avgSpeed: 2e-9, avgVel: -5e-10 };
  const z1 = snapZero(o1);
  log("歸零規則：|x|<1e-9 歸零、恰 1e-9 不歸零、a 不動、speed=|v|:",
    z1.s === 0 && z1.dist === 0 && z1.v === 1e-9 && z1.a === 3e-10 && z1.speed === 1e-9 && z1.avgSpeed === 2e-9 && z1.avgVel === 0);
  log("歸零規則：冪等:", JSON.stringify(snapZero(z1)) === JSON.stringify(z1));
  const neg = Object.fromEntries(Object.entries(o1).map(([k, x]) => [k, -x]));
  const zn = snapZero(neg);
  log("歸零規則：反號對稱:", SNAP_KEYS.every(k => zn[k] === -z1[k] || (zn[k] === 0 && z1[k] === 0)));
  // (b) 主實作每個被歸零的幀：以主實作自身的 t（累加值，非整數格點）代入解析式，真值必須 < 1e-9；
  //     反之主實作非零的幀，解析真值必須 ≥ 1e-9（近閾值 ±1e-11 內視為歧義，另計）
  for (const run of index.runs) {
    const A = JSON.parse(fs.readFileSync(path.join(root, "data", run.name + ".json"), "utf8")).frames;
    let nZero = 0, bad = [], badNotZero = [], ambiguous = 0, maxTrueAtZero = 0, minTrueAtNonzero = Infinity;
    for (const f of A) {
      const truth = observe(run.params, f.t).obs;   // 用主實作的 t
      for (const k of SNAP_KEYS) {
        const x = f.obs[k], tv = Math.abs(truth[k]);
        if (x === 0) {
          nZero++;
          maxTrueAtZero = Math.max(maxTrueAtZero, tv);
          if (tv >= SNAP_EPS) bad.push({ t: f.t, k, truth: truth[k] });
        } else {
          minTrueAtNonzero = Math.min(minTrueAtNonzero, tv);
          if (tv < SNAP_EPS - 1e-11) badNotZero.push({ t: f.t, k, truth: truth[k], main: x });
          else if (tv < SNAP_EPS) ambiguous++;
        }
      }
    }
    log(`歸零[${run.name}] 主實作歸零(幀×鍵)=${nZero} 歸零處真值最大=${maxTrueAtZero.toExponential(2)} 非零處真值最小=${minTrueAtNonzero === Infinity ? "—" : minTrueAtNonzero.toExponential(2)} 歸零但真值≥1e-9:${bad.length} 真值<1e-9但未歸零:${badNotZero.length} 近閾值歧義:${ambiguous}`
      + (bad.length ? " " + JSON.stringify(bad.slice(0, 3)) : "") + (badNotZero.length ? " " + JSON.stringify(badNotZero.slice(0, 3)) : ""));
  }
  // (c) 解析值恰為 0 的幀（奇對稱 v–t 的 s(10)、area-not-distance 的 s(9) 與 v(4.5)、below-axis 的 v(5)）主實作是否恰為 0
  const want = [
    ["scenario-below-axis", 10, ["s", "area", "avgVel"]],
    ["scenario-below-axis", 5, ["v", "speed"]],
    ["scenario-area-not-distance", 9, ["s", "area", "avgVel"]],
    ["scenario-area-not-distance", 4.5, ["v", "speed"]],
  ];
  for (const [name, tt, ks] of want) {
    const A = JSON.parse(fs.readFileSync(path.join(root, "data", name + ".json"), "utf8")).frames;
    const f = A[Math.round(tt / index.dt)];
    log(`解析零[${name}] 幀 t=${f.t}: ` + ks.map(k => `${k}=${f.obs[k]}(恰0:${f.obs[k] === 0})`).join(" "));
  }
  // (d) random-2（draw, T=5，T 恰落在節點 5）凍結幀：a 取左段 vt[5]−vt[4]=0 而非右段 −1；v 應為節點值 3
  {
    const A = JSON.parse(fs.readFileSync(path.join(root, "data", "random-2.json"), "utf8")).frames;
    const pre = A[4999], at = A[5000], last = A[10000];
    const p = index.runs.find(r => r.name === "random-2").params;
    const mine = observe(p, 5).obs;
    log(`random-2 凍結幀 主 t=${at.t} a=${at.obs.a} v=${at.obs.v} s=${at.obs.s}；T−dt a=${pre.obs.a} v=${pre.obs.v}；末幀 a=${last.obs.a} v=${last.obs.v}；第二 a=${mine.a} v=${mine.v} s=${mine.s}`);
    log(`random-2 主 v(凍結) − 3 = ${(at.obs.v - 3).toExponential(3)}；若以未截斷 t=${at.t} 代入右段 v=3−(t−5)：${(3 - (at.t - 5) - at.obs.v).toExponential(3)}（差 0 表示主實作用未截斷 t 在右段插值）`);
    log("random-2 a 凍結 = 左段斜率 0（兩實作一致）、v 與 3 差 < 1e-12:", at.obs.a === 0 && mine.a === 0 && Math.abs(at.obs.v - 3) < 1e-12 && Math.abs(last.obs.v - 3) < 1e-12);
  }
}
fs.writeFileSync(path.join(root, "second-impl", "checks-output.txt"), out.join("\n"));

// ---------- 7. 第 5 輪：dt 不整除 T（dt = 0.0007）以主實作步進規則（最後一步 h = T − t）跑，檢查末幀 t === T、v/a 一致、無 NaN ----------
{
  const dt7 = 0.0007;
  const cases = index.runs.filter(r => ["default", "scenario-v-zero-a-not", "scenario-below-axis", "random-2", "random-4"].includes(r.name)).map(r => ({ name: r.name, params: r.params }));
  cases.push({ name: "draw-T20-beyond-nodes", params: { mode: "draw", u: 0, a: 0, T: 20, vt: [0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0] } });
  for (const run of cases) {
    const p = run.params, T = p.T;
    const nStepsToT = Math.ceil(T / dt7 - 1e-9);
    const frames = nStepsToT + 50;
    const F = simulateMainRule(p, dt7, frames);
    const last = F[F.length - 1];
    let nonFinite = 0, afterTnotT = 0, firstAtT = -1, frozenSame = true;
    for (let i = 0; i < F.length; i++) {
      if (!Number.isFinite(F[i].t)) nonFinite++;
      for (const k in F[i].obs) if (!Number.isFinite(F[i].obs[k])) nonFinite++;
      if (F[i].t === T && firstAtT < 0) firstAtT = i;
      if (firstAtT >= 0 && i >= firstAtT) { if (F[i].t !== T) afterTnotT++; for (const k in F[i].obs) if (F[i].obs[k] !== F[firstAtT].obs[k]) frozenSame = false; }
    }
    const pre = F[firstAtT - 1], at = F[firstAtT];
    const lastStep = T - pre.t;
    const ref = observe(p, T).obs;
    const sameAsRef = Object.keys(ref).every(k => at.obs[k] === ref[k]);
    let vExp, aExp, note;
    if (p.mode === "draw") { const m = p.vt.length - 1; if (T >= m) { vExp = p.vt[m]; aExp = T > m ? 0 : p.vt[m] - p.vt[m - 1]; note = T > m ? "超出末節點 v 恆定、a=0" : "末節點值、末段斜率"; } else { const i0 = Math.floor(T); vExp = p.vt[i0] + (p.vt[i0 + 1] - p.vt[i0]) * (T - i0); aExp = Number.isInteger(T) ? p.vt[i0] - p.vt[i0 - 1] : p.vt[i0 + 1] - p.vt[i0]; note = "折線 T 值、T⁻ 段斜率"; } }
    else { vExp = p.u + p.a * T; aExp = p.a; note = "v = u + aT"; }
    const vOk = close(at.obs.v, vExp), aOk = at.obs.a === aExp;
    const slope = (at.obs.v - pre.obs.v) / lastStep, slopeOk = close(slope, at.obs.a, 1e-6);
    let maxDiffCommon = 0, nCommon = 0;
    for (let k = 0; k * 0.007 < T; k++) { const tt = k * 0.007; const g = observe(p, tt).obs; const i = Math.round(tt / dt7); if (i < F.length && Math.abs(F[i].t - tt) < 1e-9) { nCommon++; for (const kk in g) maxDiffCommon = Math.max(maxDiffCommon, Math.abs(F[i].obs[kk] - g[kk])); } }
    log("dt=0.0007[" + run.name + "] T=" + T + " 幀數=" + frames + " 首個 t=T 幀=" + firstAtT + "（預期 " + nStepsToT + "）T−h 幀 t=" + pre.t + " 最後一步 h=" + lastStep.toExponential(6) + "（< dt:" + (lastStep < dt7) + "） 末幀 t=" + last.t + "（===T:" + (last.t === T) + "） 凍結後 t≠T:" + afterTnotT + " 非有限值:" + nonFinite + " 凍結後恆定:" + frozenSame + " 與 observe(p,T) 完全相同:" + sameAsRef + " v=" + at.obs.v + "（期望 " + note + " " + vExp + ":" + vOk + "） a=" + at.obs.a + "（期望 " + aExp + ":" + aOk + "） 差分斜率=" + slope.toFixed(6) + "=a:" + slopeOk + " 共同時刻 " + nCommon + " 幀最大差=" + maxDiffCommon.toExponential(2));
  }
}
fs.writeFileSync(path.join(root, "second-impl", "checks-output.txt"), out.join("\n"));
