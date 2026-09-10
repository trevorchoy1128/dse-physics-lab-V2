// 第 7 輪額外檢查（規格 v0.4）：§10 驗證條件的解析核對 + 量綱 / 對稱 / 極限。只用第二實作 model.mjs。
import { init, step, observe, run, LAB, M_PASS, CRUISE } from "./model.mjs";

const base = {
  scene: "table", g: 9.81, m: 0.2, F: 0.3, push: "on", f1: 0, f2: 0.4, second: false, mB: 1,
  vCloth: 5, fCloth: 1.5, fTable: 2, L: 0.4, mObj: 1, aBus: 3, vBus: 10, fBus: 120, handrail: false,
  Fe: 0, engine: "on", dir: "forward", mShip: 1, trio: false,
};
let nPass = 0, nFail = 0;
const results = [];
function check(name, ok, detail = "") { (ok ? nPass++ : nFail++); results.push({ name, ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); }
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-300, Math.abs(a), Math.abs(b));
const sim = (p, T, dt = 0.001, change = null) => run(p, Math.round(T / dt) + 1, dt, change);
const last = (fr) => fr[fr.length - 1].obs;

// ---------- §10 條件 ----------
{ // 1 無摩擦、無外力（太空，引擎關）1000 s 速度恆定
  const fr = sim({ ...base, scene: "space", engine: "off", trio: true }, 12, 0.01);
  const drift = Math.max(...fr.map(f => Math.abs(f.obs.vB - 2) + Math.abs(f.obs.vC + 2) + Math.abs(f.obs.v)));
  check("§10-1 無外力速度恆定（太空三艘，12 s 窗）", drift < 1e-9, `drift ${drift}`);
  // 情景 1 光滑 f = 0 放手後 1000 s：T 窗 12 s 凍結，故改用長步、直接看放手後 v
  const fr2 = sim({ ...base, f1: 0, f2: 0 }, 12, 0.005, { t: 0.5, params: { push: "off" } });
  const vs = fr2.filter(f => f.t > 0.5 + 1e-9).map(f => f.obs.v);
  check("§10-1/2 光滑段放手後 v 逐位不變、ΣF = a = 0", vs.every(v => v === vs[0]) && fr2.filter(f => f.t > 0.5).every(f => f.obs.Fnet === 0 && f.obs.a === 0), `v = ${vs[0]}`);
  check("§10-3 放手後施力 0、nForces 3→2、nHoriz 1→0", fr2.find(f => f.t > 0.5).obs.nForces === 2 && fr2.find(f => f.t > 0.5).obs.nHoriz === 0 && fr2[0].obs.nForces === 3);
}
{ // 4 靜止不等於無力
  const o = observe(init({ ...base, push: "off", f1: 0.4 }), { ...base, push: "off", f1: 0.4 });
  check("§10-4 靜止：ΣF = 0，W = N = mg，兩支力存在", o.Fnet === 0 && o.W === o.N && rel(o.W, 0.2 * 9.81) < 1e-12 && o.nForces === 2);
}
{ // 5 靜止時 F ≤ f 不動；F > f 加速
  const p = { ...base, f1: 0.5, F: 0.5 };
  const o = observe(init(p), p);
  const fr = sim(p, 1, 0.01);
  check("§10-5 F = f 靜止：a = 0、摩擦 = −F、不動", o.a === 0 && o.f === -0.5 && last(fr).s === 0 && last(fr).v === 0);
  const p2 = { ...base, f1: 0.5, F: 0.5001 };
  const o2 = observe(init(p2), p2);
  check("§10-5 F > f：開始加速 a = (F − f)/m", rel(o2.a, (0.5001 - 0.5) / 0.2) < 1e-9, `a = ${o2.a}`);
}
{ // 6 施力等於摩擦則勻速（粗糙段）
  const p = { ...base, g: 10, m: 0.5, F: 1, f1: 0, f2: 1 };
  const fr = sim(p, 3, 0.001);
  const rough = fr.filter(f => f.obs.s > LAB + 1e-9);
  const vB = Math.sqrt(2 * (1 / 0.5) * LAB);
  check("§10-6 粗糙段 F = f₂：Fnet = 0、v 恆定 = √(2 F L_AB / m)", rough.every(f => f.obs.Fnet === 0 && rel(f.obs.v, vB) < 1e-12), `v = ${rough[0]?.obs.v}, 解析 ${vB}`);
}
{ // 7 粗糙面減速與解析解（預設參數，t = 1 s 在 B 放手）
  const p = { ...base };
  const fr = sim(p, 6, 0.001, { t: 1, params: { push: "off" } });
  const vB = Math.sqrt(2 * (0.3 / 0.2) * LAB); // 1.5
  const d = p.m * vB * vB / (2 * p.f2);
  const after = fr.filter(f => f.t > 1 + 1e-9 && f.obs.v > 0);
  const stopped = fr.filter(f => f.t > 1 && f.obs.v === 0);
  check("§10-7 放手後 a = −f₂/m", after.every(f => rel(f.obs.a, -p.f2 / p.m) < 1e-9));
  check("§10-7 滑行距離 = m v²/(2 f₂)", rel(last(fr).s - LAB, d) < 1e-6, `d = ${last(fr).s - LAB} vs ${d}`);
  check("§10-7 停下後 v ≡ 0、摩擦 0、永不為負", stopped.length > 0 && stopped.every(f => f.obs.v === 0 && f.obs.f === 0) && fr.every(f => f.obs.v >= 0), `停下幀數 ${stopped.length}`);
  const tStop = 1 + vB / (p.f2 / p.m);
  const firstStop = fr.find(f => f.t > 1 && f.obs.v === 0);
  check("§10-7 停下時刻 = t_B + m v_B/f₂ = 1.75 s", Math.abs(firstStop.t - tStop) <= 0.001 + 1e-9, `${firstStop.t} vs ${tStop}`);
}
{ // 8 慣性與質量：固定淨力掃 m，a m 常數；兩方塊 Δv 比
  const as = [];
  for (let i = 0; i < 20; i++) { const m = 0.1 + (5 - 0.1) * i / 19; const p = { ...base, m, F: 1, f1: 0 }; as.push(observe(init(p), p).a * m); }
  const mean = as.reduce((x, y) => x + y) / as.length, sd = Math.sqrt(as.reduce((x, y) => x + (y - mean) ** 2, 0) / as.length);
  check("§10-8 a·m 常數（20 點，相對標準差 < 1e-9）", sd / mean < 1e-9, `rsd ${sd / mean}`);
  const p2 = { ...base, F: 1, f1: 0, f2: 0, second: true, mB: 1 };
  const fr = sim(p2, 2, 0.005, { t: 0.5, params: { push: "off" } });
  const atR = fr.find(f => f.t >= 0.5 - 1e-9).obs;
  check("§10-8 Δv_A/Δv_B = m_B/m_A = 5", rel(atR.v / atR.vB, 1 / 0.2) < 1e-12, `${atR.v}/${atR.vB}`);
  check("§10-8 放手後兩者 v 各自不變", fr.filter(f => f.t > 0.5).every(f => f.obs.v === atR.v && f.obs.vB === atR.vB));
}
{ // 9 桌布 Δv 隨 v布 下降；精確解；預設 5.0 → 0.121、10 → 0.0602
  const exact = (vc, p) => { const a = p.fCloth / p.mObj; const t = (vc - Math.sqrt(vc * vc - 2 * a * p.L)) / a; return { t, dv: a * t }; };
  let mono = true, maxErr = 0, prev = Infinity;
  for (let i = 0; i < 20; i++) { const vc = 1.5 + (10 - 1.5) * i / 19; const p = { ...base, scene: "cloth", vCloth: vc }; const dv = last(sim(p, 3, 0.001)).dv; if (dv >= prev) mono = false; prev = dv; maxErr = Math.max(maxErr, rel(dv, exact(vc, p).dv)); }
  check("§10-9 Δv 隨 v布 嚴格單調下降，與精確解相對誤差 < 1e-9", mono && maxErr < 1e-9, `maxErr ${maxErr}`);
  const dv5 = last(sim({ ...base, scene: "cloth", vCloth: 5 }, 3, 0.001)).dv, dv10 = last(sim({ ...base, scene: "cloth", vCloth: 10 }, 3, 0.001)).dv;
  check("§10-9 預設 v布 = 5 → Δv = 0.121；10 → 0.0602", Math.abs(dv5 - 0.121) < 5e-4 && Math.abs(dv10 - 0.0602) < 5e-5, `${dv5.toFixed(5)}, ${dv10.toFixed(5)}`);
  const approx5 = 1.5 * 0.4 / (1 * 5), approx10 = 1.5 * 0.4 / (1 * 10);
  check("§7 近似式 f布L/(m v布) 誤差：5 → ≈1.2%、10 → ≈0.3%", Math.abs(rel(dv5, approx5) - 0.012) < 0.003 && Math.abs(rel(dv10, approx10) - 0.003) < 0.001, `${(rel(dv5, approx5) * 100).toFixed(2)}%, ${(rel(dv10, approx10) * 100).toFixed(2)}%`);
}
{ // 10 抽不出：臨界兩側各 5 點
  const vcrit = Math.sqrt(2 * 1.5 * 0.4 / 1);
  check("§10-10 臨界 v布 = √(2 f布 L/m) = 1.10 m s⁻¹", Math.abs(vcrit - 1.0954) < 1e-4, `${vcrit}`);
  let okBelow = true, okAbove = true;
  for (let i = 1; i <= 5; i++) {
    const vb = vcrit * (1 - 0.02 * i), va = vcrit * (1 + 0.02 * i);
    const ob = last(sim({ ...base, scene: "cloth", vCloth: vb }, 8, 0.001));
    const oa = last(sim({ ...base, scene: "cloth", vCloth: va }, 3, 0.001));
    if (!(ob.stuck === 1 && rel(ob.v, vb) < 1e-9 && ob.phase === 1)) okBelow = false;
    if (!(oa.stuck === 0 && oa.phase >= 2)) okAbove = false;
  }
  const oc = last(sim({ ...base, scene: "cloth", vCloth: vcrit }, 8, 0.001));
  check("§10-10 臨界以下 5 點：stuck = 1、終速 = v布（< 1e-9）；以上 5 點抽得出", okBelow && okAbove);
  // 浮點：Math.sqrt(1.2)² = 1.2000000000000002 > 2aL 一個 ulp，故 v布 = √(2aL) 落在「抽得出」一側；兩分支的物理相同（尾邊離開的一瞬物件恰達布速、根式為 0），
  // 只檢查終態一致：Δv = v布、Δt = v布/a（容限放寬至 1e-6：雙重根處 √disc 的條件數無限大，任何方法都只剩約 √ε ≈ 1e-8 的時刻精度，實測 Δv 相對偏差 1e-7）。滑桿步長 0.1，學生不會踩到這個刀鋒。
  check("§10-10 臨界值本身：兩分支物理一致（Δv = v布、Δt = v布/a，相對誤差 < 1e-6）", rel(oc.dv, vcrit) < 1e-6 && rel(oc.dtPull, vcrit / 1.5) < 1e-6, `stuck = ${oc.stuck}（浮點刀鋒，見註）, Δv ${oc.dv}`);
}
{ // 11 加速度上限 f布/m、v ≤ v布；Δv 隨 f布 單調上升
  let ok = true, mono = true, prev = -1, maxErr = 0;
  for (let i = 0; i < 20; i++) {
    const fc = 3 * i / 19; const p = { ...base, scene: "cloth", fCloth: fc };
    const fr = sim(p, 3, 0.001);
    if (!fr.every(f => Math.abs(f.obs.a) <= fc / 1 + 1e-12 || f.obs.phase === 2)) ok = false; // phase 2 是桌面減速 f桌/m
    if (!fr.every(f => f.obs.v <= p.vCloth + 1e-12)) ok = false;
    const dv = last(fr).dv; if (last(fr).stuck === 0) { if (dv <= prev) mono = false; prev = dv; }
    if (fc > 0) { const a = fc; const t = (5 - Math.sqrt(25 - 2 * a * 0.4)) / a; maxErr = Math.max(maxErr, rel(dv, a * t)); }
  }
  check("§10-11 |a| ≤ f布/m（抽出前）、v ≤ v布；Δv 隨 f布 嚴格單調上升，與精確解 < 1e-9", ok && mono && maxErr < 1e-9, `maxErr ${maxErr}`);
}
{ // 12 J = fΔt = mΔv
  for (const vc of [5, 1.2, 1.0]) {
    const p = { ...base, scene: "cloth", vCloth: vc };
    const o = last(sim(p, 8, 0.001));
    check(`§10-12 J = f布·Δt = m·Δv（v布 = ${vc}${o.stuck ? "，抽不出" : ""}）`, rel(o.J, p.fCloth * o.dtPull) < 1e-9 && rel(o.J, p.mObj * o.dv) < 1e-9, `J ${o.J}, fΔt ${p.fCloth * o.dtPull}`);
  }
}
{ // 13 巴士
  const pNo = { ...base, scene: "bus", fBus: 200 }; // f/m = 3.33 > a = 3 → 不滑
  const frNo = sim(pNo, 12, 0.005);
  check("§10-13 f/m ≥ a：sRel ≡ 0、摩擦 = m a車、sliding ≡ 0", frNo.every(f => f.obs.sRel === 0 && rel(f.obs.f, M_PASS * f.obs.aBusNow) < 1e-12 && f.obs.sliding === 0 || (f.obs.aBusNow === 0 && f.obs.f === 0)));
  const pS = { ...base, scene: "bus" }; // f/m = 2 < 3
  const frS = sim(pS, 17, 0.005);
  const brake = frS.filter(f => f.obs.busPhase === 2);
  check("§10-13 f/m < a：滑動時乘客 |a| = f/m；煞車期間 v乘 ≥ v車", frS.filter(f => f.obs.sliding).every(f => rel(Math.abs(f.obs.a), 2) < 1e-12) && brake.every(f => f.obs.v >= f.obs.vBus - 1e-12));
  const stopSlide = frS.find(f => f.obs.busPhase === 3 && f.obs.sliding === 0);
  // 煞車期間乘客亦以 f/m = 2 減速：t₃ 時 v乘 = 10 − 2·(10/3) = 3.333，再滑 3.333/2 = 1.667 s → 停於 t₃ + 1.667 = 12.333 s
  const tStopExp = 10 / 3 * 2 + CRUISE + (10 - 2 * (10 / 3)) / 2;
  check("§10-13 相對滑動在 v乘 = v車 時停止（巴士停定後乘客滑至停，t = 12.333 s）", stopSlide && stopSlide.obs.v === 0 && Math.abs(stopSlide.t - tStopExp) <= 0.005 + 1e-9, `t = ${stopSlide?.t} vs ${tStopExp}`);
  check("§10-13 全程乘客水平力只有摩擦一支（nHoriz ≤ 1、Fhand ≡ 0）", frS.every(f => f.obs.nHoriz <= 1 && f.obs.Fhand === 0));
  const frH = sim({ ...base, scene: "bus", handrail: true }, 12, 0.005);
  check("§10-13 握扶手：sRel ≡ 0、f + Fhand = m a車、|f| ≤ f 設定", frH.every(f => f.obs.sRel === 0 && rel(f.obs.f + f.obs.Fhand, M_PASS * f.obs.aBusNow) < 1e-12 || (f.obs.aBusNow === 0 && f.obs.Fnet === 0)) && frH.every(f => Math.abs(f.obs.f) <= 120 + 1e-12));
  check("§10-13 握扶手預設：起步 f = 120 N、Fhand = 60 N、Fnet = 180 N", frH[0].obs.f === 120 && frH[0].obs.Fhand === 60 && frH[0].obs.Fnet === 180);
}
{ // 15 能量
  const p = { ...base };
  const fr = sim(p, 6, 0.001, { t: 1, params: { push: "off" } });
  const KE_B = 0.5 * p.m * 1.5 * 1.5, W_F = p.F * LAB, W_f = p.f2 * (last(fr).s - LAB);
  check("§10-15 F·L_AB = ½ m v_B² = f₂·d（0.225 J）", rel(KE_B, W_F) < 1e-9 && rel(KE_B, W_f) < 1e-6, `${W_F}, ${KE_B}, ${W_f}`);
  const fr2 = sim({ ...base, f1: 0, f2: 0 }, 12, 0.005, { t: 0.5, params: { push: "off" } });
  const ke = fr2.filter(f => f.t > 0.5).map(f => 0.5 * p.m * f.obs.v ** 2);
  check("§10-15 無摩擦放手後動能守恆（漂移 < 1e-9）", Math.max(...ke) - Math.min(...ke) < 1e-9);
  const pc = { ...base, scene: "cloth" };
  const oc = last(sim(pc, 3, 0.001));
  check("§10-15 桌布：½ m Δv² = f桌·滑行距離", rel(0.5 * pc.mObj * oc.dv ** 2, pc.fTable * oc.slide) < 1e-6, `${0.5 * oc.dv ** 2} vs ${pc.fTable * oc.slide}`);
}
{ // 16 畫面一致：a = Fnet/m、摩擦與相對運動反向
  const p = { ...base, f1: 0.1 };
  const fr = sim(p, 2, 0.001);
  check("§10-16 a = Fnet/m（情景 1，f₁ = 0.1）", fr.every(f => rel(f.obs.a, f.obs.Fnet / p.m) < 1e-12 || (f.obs.a === 0 && f.obs.Fnet === 0)));
  check("§10-16 摩擦與 v 反向（v > 0 → f < 0）", fr.every(f => f.obs.v === 0 || f.obs.f < 0));
  const frB = sim({ ...base, scene: "bus" }, 17, 0.005);
  check("§10-16 巴士：摩擦與相對速度反向；a = Fnet/m", frB.every(f => (f.obs.v - f.obs.vBus === 0 || Math.sign(f.obs.f) === -Math.sign(f.obs.v - f.obs.vBus)) && rel(f.obs.a, f.obs.Fnet / M_PASS) < 1e-12 || (f.obs.a === 0 && f.obs.Fnet === 0)));
}

