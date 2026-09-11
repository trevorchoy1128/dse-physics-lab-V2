// 額外檢查：規格解析解、對稱性、極限行為（全部跑第二實作 model.mjs）
import { run, init, step, observe } from "./model.mjs";

const base = {
  scene: "table", g: 9.81,
  m: 0.2, F: 0.3, push: "on", mu1: 0, mu2: 0.2, second: false, mB: 1,
  vCloth: 5, muCloth: 0.15, muTable: 0.2, L: 0.4, mObj: 1,
  aBus: 3, vBus: 10, muBus: 0.2, handrail: false,
  Fe: 0, engine: "on", dir: "forward", mShip: 1, trio: false,
};
const dt = 0.005;
const last = (p, frames = 3200) => { const f = run(p, frames, dt); return f[f.length - 1].obs; };
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));
const out = [];
const check = (name, ok, detail) => { out.push({ name, ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + "  " + detail); };

// ---- 規格解析解 ----
{
  // §7 情景 1：放手後粗糙面 d = v²/(2μg)；預設：v_B = √(2·(F/m)·LAB) = 1.5，d = 1.5²/(2·0.2·9.81)
  const p = { ...base };
  const o = last(p);
  const vB = Math.sqrt(2 * (p.F / p.m) * 0.75);
  const aR = (p.F - p.mu2 * p.m * p.g) / p.m;              // 保持施力：a = F/m − μ₂g
  const d = -vB * vB / (2 * aR);
  check("情景1 停下位置 = 0.75 + v_B²/(2|a|)（保持施力）", rel(o.s, 0.75 + d) < 1e-9, `s=${o.s} 解析=${0.75 + d}`);
  const p2 = { ...base, push: "off", mu1: 0.2 };            // 放手且前段粗糙：靜止不動
  const o2 = last(p2);
  check("情景1 放手後靜止：s=v=0，W=N", o2.s === 0 && o2.v === 0 && o2.W === o2.N && o2.nForces === 2, JSON.stringify(o2));
}
{
  // §7 情景 2：Δv 精確解；§8 第 6 點：v布 5.0 → 0.119、10.0 → 0.059
  const a = base.muCloth * base.g;
  for (const vc of [5, 10]) {
    const tL = (vc - Math.sqrt(vc * vc - 2 * a * base.L)) / a;
    const o = last({ ...base, scene: "cloth", vCloth: vc });
    check(`情景2 v布=${vc}：Δv 與精確解 aΔt`, rel(o.dv, a * tL) < 1e-9 && rel(o.J, base.mObj * o.dv) < 1e-12, `dv=${o.dv.toFixed(6)} (規格 ${vc === 5 ? 0.119 : 0.059})，dtPull=${o.dtPull}`);
    check(`情景2 v布=${vc}：滑行距離 = Δv²/(2μ桌g)`, rel(o.slide, o.dv * o.dv / (2 * base.muTable * base.g)) < 1e-9, `slide=${o.slide}`);
  }
  // 驗證條件 9：v布 1.5→10 二十點，Δv 嚴格單調下降
  let prev = Infinity, mono = true;
  for (let i = 0; i < 20; i++) { const vc = 1.5 + (10 - 1.5) * i / 19; const o = last({ ...base, scene: "cloth", vCloth: vc }, 800); if (!(o.dv < prev)) mono = false; prev = o.dv; }
  check("情景2 驗證9：Δv 隨 v布 嚴格單調下降（20 點）", mono, "");
  // 驗證條件 10：臨界值 √(2μ布gL) 兩側各 5 點
  const vcrit = Math.sqrt(2 * a * base.L);
  let okStuck = true, okFree = true;
  for (let i = 1; i <= 5; i++) {
    const os = last({ ...base, scene: "cloth", vCloth: vcrit * (1 - 0.02 * i) }, 800);
    if (!(os.stuck === 1 && os.phase === 1 && rel(os.v, vcrit * (1 - 0.02 * i)) < 1e-9)) okStuck = false;
    const of = last({ ...base, scene: "cloth", vCloth: vcrit * (1 + 0.02 * i) }, 800);
    if (!(of.stuck === 0 && of.phase === 3)) okFree = false;
  }
  check("情景2 驗證10：臨界值以下抽不出、物件終速 = v布；以上抽得出", okStuck && okFree, `v臨界=${vcrit.toFixed(4)}`);
  // 驗證條件 11：Δv 與 m 無關；|a| ≤ μ布g；v ≤ v布
  const dvs = [];
  let bounded = true;
  for (let i = 0; i < 20; i++) {
    const m = 0.1 + (5 - 0.1) * i / 19; const fr = run({ ...base, scene: "cloth", mObj: m }, 800, dt);
    dvs.push(fr[fr.length - 1].obs.dv);
    for (const f of fr) if (Math.abs(f.obs.a) > a + 1e-12 && f.obs.phase === 0 || f.obs.v > base.vCloth + 1e-12) bounded = false;
  }
  const mean = dvs.reduce((x, y) => x + y) / dvs.length, sd = Math.sqrt(dvs.reduce((x, y) => x + (y - mean) ** 2, 0) / dvs.length);
  check("情景2 驗證11：Δv 與質量無關（相對標準差 < 1e-9），|a| ≤ μ布g，v ≤ v布", sd / mean < 1e-9 && bounded, `rsd=${(sd / mean).toExponential(2)}`);
}
{
  // §7 情景 3：不滑條件 μg ≥ a → sRel ≡ 0、f = ma；滑動時 |a乘| = μg，煞車期間 v乘 ≥ v車
  const fr = run({ ...base, scene: "bus", muBus: 0.35 }, 3200, dt);   // μg = 3.43 > 3
  let ok = true;
  for (const f of fr) if (Math.abs(f.obs.sRel) > 1e-12 || Math.abs(f.obs.f - 60 * f.obs.aBusNow) > 1e-9) ok = false;
  check("情景3 驗證13：μg ≥ a 時 sRel ≡ 0、f = ma", ok, "μ=0.35");
  const fr2 = run({ ...base, scene: "bus" }, 3200, dt);
  let ok2 = true;
  for (const f of fr2) { if (f.obs.sliding && Math.abs(Math.abs(f.obs.a) - base.muBus * base.g) > 1e-12) ok2 = false; if (f.obs.busPhase === 2 && f.obs.v < f.obs.vBus - 1e-12) ok2 = false; }
  check("情景3 驗證13：滑動時 |a乘| = μg；煞車期間 v乘 ≥ v車", ok2, "μ=0.2");
}
{
  // 驗證條件 15：能量——無摩擦時（放手）動能守恆；有摩擦時 ΔKE = 摩擦功 + 施力功
  const fr = run({ ...base, mu2: 0.2 }, 3200, dt);
  const o = fr[fr.length - 1].obs, m = base.m;
  const Wf = -base.mu2 * m * base.g * (o.s - 0.75), Wapp = base.F * o.s;   // f 只在 B 之後作用
  check("驗證15：ΔKE = 施力功 + 摩擦功（預設運行，終態 KE=0）", Math.abs(0.5 * m * o.v * o.v - (Wapp + Wf)) < 1e-9, `ΣW=${(Wapp + Wf).toExponential(3)}`);
}

// ---- 對稱性 ----
{
  // 巴士：起步與煞車互為鏡像 → 乘客最終 sRel 回到 0（預設參數，巴士停定後乘客滑行停下）
  const o = last({ ...base, scene: "bus" });
  check("對稱：巴士起步／煞車鏡像 → 最終 sRel = 0", Math.abs(o.sRel) < 1e-9, `sRel=${o.sRel.toExponential(2)}`);
  // 太空：關引擎時 B、C 互為鏡像 sC = −sB；引擎向後 = 向前的負像
  const a = last({ ...base, scene: "space", engine: "off", trio: true });
  const f1 = last({ ...base, scene: "space", Fe: 2, dir: "forward" }), b1 = last({ ...base, scene: "space", Fe: 2, dir: "backward" });
  check("對稱：太空 sC = −sB（關引擎）；引擎反向 → s、v 變號", a.sC === -a.sB && f1.s === -b1.s && f1.v === -b1.v, `sB=${a.sB} sC=${a.sC} s±=${f1.s},${b1.s}`);
  // 情景 1 兩方塊：加速段 a_A/a_B = m_B/m_A（驗證 8）
  const t = last({ ...base, second: true, mB: 1, F: 1, mu2: 0 });
  check("驗證8：兩方塊 a_A/a_B = m_B/m_A，v 比亦然", rel(t.a / t.aB, base.mB / base.m) < 1e-12 && rel(t.v / t.vB, base.mB / base.m) < 1e-9, `a=${t.a} aB=${t.aB}`);
}

// ---- 極限行為 ----
{
  const o = last({ ...base, mu2: 0 });                                    // μ→0：永不停
  check("極限：μ₁=μ₂=0 時方塊永不停，a = F/m 恆定", o.v > 0 && rel(o.a, base.F / base.m) < 1e-12, `v(12s)=${o.v}`);
  const fr = run({ ...base, push: "off", mu1: 0, mu2: 0 }, 2000, dt);   // 驗證 1／2：無摩擦無外力 → v 恆定、ΣF=0
  check("驗證1/2：μ=0、放手 → v 恆為 0（由靜止）、ΣF=0", fr.every(f => f.obs.v === 0 && f.obs.Fnet === 0 && f.obs.nHoriz === 0), "");
  const c = last({ ...base, F: 0.5 * 0.2 * 9.81 * 0.2 + 0, mu1: 0.1, mu2: 0.1, push: "on" }); // F = μmg（前後段同 μ=0.1）：靜止時剛好不動
  check("驗證5：v=0 且 F = μmg 時不動，f = −F", c.v === 0 && c.a === 0 && rel(-c.f, c.Fapp) < 1e-12, `F=${c.Fapp} μmg=${0.1 * 0.2 * 9.81}`);
  const c2 = last({ ...base, F: 0.1 * 0.2 * 9.81 * 1.0001, mu1: 0.1, mu2: 0.1 });
  check("驗證5：F 略大於 μmg 即開始加速", c2.v > 0, `v=${c2.v}`);
  const cl = last({ ...base, scene: "cloth", vCloth: 10, muCloth: 0.15 }, 800);
  check("極限：v布 ≫ → Δv ≈ μgL/v布（誤差 < 1%）", rel(cl.dv, base.muCloth * base.g * base.L / 10) < 0.01, `dv=${cl.dv} 近似=${base.muCloth * base.g * base.L / 10}`);
  const cl0 = last({ ...base, scene: "cloth", muCloth: 0 }, 800);
  check("極限：μ布=0 → 物件不動，dtPull = L/v布", cl0.s === 0 && cl0.v === 0 && rel(cl0.dtPull, base.L / base.vCloth) < 1e-12, `dtPull=${cl0.dtPull}`);
  const clL = last({ ...base, scene: "cloth", L: 0.1 }, 800), clL2 = last({ ...base, scene: "cloth", L: 1.0 }, 800);
  check("極限：L 越短 Δv 越小（L=0.1 < L=1.0）", clL.dv < clL2.dv, `${clL.dv} < ${clL2.dv}`);
  const b0 = run({ ...base, scene: "bus", muBus: 0 }, 3200, dt);
  check("極限：巴士 μ=0 → 乘客留在原地（s ≡ 0），無水平力", b0.every(f => f.obs.s === 0 && f.obs.nHoriz === 0), "");
  const bh = run({ ...base, scene: "bus", handrail: true }, 3200, dt);
  check("極限：握扶手 → sRel ≡ 0；水平力 = 摩擦 + 扶手力 = m a車", bh.every(f => f.obs.sRel === 0 && Math.abs(f.obs.f + f.obs.Fhand - 60 * f.obs.aBusNow) < 1e-9), `Fhand(t=0)=${bh[0].obs.Fhand}`);
  const sp = last({ ...base, scene: "space", Fe: 5, mShip: 5 }), sp2 = last({ ...base, scene: "space", Fe: 5, mShip: 0.5 });
  check("極限：太空 a = F/m，m 大 10 倍 a 小 10 倍", rel(sp2.a / sp.a, 10) < 1e-12, `a=${sp.a},${sp2.a}`);
  const spOff = run({ ...base, scene: "space", engine: "off", Fe: 5, trio: true }, 3200, dt);
  check("驗證1：太空關引擎 → 三艘速度全程不變、無任何力", spOff.every(f => f.obs.v === 0 && f.obs.vB === 2 && f.obs.vC === -2 && f.obs.nForces === 0 && f.obs.fuel === 0), "");
}
const fails = out.filter(x => !x.ok).length;
console.log(`\n${out.length - fails}/${out.length} 通過`);
