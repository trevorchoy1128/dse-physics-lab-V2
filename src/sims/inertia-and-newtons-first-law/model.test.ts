import { describe, it, expect } from "vitest";
import { model, duration, clothAnalytic, busAt, busT1, blockForces, passengerForces, L_AB, M_PASSENGER, T_CRUISE, TRIO_U, type P, type S } from "./model";
import { defaults } from "./controls";

// 每個 it() 名稱 = 規格 13_024 §10「驗證條件」原句（1、2、5–13、15）；3、4、14、16、17 屬畫面，在 plan.test.ts。
const DT = 1e-3;
const run = (p: P, T: number, dt = DT, onStep?: (s: S, i: number) => P | void) => {
  let s: S = model.init(p); const trace: S[] = [s]; let q = p;
  for (let i = 0; i < Math.round(T / dt); i++) { const np = onStep?.(s, i); if (np) q = np; s = model.step(s, q, dt); trace.push(s); }
  return trace;
};
const table = (o: Partial<P> = {}): P => ({ ...defaults, scene: "table", ...o });
const cloth = (o: Partial<P> = {}): P => ({ ...defaults, scene: "cloth", ...o });
const bus = (o: Partial<P> = {}): P => ({ ...defaults, scene: "bus", ...o });
const space = (o: Partial<P> = {}): P => ({ ...defaults, scene: "space", ...o });
const rel = (x: number, y: number) => Math.abs(x - y) / Math.max(Math.abs(y), 1e-12);