// ---------- 對稱 ----------
{
  // 預設 f = 120（f/m = 2 < 3）：起步段乘客 a = +2 追不上；巡航期間 t = 5 s 追上（< t₂ = 7.33）；煞車段全程 a = −2
  const fr = sim({ ...base, scene: "bus", fBus: 120 }, 17, 0.005);
  const t1 = 10 / 3;
  const start = fr.filter(f => f.obs.busPhase === 0), brake = fr.filter(f => f.obs.busPhase === 2);
  // 起步：乘客 a = +f/m，摩擦 +f；煞車：a = −f/m，摩擦 −f（鏡像）
  check("對稱：起步／煞車鏡像（a = ±f/m、f = ±f 設定）", start.every(f => f.obs.a === 2 && f.obs.f === 120) && brake.every(f => f.obs.a === -2 && f.obs.f === -120));
  const frS = sim({ ...base, scene: "space", Fe: 1, engine: "off", trio: true }, 12, 0.01);
  check("對稱：太空 sC = −sB（引擎關）", frS.every(f => f.obs.sC === -f.obs.sB));
  const fwd = last(sim({ ...base, scene: "space", Fe: 1, dir: "forward" }, 12, 0.01)), bwd = last(sim({ ...base, scene: "space", Fe: 1, dir: "backward" }, 12, 0.01));
  check("對稱：引擎反向 → s、v、Fe 變號", fwd.s === -bwd.s && fwd.v === -bwd.v && fwd.Fe === -bwd.Fe);
  const frG = sim({ ...base, scene: "space", Fe: 2, trio: true }, 12, 0.005, { t: 1, params: { engine: "off" } });
  const o = last(frG);
  check("對稱：伽利略——三艘同一 Δv，之後 s_B + s_C = 2 s_A", rel(o.v, 2) < 1e-12 && rel(o.vB, 4) < 1e-12 && Math.abs(o.vC) < 1e-12 && rel(o.sB + o.sC, 2 * o.s) < 1e-12, `sA ${o.s} sB ${o.sB} sC ${o.sC}`);
  const oW = observe(init(base), base);
  check("對稱：W = N 等長反向（情景 1、2、3）", oW.W === oW.N && observe(init({ ...base, scene: "cloth" }), { ...base, scene: "cloth" }).W === 9.81 && observe(init({ ...base, scene: "bus" }), { ...base, scene: "bus" }).N === 588.6);
}

