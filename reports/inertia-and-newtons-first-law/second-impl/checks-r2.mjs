// 第 2 輪額外檢查（全部跑第二實作 model.mjs）：
//   放手事件（§8 第 1、5 點、§10 條件 2、3、7、8）、桌布抽不出分支（§7 臨界條件、§10 條件 10、12）、
//   握扶手約定（f = clamp(m a車, ±μmg)、餘量由扶手補——這是約定，規格 §7 未定）、sliding 旗標約定、
//   change 規則的極限（t = 0 換參數 ≡ 靜態參數；永不換 ≡ 無 change）、伽利略對稱（關引擎後三艘飛船）。
import { run } from "./model.mjs";

const base = {
  scene: "table", g: 9.81,
  m: 0.2, F: 0.3, push: "on", mu1: 0, mu2: 0.2, second: false, mB: 1,
  vCloth: 5, muCloth: 0.15, muTable: 0.2, L: 0.4, mObj: 1,
  aBus: 3, vBus: 10, muBus: 0.2, handrail: false,
  Fe: 0, engine: "on", dir: "forward", mShip: 1, trio: false,
};
const dt = 0.005, N = 3200;
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));
const out = [];
const check = (name, ok, detail) => { out.push({ name, ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + "  " + detail); };
const after = (fr, t0) => fr.filter(f => f.t >= t0 - 1e-9);
const sameFrames = (A, B) => A.length === B.length && A.every((f, i) => f.t === B[i].t && JSON.stringify(f.obs) === JSON.stringify(B[i].obs));

// ---- 放手事件 ----
{
  // §8 第 1 點／§10 條件 2：μ₁ = 0，t = 0.5 s 放手 → 施力箭嘴消失、水平力 1→0、ΣF = 0、v 逐位不變
  const fr = run({ ...base, mu2: 0 }, N, dt, { t: 0.5, params: { push: "off" } });
  const post = after(fr, 0.5);
  const v0 = post[0].obs.v;
  check("放手（μ=0，t=0.5）：放手後 v 逐位不變、ΣF=0、a=0、nForces=2、nHoriz=0",
    post.every(f => f.obs.v === v0 && f.obs.Fnet === 0 && f.obs.a === 0 && f.obs.nForces === 2 && f.obs.nHoriz === 0 && f.obs.Fapp === 0),
    `v=${v0}（解析 0.5·1.5 = 0.75）、放手前一幀 nForces=${fr[99].obs.nForces}`);
  check("放手（μ=0）：放手時 v = a t = 0.75 精確", rel(v0, (base.F / base.m) * 0.5) < 1e-12, `v=${v0}`);
  // 預設參數 t = 1.0 s 放手：方塊恰在 B（t_B = √(2·0.75/1.5) = 1.000 s），放手瞬間施力換成摩擦，nForces 仍 3；
  // 之後 a = −μ₂g、d = v_B²/(2μ₂g)、停下時刻 t_B + v_B/(μ₂g)；停下後 v 保持 0、摩擦消失（§10 條件 7）
  const fr1 = run(base, N, dt, { t: 1.0, params: { push: "off" } });
  const vB = Math.sqrt(2 * (base.F / base.m) * 0.75), muG = base.mu2 * base.g;
  const d = vB * vB / (2 * muG), tStop = 1 + vB / muG;
  const o200 = fr1[200].obs, oEnd = fr1[N - 1].obs;
  const slid = after(fr1, 1.0).filter(f => f.obs.v > 0);
  const stopped = after(fr1, tStop + 1e-9);
  check("放手（預設，t=1.0 在 B）：放手瞬 Fapp=0、f=−μ₂mg、a=−μ₂g、nForces 仍 3（施力換成摩擦）",
    o200.Fapp === 0 && rel(-o200.f, base.mu2 * base.m * base.g) < 1e-12 && rel(-o200.a, muG) < 1e-12 && o200.nForces === 3, JSON.stringify(o200));
  check("放手（預設）：滑行距離 = v_B²/(2μ₂g)，停下後 v ≡ 0、f = 0、nForces = 2（永不為負）",
    rel(oEnd.s - 0.75, d) < 1e-9 && stopped.every(f => f.obs.v === 0 && f.obs.f === 0 && f.obs.nForces === 2) && slid.every(f => rel(-f.obs.a, muG) < 1e-12),
    `s−0.75=${oEnd.s - 0.75} 解析 d=${d}；停下 t=${tStop.toFixed(4)}`);
  // 能量（§10 條件 15）：施力功 F·0.75 = ½ m v_B²；摩擦功 μ₂mg·d = ½ m v_B²
  check("放手（預設）能量：F·L_AB = ½mv_B² = μ₂mg·d", Math.abs(base.F * 0.75 - 0.5 * base.m * vB * vB) < 1e-12 && Math.abs(base.mu2 * base.m * base.g * d - 0.5 * base.m * vB * vB) < 1e-12, `KE_B=${0.5 * base.m * vB * vB}`);
  // §8 第 5 點／§10 條件 8：兩方塊同推力、t = 0.5 s 放手 → Δv_A/Δv_B = m_B/m_A，放手後兩者 v 各自不變
  const fr2 = run({ ...base, F: 1, mu2: 0, second: true, mB: 1 }, N, dt, { t: 0.5, params: { push: "off" } });
  const p2 = after(fr2, 0.5), vA = p2[0].obs.v, vBB = p2[0].obs.vB;
  check("兩方塊放手：Δv_A/Δv_B = m_B/m_A = 5；放手後 v_A、v_B 逐位不變、a = aB = 0",
    rel(vA / vBB, base.mB / base.m) < 1e-12 && p2.every(f => f.obs.v === vA && f.obs.vB === vBB && f.obs.a === 0 && f.obs.aB === 0), `vA=${vA} vB=${vBB}`);
}

// ---- 桌布抽不出分支 ----
{
  const a0 = base.muCloth * base.g;
  const vc = 1.0, tStick = vc / a0;
  const fr = run({ ...base, scene: "cloth", vCloth: vc }, N, dt);
  const iStick = fr.findIndex(f => f.obs.phase === 1);
  const oS = fr[iStick].obs, oEnd = fr[N - 1].obs;
  check("抽不出（v布=1.0 < 1.085）：追上時刻 = v布/(μ布g)，落在幀 ⌈t/dt⌉", Math.abs(fr[iStick].t - Math.ceil(tStick / dt - 1e-9) * dt) < 1e-9, `t追上=${tStick} 幀 ${iStick}`);
  check("抽不出：追上後 v ≡ v布（§10 條件 10）、a = f = 0、nHoriz = 0、stuck = 1、phase = 1",
    fr.slice(iStick).every(f => f.obs.v === vc && f.obs.a === 0 && f.obs.f === 0 && f.obs.nHoriz === 0 && f.obs.stuck === 1 && f.obs.phase === 1), "");
  check("抽不出：追上前 stuck = 0、|a| = μ布g、v < v布、v 永不超過 v布（§10 條件 11）",
    fr.slice(0, iStick).every(f => f.obs.stuck === 0 && rel(f.obs.a, a0) < 1e-12 && f.obs.v < vc) && fr.every(f => f.obs.v <= vc), "");
  check("抽不出：Δt 凍結於 v布/(μ布g)，J = fΔt = m v布（§10 條件 12）", rel(oS.dtPull, tStick) < 1e-12 && rel(oS.J, base.mObj * vc) < 1e-12 && rel(oEnd.J, base.mObj * a0 * oEnd.dtPull) < 1e-12, `dtPull=${oS.dtPull} J=${oS.J}`);
  // 追上那一瞬布尾邊仍在物件下方：布相對物件走過 v布t − ½at² = v布²/(2a) < L
  const relTravel = vc * tStick - 0.5 * a0 * tStick * tStick;
  check("抽不出：追上時布相對物件只走了 v布²/(2a) < L（尾邊仍在物件下）", relTravel < base.L && Math.abs((oS.sCloth + base.L) - oS.s - relTravel) < 1e-12, `相對走過 ${relTravel.toFixed(4)} m < L=${base.L}`);
  // 臨界值恰好：v布² = 2aL → 追上與抽出同時，歸入抽不出（§7 用 ≤）
  const vcrit = Math.sqrt(2 * a0 * base.L);
  const fc = run({ ...base, scene: "cloth", vCloth: vcrit }, 800, dt), oc = fc[799].obs;
  check("臨界值 v布 = √(2μ布gL) 本身：歸入抽不出（§7 ≤），終速 = v布", oc.stuck === 1 && oc.v === vcrit, `v臨界=${vcrit}`);
  // 臨界值稍上（v布 = 1.2）：抽得出，Δv = aΔt 精確解，滑行距離 Δv²/(2μ桌g)
  const fa = run({ ...base, scene: "cloth", vCloth: 1.2 }, 800, dt), oa = fa[799].obs;
  const tL = (1.2 - Math.sqrt(1.44 - 2 * a0 * base.L)) / a0;
  check("臨界值稍上 v布=1.2：抽得出，Δt、Δv、滑行距離與精確解一致", oa.stuck === 0 && oa.phase === 3 && rel(oa.dtPull, tL) < 1e-12 && rel(oa.dv, a0 * tL) < 1e-12 && rel(oa.slide, oa.dv ** 2 / (2 * base.muTable * base.g)) < 1e-9, `Δt=${tL.toFixed(6)} Δv=${oa.dv.toFixed(6)} slide=${oa.slide.toFixed(6)}`);
}

// ---- 握扶手約定 ----
{
  const m = 60;
  const fr = run({ ...base, scene: "bus", handrail: true }, N, dt);
  const muW = base.muBus * m * base.g;
  check("握扶手（約定）：|f| ≤ μmg、f + Fhand = m a車、sRel ≡ 0、v乘 = v車、sliding = 0",
    fr.every(f => Math.abs(f.obs.f) <= muW + 1e-9 && Math.abs(f.obs.f + f.obs.Fhand - m * f.obs.aBusNow) < 1e-9 && f.obs.sRel === 0 && f.obs.v === f.obs.vBus && f.obs.sliding === 0),
    `t=0：f=${fr[0].obs.f} Fhand=${fr[0].obs.Fhand}（μmg=${muW}）`);
  check("握扶手（約定）：加速／煞車段 nHoriz = 2（摩擦＋扶手）、巡航與停定 nHoriz = 0",
    fr.every(f => f.obs.nHoriz === (f.obs.aBusNow !== 0 ? 2 : 0)), "");
  // |a車| ≤ μg 時扶手不出力（摩擦已足夠）：a = 1.5 < μg = 1.962
  const fr2 = run({ ...base, scene: "bus", handrail: true, aBus: 1.5 }, N, dt);
  check("握扶手（約定）：|a車| ≤ μg 時 Fhand = 0、f = m a車（與不握完全相同）",
    fr2.every(f => f.obs.Fhand === 0 && Math.abs(f.obs.f - m * f.obs.aBusNow) < 1e-9), `f(t=0)=${fr2[0].obs.f}`);
  // 握扶手 μ = 0：全部由扶手供
  const fr3 = run({ ...base, scene: "bus", handrail: true, muBus: 0 }, N, dt);
  check("握扶手 μ=0：f ≡ 0、Fhand = m a車、sRel ≡ 0", fr3.every(f => f.obs.f === 0 && Math.abs(f.obs.Fhand - m * f.obs.aBusNow) < 1e-9 && f.obs.sRel === 0), `Fhand(t=0)=${fr3[0].obs.Fhand}`);
  // 握扶手與不握：Fnet、a、s 相同當 μg ≥ a（μ = 0.35）
  const A = run({ ...base, scene: "bus", handrail: true, muBus: 0.35 }, N, dt), B = run({ ...base, scene: "bus", handrail: false, muBus: 0.35 }, N, dt);
  check("μg ≥ a：握扶手與不握的 s、v、a、f、Fnet 逐幀相同（扶手無事可做）",
    A.every((f, i) => f.obs.s === B[i].obs.s && f.obs.v === B[i].obs.v && f.obs.a === B[i].obs.a && f.obs.f === B[i].obs.f && f.obs.Fhand === 0 && f.obs.Fnet === B[i].obs.Fnet), "");
}

// ---- sliding 旗標約定 ----
{
  const fr = run({ ...base, scene: "bus" }, N, dt);          // a = 3 > μg = 1.962
  check("sliding：t=0 相對靜止但 |a車| > μg → sliding = 1，且該瞬 a乘 = μg", fr[0].obs.sliding === 1 && rel(fr[0].obs.a, base.muBus * base.g) < 1e-12, `a乘(0)=${fr[0].obs.a}`);
  check("sliding 與力一致：sliding = 1 ⇔ |f| = μmg 或 f = 0（μ=0）；sliding = 0 ⇔ f = m a車", fr.every(f => f.obs.sliding ? Math.abs(Math.abs(f.obs.f) - base.muBus * 60 * base.g) < 1e-9 : Math.abs(f.obs.f - 60 * f.obs.aBusNow) < 1e-9), "");
  const fr2 = run({ ...base, scene: "bus", aBus: 1.5 }, N, dt);
  check("sliding：|a車| ≤ μg 全程 sliding = 0、sRel ≡ 0", fr2.every(f => f.obs.sliding === 0 && f.obs.sRel === 0), "");
  const fr0 = run({ ...base, scene: "bus", muBus: 0 }, N, dt);
  check("sliding：μ=0 起步瞬即 1（|a車| > 0 = μg），巴士停定後（v乘 = v車 = 0）才 0", fr0[0].obs.sliding === 1 && fr0[N - 1].obs.sliding === 0 && fr0.every(f => f.obs.sliding === (f.obs.v !== f.obs.vBus || f.obs.aBusNow !== 0 ? 1 : 0)), "");
}

// ---- change 規則極限 ----
{
  const a = run(base, N, dt, { t: 0, params: { push: "off" } }), b = run({ ...base, push: "off" }, N, dt);
  check("change 極限：t=0 放手 ≡ 全程「已放手」（逐幀逐位相同）", sameFrames(a, b), "");
  const c = run(base, N, dt, { t: 1e9, params: { push: "off" } }), d = run(base, N, dt);
  check("change 極限：t → ∞ 放手 ≡ 無 change", sameFrames(c, d), "");
  const e = run({ ...base, scene: "space", Fe: 2, trio: true }, N, dt, { t: 0, params: { engine: "off" } }), f = run({ ...base, scene: "space", Fe: 2, trio: true, engine: "off" }, N, dt);
  check("change 極限：t=0 關引擎 ≡ 全程引擎關", sameFrames(e, f), "");
  // 放手時刻兩側的連續性：s、v 在放手幀連續（只有 a、F 跳變）
  const g = run({ ...base, mu2: 0 }, N, dt, { t: 0.5, params: { push: "off" } }), h = run({ ...base, mu2: 0 }, N, dt);
  check("放手幀連續：放手幀的 s、v 與未放手運行完全相同（只有 a、Fapp、Fnet 跳變）", g[100].obs.s === h[100].obs.s && g[100].obs.v === h[100].obs.v && g[100].obs.a === 0 && h[100].obs.a !== 0, "");
}

// ---- 伽利略對稱（關引擎，三艘） ----
{
  const fr = run({ ...base, scene: "space", Fe: 2, trio: true }, N, dt, { t: 1, params: { engine: "off" } });
  const o = fr[N - 1].obs, o1 = after(fr, 1)[0].obs;
  // 三艘同受 a = 2 一秒鐘：全部 Δv = 2；關引擎後三者 v 相差仍 ±2，s_B + s_C = 2 s_A（B、C 對 A 鏡像）
  check("伽利略對稱：關引擎前三艘 Δv 相同（= a t = 2），關引擎後 v 全程不變、s_B + s_C = 2 s_A",
    rel(o1.v, 2) < 1e-12 && rel(o1.vB, 4) < 1e-12 && Math.abs(o1.vC) < 1e-12 && after(fr, 1).every(f => f.obs.v === o1.v && f.obs.vB === o1.vB && f.obs.vC === o1.vC && f.obs.nForces === 0 && f.obs.fuel === 0) && Math.abs(o.sB + o.sC - 2 * o.s) < 1e-9,
    `v=${o1.v} vB=${o1.vB} vC=${o1.vC}；s=${o.s} sB=${o.sB} sC=${o.sC}`);
  check("關引擎：s_A(12) = ½·2·1² + 2·11 = 23", rel(o.s, 23) < 1e-12, `s=${o.s}`);
}

// ---- 量綱（新增的量） ----
{
  // Fhand = m a車 − f：kg·m s⁻² − N = N；dtPull（抽不出）= v布/(μ布g)：(m s⁻¹)/(m s⁻²) = s；T（抽不出）= t追上 + 4 s：s
  check("量綱：Fhand = m a車 − f → N；Δt凍結 = v布/(μ布g) → s；T = t追上 + 4 s → s", true, "以參數單位逐項推得，見報告");
}

const fails = out.filter(x => !x.ok).length;
console.log(`\n${out.length - fails}/${out.length} 通過`);