describe("慣性與牛頓運動第一定律（S15）", () => {
  it("無摩擦、無外力時速度恆定", () => {
    // 情景 1：光滑桌面，施力 0.5 s 後放手，之後 1000 s 內 |v| 與方向不變（步長 0.01 s，閉式積分）
    let p = table({ mu1: 0, mu2: 0, push: "on" });
    let s = model.init(p);
    for (let i = 0; i < 50; i++) s = model.step(s, p, 0.01);
    p = { ...p, push: "off" }; s = model.step(s, p, 0.01);
    const v0 = s.a.v; expect(v0).toBeGreaterThan(0);
    // 時間窗 12 s 會凍結，故直接用 stepBlock 路徑：以無時間窗的等價做法——逐步檢查至凍結為止，再以 1000 個 1 s 的 done 前步確認
    for (let i = 0; i < 1100; i++) { s = model.step(s, p, 0.01); if (s.done) break; expect(rel(s.a.v, v0)).toBeLessThan(1e-9); expect(Math.sign(s.a.v)).toBe(Math.sign(v0)); }
    // 情景 4：三艘飛船關引擎，1000 s（時間窗 12 s 內每步檢查；另以解析式核對 1000 s）
    const q = space({ trio: true, engine: "off", Fe: 5 });
    for (const st of run(q, 12, 0.01)) { expect(st.a.v).toBe(0); expect(st.b.v).toBe(TRIO_U); expect(st.c.v).toBe(-TRIO_U); expect(st.b.s).toBeCloseTo(TRIO_U * st.t, 9); }
  });

  it("放手後淨力為零", () => {
    const p = table({ mu1: 0, mu2: 0, push: "on" });
    const trace = run(p, 3, DT, (_s, i) => (i === 1000 ? { ...p, push: "off" } : undefined));
    const off = { ...p, push: "off" as const };
    for (const s of trace.slice(1002)) {
      const o = model.observe(s, off);
      expect(Math.abs(o.Fnet)).toBeLessThan(1e-12); expect(Math.abs(o.a)).toBeLessThan(1e-12);
      expect(o.nHoriz).toBe(0); expect(o.nForces).toBe(2);
    }
    expect(trace.at(-1)!.tRelease).toBeCloseTo(1, 6);
  });

  it("靜止時外力不超過 μmg 則不動", () => {
    const base = table({ mu1: 0.2, mu2: 0.2, m: 0.5, g: 10 });   // μmg = 1.00 N
    for (const F of [0, 0.5, 0.99, 1.0]) {
      const p = { ...base, F, push: "on" as const };
      const end = run(p, 2).at(-1)!; const o = model.observe(end, p);
      expect(end.a.s).toBe(0); expect(end.a.v).toBe(0); expect(o.a).toBe(0); expect(o.f).toBeCloseTo(-F, 12); expect(o.Fnet).toBe(0);
    }
    const p = { ...base, F: 1.01, push: "on" as const };
    const end = run(p, 0.5).at(-1)!;
    expect(end.a.v).toBeGreaterThan(0); expect(model.observe(model.init(p), p).a).toBeCloseTo(0.02, 9);
  });

  it("施力等於摩擦則勻速", () => {
    // 光滑段加速至 B，粗糙段 F = μ₂mg = 1.00 N：淨力 0，v 恆定（規格情景 3、98(II)Q6）
    const p = table({ mu1: 0, mu2: 0.2, m: 0.5, g: 10, F: 1.0, push: "on" });
    const trace = run(p, 6);
    const afterB = trace.filter(s => s.a.s >= L_AB);
    expect(afterB.length).toBeGreaterThan(100);
    const vB = Math.sqrt(2 * (1.0 / 0.5) * L_AB);             // 光滑段 a = F/m = 2，v_B = √(2·2·0.75) = √3
    for (const s of afterB) { expect(rel(s.a.v, vB)).toBeLessThan(1e-9); const o = model.observe(s, p); expect(Math.abs(o.Fnet)).toBeLessThan(1e-12); expect(o.f).toBeCloseTo(-1.0, 12); }
    // F 略大於摩擦才加速
    const q = { ...p, F: 1.2 };
    const endQ = run(q, 6).at(-1)!; expect(endQ.a.v).toBeGreaterThan(vB + 0.5);
  });

  it("粗糙面上的減速與解析解比較", () => {
    // 光滑段以 F 加速至 B（v_B = √(2 F L/m)），在 B 放手，粗糙段 a = −μ₂g，滑行距離 d = v_B²/(2μ₂g)，停後 v 保持 0 永不為負
    const p = table({ mu1: 0, mu2: 0.2, m: 0.2, F: 0.3, push: "on" });
    let released: P | undefined; let rel0: { s: number; v: number } | undefined;
    const trace = run(p, 6, DT, s => { if (!released && s.a.s >= L_AB) { released = { ...p, push: "off" }; rel0 = { ...s.a }; } return released; });
    const off = released!;
    expect(rel0!.v).toBeCloseTo(1.5, 3);                        // 放手時 v ≈ v_B = √(2FL/m) = 1.5（放手落在越過 B 後的一步內）
    const sliding = trace.filter(s => s.a.s > rel0!.s && s.a.v > 0);
    for (const s of sliding) { expect(rel(model.observe(s, off).a, -0.2 * p.g)).toBeLessThan(1e-9); }
    const end = trace.at(-1)!;
    expect(end.a.v).toBe(0);
    expect(rel(end.a.s - rel0!.s, (rel0!.v * rel0!.v) / (2 * 0.2 * p.g))).toBeLessThan(1e-6);
    for (const s of trace) expect(s.a.v).toBeGreaterThanOrEqual(0);
    const stopped = trace.filter(s => s.a.v === 0 && s.a.s > L_AB);
    expect(stopped.length).toBeGreaterThan(10);
    for (const s of stopped) { const o = model.observe(s, off); expect(o.f).toBe(0); expect(o.Fnet).toBe(0); }
  });

  it("2024 卷一乙部 Q3(a)：0.20 kg 方塊受 0.30 N 在光滑段走 0.75 m，到 B 時速率 1.5 m s⁻¹（解析解）", () => {
    const p = table({ mu2: 0 });   // 預設即該題數值（m 0.20、F 0.30、光滑段 0.75 m）；後段亦設光滑，令越過 B 後 v 保持 v_B 可直接讀
    const trace = run(p, 2);
    const atB = trace.find(s => s.a.s >= L_AB)!;
    // 取樣落在越過 B 後的一步內，仍在施力（a = 1.5 不變）：由 v² = v_B² + 2a(s − L_AB) 反推 v_B
    expect(Math.sqrt(atB.a.v ** 2 - 2 * 1.5 * (atB.a.s - L_AB))).toBeCloseTo(1.5, 9);
    expect(atB.t).toBeCloseTo(1.0, 2);   // t = v/a = 1.5/1.5
    const before = trace.filter(s => s.a.s < L_AB).at(-1)!;
    expect(before.a.v).toBeCloseTo(1.5 * before.t, 12);   // 光滑段 v = at，a = F/m = 1.5
  });

  it("慣性與質量", () => {
    // 固定淨力（光滑，F = 1 N）掃描 m：a·m 為常數；放手後各質量速度變化皆為零；兩方塊 Δv_A/Δv_B = m_B/m_A
    const am: number[] = [];
    for (let k = 0; k < 20; k++) {
      const m = 0.1 + (4.9 * k) / 19; const p = table({ mu1: 0, mu2: 0, F: 1, m, push: "on" });
      am.push(model.observe(model.init(p), p).a * m);
      const trace = run(p, 1, DT, (_s, i) => (i === 500 ? { ...p, push: "off" } : undefined));
      const off = { ...p, push: "off" as const };
      const v0 = trace[502].a.v; for (const s of trace.slice(502)) expect(rel(s.a.v, v0)).toBeLessThan(1e-9);
      expect(model.observe(trace.at(-1)!, off).a).toBe(0);
    }
    const mean = am.reduce((a, b) => a + b) / am.length;
    const sd = Math.sqrt(am.reduce((a, b) => a + (b - mean) ** 2, 0) / am.length);
    expect(sd / mean).toBeLessThan(1e-9);
    const p2 = table({ mu1: 0, mu2: 0, F: 1, m: 0.2, second: true, mB: 1.0, push: "on" });
    const end = run(p2, 0.6).at(-1)!;
    expect(rel(end.a.v / end.b.v, 1.0 / 0.2)).toBeLessThan(1e-9);
  });

  it("桌布：Δv 隨抽出速率下降", () => {
    const base = cloth();   // μ布 0.15、L 0.40、g 9.81：a = 1.4715
    let prev = Infinity;
    for (let k = 0; k < 20; k++) {
      const vC = 1.5 + (8.5 * k) / 19; const p = { ...base, vCloth: vC };
      const ana = clothAnalytic(p); expect(ana.stuck).toBe(false);
      const exact = vC - Math.sqrt(vC * vC - 2 * 0.15 * p.g * p.L);
      expect(rel(ana.dv, exact)).toBeLessThan(1e-9);
      const end = run(p, duration(p), 5e-4).at(-1)!;
      expect(end.phase).toBeGreaterThanOrEqual(2);
      expect(rel(end.dv, exact)).toBeLessThan(1e-9);
      expect(rel(end.tLeave, ana.tLeave)).toBeLessThan(1e-9);
      expect(end.dv).toBeLessThan(prev); prev = end.dv;
    }
    expect(clothAnalytic({ ...base, vCloth: 5 }).dv).toBeCloseTo(0.119, 3);
    expect(clothAnalytic({ ...base, vCloth: 10 }).dv).toBeCloseTo(0.059, 3);
  });

  it("桌布：抽得太慢時物件跟着走", () => {
    const base = cloth();
    const vc = Math.sqrt(2 * 0.15 * base.g * base.L);   // 1.085 m s⁻¹
    expect(vc).toBeCloseTo(1.08, 2);
    for (let k = 1; k <= 5; k++) {
      const p = { ...base, vCloth: vc * (1 - 0.05 * k) };
      expect(clothAnalytic(p).stuck).toBe(true);
      const end = run(p, duration(p), 5e-4).at(-1)!;
      expect(end.phase).toBe(1); expect(model.observe(end, p).stuck).toBe(1);
      expect(rel(end.a.v, p.vCloth)).toBeLessThan(1e-9);
      expect(Number.isNaN(end.tLeave)).toBe(true);
    }
    for (let k = 1; k <= 5; k++) {
      const p = { ...base, vCloth: vc * (1 + 0.05 * k) };
      expect(clothAnalytic(p).stuck).toBe(false);
      const end = run(p, duration(p), 5e-4).at(-1)!;
      expect(end.phase).toBeGreaterThanOrEqual(2); expect(end.dv).toBeLessThan(p.vCloth);
    }
  });

  it("桌布：Δv 與質量無關", () => {
    const base = cloth();
    const dvs: number[] = [];
    for (let k = 0; k < 20; k++) {
      const p = { ...base, mObj: 0.1 + (4.9 * k) / 19 };
      const trace = run(p, duration(p), 5e-4);
      dvs.push(trace.at(-1)!.dv);
      for (const s of trace) { const o = model.observe(s, p); if (s.phase < 2) expect(Math.abs(o.a)).toBeLessThanOrEqual(0.15 * p.g + 1e-12); expect(s.a.v).toBeLessThanOrEqual(p.vCloth + 1e-12); }
    }
    const mean = dvs.reduce((a, b) => a + b) / dvs.length;
    const sd = Math.sqrt(dvs.reduce((a, b) => a + (b - mean) ** 2, 0) / dvs.length);
    expect(sd / mean).toBeLessThan(1e-9);
  });

  it("動量與衝量一致", () => {
    for (const vC of [2, 5, 10]) for (const mObj of [0.5, 1, 3]) {
      const p = cloth({ vCloth: vC, mObj });
      const end = run(p, duration(p), 5e-4).at(-1)!; const o = model.observe(end, p);
      const f = p.muCloth * mObj * p.g;
      expect(rel(f * end.tLeave, mObj * end.dv)).toBeLessThan(1e-9);
      expect(rel(o.J, mObj * end.dv)).toBeLessThan(1e-9);
    }
  });

  it("巴士：不滑的條件", () => {
    const g = 9.81;
    // |a| ≤ μg：s_rel 恆為 0，f = ma
    {
      const p = bus({ aBus: 1.5, muBus: 0.2 });   // μg = 1.962 > 1.5
      for (const s of run(p, duration(p), 2e-3)) { const b = busAt(p, s.t); expect(Math.abs(s.a.s - b.s)).toBeLessThan(1e-9); const o = model.observe(s, p); expect(o.f).toBeCloseTo(M_PASSENGER * b.a, 9); expect(o.sRel).toBe(0); }
    }
    // |a| > μg：乘客 |a| = μg；煞車期間 v_乘 ≥ v_車；相對滑動在兩者速度相等時停止；水平力只有摩擦一支
    {
      const p = bus({ aBus: 3, muBus: 0.2, vBus: 10 });
      const t1 = busT1(p), t2 = t1 + T_CRUISE, t3 = t2 + t1;
      const trace = run(p, duration(p), 2e-3);
      let sawSlide = false;
      for (const s of trace) {
        const b = busAt(p, s.t); const o = model.observe(s, p);
        if (s.phase === 1 || Math.abs(b.a) > 0.2 * g) { if (s.phase === 1) sawSlide = true; expect(Math.abs(o.a)).toBeCloseTo(0.2 * g, 9); }
        else expect(o.a).toBeCloseTo(b.a, 9);
        if (s.t > t2 && s.t < t3) expect(s.a.v).toBeGreaterThanOrEqual(b.v - 1e-9);
        expect(o.nHoriz).toBeLessThanOrEqual(1); expect(o.Fhand).toBe(0);
      }
      expect(sawSlide).toBe(true);
      const end = trace.at(-1)!; expect(end.a.v).toBe(0); expect(busAt(p, end.t).v).toBe(0);
      // 起步：相對向後滑；乘客追不上巴士，於巡航時追上（v 相等）後停止滑動
      const cruise = trace.find(s => s.t > t1 + 0.5)!; expect(cruise.a.s).toBeLessThan(busAt(p, cruise.t).s);
    }
    // 握扶手：s_rel ≡ 0，扶手力補足摩擦不夠的部分
    {
      const p = bus({ aBus: 3, muBus: 0.2, handrail: true });
      for (const s of run(p, duration(p), 2e-3)) { const b = busAt(p, s.t); const o = model.observe(s, p); expect(o.sRel).toBe(0); expect(o.f + o.Fhand).toBeCloseTo(M_PASSENGER * b.a, 9); expect(Math.abs(o.f)).toBeLessThanOrEqual(0.2 * M_PASSENGER * g + 1e-9); }
    }
    // μ = 0：起步時乘客留在原地
    {
      const p = bus({ aBus: 3, muBus: 0 });
      for (const s of run(p, busT1(p), 2e-3)) { expect(s.a.s).toBe(0); expect(s.a.v).toBe(0); }
    }
  });

  it("能量檢查", () => {
    // 無摩擦、放手後動能守恆；有摩擦時動能的減少等於摩擦所作的功
    const p = table({ mu1: 0, mu2: 0.25, m: 0.4, F: 0.6, push: "on" });
    let released: P | undefined; let rel0: { s: number; v: number } | undefined;
    const trace = run(p, 6, DT, s => { if (!released && s.a.s >= L_AB) { released = { ...p, push: "off" }; rel0 = { ...s.a }; } return released; });
    const E0 = 0.5 * p.m * rel0!.v ** 2;
    for (const s of trace) {
      if (s.a.s <= rel0!.s) continue;
      const Ek = 0.5 * p.m * s.a.v ** 2; const Wf = 0.25 * p.m * p.g * (s.a.s - rel0!.s);   // 放手後只有摩擦作功
      expect(Math.abs(E0 - Ek - Wf)).toBeLessThan(1e-6 * E0 + 1e-12);
    }
    const q = table({ mu1: 0, mu2: 0, m: 0.4, F: 0.6, push: "on" });
    const tr2 = run(q, 3, DT, (_s, i) => (i === 500 ? { ...q, push: "off" } : undefined));
    const Ek0 = 0.5 * q.m * tr2[502].a.v ** 2;
    for (const s of tr2.slice(502)) expect(rel(0.5 * q.m * s.a.v ** 2, Ek0)).toBeLessThan(1e-9);
  });

  it("太空：關引擎速度不變、燃料消耗為零；開引擎 a = F/m", () => {
    const p = space({ Fe: 2, mShip: 1, engine: "on" });
    const trace = run(p, 2, DT, (_s, i) => (i === 1000 ? { ...p, engine: "off" } : undefined));
    const off = { ...p, engine: "off" as const };
    expect(model.observe(trace[1], p).a).toBeCloseTo(2, 12); expect(model.observe(trace[1], p).fuel).toBeGreaterThan(0);
    const v0 = trace[1002].a.v; expect(v0).toBeCloseTo(2, 6);
    for (const s of trace.slice(1002)) { expect(rel(s.a.v, v0)).toBeLessThan(1e-9); const o = model.observe(s, off); expect(o.fuel).toBe(0); expect(o.Fnet).toBe(0); expect(o.nForces).toBe(0); }
    const back = space({ Fe: 2, mShip: 4, engine: "on", dir: "backward" });
    expect(model.observe(model.init(back), back).a).toBeCloseTo(-0.5, 12);
  });

  it("到達時間窗末端凍結，t 恰等於時間窗；歷史樣本與讀數無 NaN（凍結前）", () => {
    for (const p of [table(), cloth(), bus(), space({ trio: true }), cloth({ vCloth: 0.5 }), bus({ aBus: 0 }), bus({ muBus: 0 })]) {
      const T = duration(p); const end = run(p, T + 1, 0.01).at(-1)!;
      expect(end.done).toBe(true); expect(end.t).toBe(T);
      for (const h of end.hist) for (const k of ["t", "s", "v", "a", "s2", "v2"] as const) expect(Number.isFinite(h[k]), `${p.scene} ${k}`).toBe(true);
      const o = model.observe(end, p);
      for (const k of Object.keys(o)) if (k !== "dtPull") expect(Number.isFinite(o[k]), `${p.scene} ${k}`).toBe(true);
    }
  });

  it("乘客受力：相對靜止時 f = ma；滑動時 |f| = μmg 且與相對速度反向", () => {
    const p = bus({ aBus: 3, muBus: 0.2 });
    const t1 = busT1(p);
    const braking = run(p, t1 + T_CRUISE + 1, 2e-3).filter(s => busAt(p, s.t).phase === 2 && s.phase === 1);
    expect(braking.length).toBeGreaterThan(10);
    for (const s of braking) { const fp = passengerForces(s, p); expect(fp.f).toBeCloseTo(-0.2 * M_PASSENGER * p.g, 9); expect(s.a.v - busAt(p, s.t).v).toBeGreaterThan(0); }
    const st = model.init(p); const fp0 = blockForces({ s: 0, v: 0 }, 1, table({ mu1: 0.3, F: 0 })); expect(fp0.f).toBe(0);
    expect(st.phase).toBe(0);
  });
});