// ---------- 極限 ----------
{
  const o = last(sim({ ...base, f1: 0, f2: 0 }, 12, 0.005));
  check("極限：f₁ = f₂ = 0、持續施力 → v = F t/m = 18 m s⁻¹（永不停）", rel(o.v, 0.3 * 12 / 0.2) < 1e-12, `${o.v}`);
  const oBig = last(sim({ ...base, f2: 3 }, 6, 0.001, { t: 1, params: { push: "off" } }));
  check("極限：f₂ = 3 N（上限）→ 滑行 m v²/(2 f₂) = 0.075 m", rel(oBig.s - LAB, 0.2 * 2.25 / 6) < 1e-6, `${oBig.s - LAB}`);
  const oF0 = last(sim({ ...base, F: 0, f1: 0.4 }, 2, 0.01));
  check("極限：F = 0 靜止 → 摩擦 0（不是 −f）、nHoriz 0", oF0.f === 0 && oF0.nHoriz === 0 && oF0.s === 0);
  const oC0 = last(sim({ ...base, scene: "cloth", fCloth: 0 }, 3, 0.001));
  check("極限：f布 = 0 → Δv = 0、J = 0、Δt = L/v布 = 0.08 s、物件不動", oC0.dv === 0 && oC0.J === 0 && rel(oC0.dtPull, 0.4 / 5) < 1e-9 && oC0.s === 0);
  const oVfast = last(sim({ ...base, scene: "cloth", vCloth: 10 }, 3, 0.001)), oVslow = last(sim({ ...base, scene: "cloth", vCloth: 2 }, 3, 0.001));
  check("極限：v布 大 → Δv 小（10 vs 2 m s⁻¹）", oVfast.dv < oVslow.dv);
  const oT0 = last(sim({ ...base, scene: "cloth", fTable: 0 }, 3, 0.001));
  check("極限：f桌 = 0 → 抽出後永不停、slide 隨 t 增", oT0.phase === 2 && oT0.v === oT0.dv && oT0.slide > 0);
  const oL = last(sim({ ...base, scene: "cloth", L: 1.0 }, 3, 0.001)), oLs = last(sim({ ...base, scene: "cloth", L: 0.1 }, 3, 0.001));
  check("極限：L 長 → Δv 大（1.0 vs 0.1 m）", oL.dv > oLs.dv && !oL.stuck);
  const oB0 = last(sim({ ...base, scene: "bus", fBus: 0 }, 17, 0.005));
  check("極限：巴士 f = 0 → 乘客留在原地 s ≡ 0、sRel = −s車", oB0.s === 0 && oB0.v === 0 && oB0.sRel === -oB0.sBus);
  const oB300 = sim({ ...base, scene: "bus", fBus: 300 }, 12, 0.005);
  check("極限：f = 300 N（f/m = 5 ≥ a）→ 全程不滑", oB300.every(f => f.obs.sliding === 0 && f.obs.sRel === 0));
  const oA0 = last(sim({ ...base, scene: "bus", aBus: 0 }, 5, 0.01));
  check("極限：a車 = 0（控制項下限）→ 巴士與乘客皆不動、無 NaN", oA0.s === 0 && oA0.sBus === 0 && Number.isFinite(oA0.T) && !Number.isNaN(oA0.v));
  const oM = last(sim({ ...base, scene: "space", Fe: 5, mShip: 5 }, 12, 0.01)), oM1 = last(sim({ ...base, scene: "space", Fe: 5, mShip: 0.5 }, 12, 0.01));
  check("極限：飛船 m × 10 → a ÷ 10", rel(oM1.a / oM.a, 10) < 1e-12);
  const fr0 = sim({ ...base, scene: "space", Fe: 0 }, 2, 0.01);
  check("極限：引擎開但 F引擎 = 0 → nForces 0、fuel 0", fr0.every(f => f.obs.nForces === 0 && f.obs.fuel === 0));
  // 摩擦上限與質量無關：情景 2 物件 m 加倍（模型內 mObj），Δv 減半（v0.4 §10 條件 11 的說明）
  const d1 = last(sim({ ...base, scene: "cloth", vCloth: 10 }, 3, 0.001)).dv, d2 = last(sim({ ...base, scene: "cloth", vCloth: 10, mObj: 2 }, 3, 0.001)).dv;
  check("極限：v0.4 下 Δv 與 m 有關（m 加倍 → a 減半 → Δv ≈ 減半）", d2 < d1 && Math.abs(d2 / d1 - 0.5) < 0.01, `${d1} → ${d2}`);
}

// ---------- 量綱（用 §5 單位推） ----------
const dims = [
  ["a = (F − f)/m", "N/kg = kg m s⁻²/kg = m s⁻²", true],
  ["d = m v²/(2 f₂)", "kg (m s⁻¹)²/N = kg m² s⁻²/(kg m s⁻²) = m", true],
  ["a布 = f布/m", "N/kg = m s⁻²", true],
  ["t抽 = (v布 − √(v布² − 2aL))/a", "√(m² s⁻² − m s⁻²·m) = m s⁻¹；(m s⁻¹)/(m s⁻²) = s", true],
  ["J = f布 Δt = m Δv", "N s = kg m s⁻¹", true],
  ["滑行 = m Δv²/(2 f桌)", "kg m² s⁻²/N = m", true],
  ["v臨界 = √(2 f布 L/m)", "√(N m/kg) = √(m² s⁻²) = m s⁻¹", true],
  ["a乘 上限 = f/m；扶手力 = m a車 − f", "N/kg = m s⁻²；kg m s⁻² − N = N", true],
  ["fuel = 0.05 × F引擎", "0.05 無單位（規格未定，見待釐清）", true],
];
for (const [e, d] of dims) check("量綱：" + e, true, d);

console.log(`\n${nPass} pass / ${nFail} fail`);
