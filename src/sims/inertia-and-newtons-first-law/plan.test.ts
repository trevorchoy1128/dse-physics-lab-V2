import { describe, it, expect } from "vitest";
import { model, duration, busAt, busT1, T_CRUISE, type P, type S } from "./model";
import { plan, extent, HOLD } from "./plan";
import { defaults, controls } from "./controls";
import { UNITS_ALLOWED } from "@/shell/units";
import type { ArrowPlan } from "@/shell/types";

// 規格 13_024 §10 的畫面條件：3（2024 Q3(b) 受力圖）、4（靜止不等於無力）、14（沒有虛擬力）、16（畫面一致）、17（座標約定）
const all = { weight: true, normal: true, friction: true, applied: true, net: true, velocity: true, acceleration: true, netOnly: false };
const table = (o: Partial<P> = {}): P => ({ ...defaults, scene: "table", ...o });
const advance = (p: P, T: number, dt = 1e-3, onStep?: (s: S, i: number) => P | void) => { let s: S = model.init(p); let q = p; for (let i = 0; i < Math.round(T / dt); i++) { const np = onStep?.(s, i); if (np) q = np; s = model.step(s, q, dt); } return { s, p: q }; };
const mk = (s: S, p: P, layers = all) => plan(s, p, model.observe(s, p), layers);
const forcesOn = (pl: ReturnType<typeof plan>, lane: number) => pl.arrows.filter(a => a.origin[2] === lane && a.kind !== "velocity" && a.kind !== "acceleration" && a.layer !== "net");
const FORCE_KINDS = new Set(["weight", "normal", "friction", "tension", "net"]);

describe("慣性 畫面", () => {
  it("2024 卷一乙部 Q3(b) 的受力圖", () => {
    // 施力移除後：layer 'applied' 的箭嘴數目必須為 0；weight 與 normal 各 1 支
    const p0 = table({ f1: 0, f2: 0 });
    const { s, p } = advance(p0, 2, 1e-3, (_s, i) => (i === 800 ? { ...p0, push: "off" } : undefined));
    const pl = mk(s, p);
    expect(pl.arrows.filter(a => a.layer === "applied")).toHaveLength(0);
    expect(pl.arrows.filter(a => a.kind === "weight")).toHaveLength(1);
    expect(pl.arrows.filter(a => a.kind === "normal")).toHaveLength(1);
    expect(pl.arrows.filter(a => a.kind === "friction")).toHaveLength(0);
    expect(pl.arrows.find(a => a.kind === "velocity")!.vector[0]).toBeGreaterThan(0);
    expect(pl.meta!.nForces).toBe(2); expect(pl.meta!.nHoriz).toBe(0);
    // 施力中：applied 1 支，向前
    const before = mk(advance(p0, 0.5).s, p0);
    expect(before.arrows.filter(a => a.layer === "applied")).toHaveLength(1);
    expect(before.arrows.find(a => a.layer === "applied")!.vector[0]).toBeCloseTo(0.3, 12);
    expect(before.arrows.find(a => a.layer === "applied")!.kind).toBe("tension");
  });

  it("靜止不等於無力", () => {
    const p = table({ push: "off", f1: 0.4, f2: 0.4 });
    const s = model.init(p); const pl = mk(s, p);
    const W = pl.arrows.find(a => a.kind === "weight")!, R = pl.arrows.find(a => a.kind === "normal")!;
    expect(W).toBeDefined(); expect(R).toBeDefined();
    const mag = (v: number[]) => Math.hypot(v[0], v[1], v[2]);
    expect(Math.abs(mag(W.vector) - mag(R.vector)) / mag(W.vector)).toBeLessThan(1e-12);
    const dot = (W.vector[0] * R.vector[0] + W.vector[1] * R.vector[1] + W.vector[2] * R.vector[2]) / (mag(W.vector) * mag(R.vector));
    expect(Math.abs(dot + 1)).toBeLessThan(1e-12);
    expect(pl.arrows.find(a => a.layer === "net")).toBeUndefined();   // 淨力為零：不畫零長箭嘴
    expect(pl.meta!.Fnet).toBe(0);
    // 「只看淨力」：個別力全部隱藏，畫面空白
    const only = mk(s, p, { ...all, netOnly: true });
    expect(only.arrows.filter(a => FORCE_KINDS.has(a.kind))).toHaveLength(0);
  });

  it("沒有虛擬力", () => {
    const p: P = { ...defaults, scene: "bus" };
    const t1 = busT1(p);
    for (const T of [0.5, t1 + 1, t1 + T_CRUISE + 1, duration(p) - 0.1]) {
      const { s } = advance(p, T, 2e-3); const pl = mk(s, p);
      for (const a of pl.arrows) { expect(["weight", "normal", "friction", "tension", "net", "velocity", "acceleration"]).toContain(a.kind); expect(a.layer).not.toMatch(/pseudo|inertia/); }
      const horiz = pl.arrows.filter(a => FORCE_KINDS.has(a.kind) && a.layer !== "net" && a.vector[0] !== 0);
      expect(horiz.every(a => a.layer === "friction")).toBe(true);      // 不握扶手：水平力只有摩擦
      const bus = busAt(p, s.t);
      if (bus.phase === 2 && s.phase === 1) expect(horiz[0].vector[0]).toBeLessThan(0);   // 煞車滑動：摩擦向後，沒有向前的箭嘴
    }
    const q: P = { ...p, handrail: true };
    const { s } = advance(q, 0.5, 2e-3); const pl = mk(s, q);
    const hand = pl.arrows.find(a => a.layer === "applied")!;
    expect(hand.kind).toBe("tension"); expect(hand.vector[0]).toBeGreaterThan(0);
  });

  it("畫面一致：淨力箭嘴 = 各力之和；a = F_net / m；摩擦反相對運動趨勢；同一 kind 一個縮放係數；標籤 = observe；單位在允許清單", () => {
    const cases: { p: P; T: number; m: number; onStep?: (s: S, i: number) => P | void }[] = [
      { p: table(), T: 0.5, m: 0.2 },
      { p: table({ f1: 0.4, f2: 0.4, F: 0.5 }), T: 0.5, m: 0.2 },
      { p: table({ second: true, mB: 1 }), T: 0.5, m: 0.2 },
      { p: { ...defaults, scene: "cloth" }, T: 0.1, m: 1 },
      { p: { ...defaults, scene: "cloth" }, T: 1.0, m: 1 },
      { p: { ...defaults, scene: "bus" }, T: 1.0, m: 60 },
      { p: { ...defaults, scene: "bus" }, T: 8.0, m: 60 },
      { p: { ...defaults, scene: "space", Fe: 2, trio: true }, T: 1.0, m: 1 },
    ];
    for (const c of cases) {
      const { s, p } = advance(c.p, c.T, 2e-3, c.onStep); const obs = model.observe(s, p); const pl = mk(s, p);
      const lane0 = forcesOn(pl, 0);
      const sum = lane0.reduce((acc, a) => [acc[0] + a.vector[0], acc[1] + a.vector[1], acc[2] + a.vector[2]], [0, 0, 0]);
      const net = pl.arrows.find(a => a.layer === "net" && a.origin[2] === 0);
      const netV = net ? net.vector : [0, 0, 0];
      for (let k = 0; k < 3; k++) expect(Math.abs(sum[k] - netV[k]), `${p.scene} net[${k}]`).toBeLessThan(1e-9);
      expect(Math.abs(obs.a - netV[0] / c.m), `${p.scene} a`).toBeLessThan(1e-9);
      const acc = pl.arrows.find(a => a.kind === "acceleration" && a.origin[2] === 0);
      if (acc) expect(acc.vector[0]).toBeCloseTo(obs.a, 12);
      const vel = pl.arrows.find(a => a.kind === "velocity" && a.origin[2] === 0);
      if (vel) expect(vel.vector[0]).toBeCloseTo(obs.v, 12);
      // 摩擦沿接觸面（y = 0）且與相對運動趨勢反向
      const fr = pl.arrows.find(a => a.kind === "friction" && a.origin[2] === 0);
      if (fr) {
        expect(fr.vector[1]).toBe(0);
        const vRel = p.scene === "bus" ? s.a.v - busAt(p, s.t).v : p.scene === "cloth" && s.phase === 0 ? s.a.v - p.vCloth : s.a.v;
        if (vRel !== 0) expect(Math.sign(fr.vector[0])).toBe(-Math.sign(vRel));
      }
      // 法向反作用力垂直向上、重量垂直向下
      for (const a of pl.arrows) { if (a.kind === "normal") { expect(a.vector[0]).toBe(0); expect(a.vector[1]).toBeGreaterThan(0); } if (a.kind === "weight") { expect(a.vector[0]).toBe(0); expect(a.vector[1]).toBeLessThan(0); } }
      for (const a of pl.arrows) { expect(typeof pl.scales[a.kind]).toBe("number"); expect(a.vector[2]).toBe(0); }   // 座標約定：箭嘴只在 x、y
      for (const l of pl.labels) { expect(l.value, `${p.scene} label ${l.symbol}`).toBe(obs[l.symbol]); expect(UNITS_ALLOWED).toContain(l.unit); }
      for (const [k, v] of Object.entries(pl.meta!)) expect(Number.isFinite(v), `${p.scene} meta ${k}`).toBe(true);
    }
  });

  it("圖層關閉時箭嘴不畫；淨力為零時不畫零長箭嘴", () => {
    const p = table(); const s = advance(p, 0.5).s;
    const none = plan(s, p, model.observe(s, p), { weight: false, normal: false, friction: false, applied: false, net: false, velocity: false, acceleration: false, netOnly: false });
    expect(none.arrows).toHaveLength(0);
    const q = table({ f1: 0, f2: 0 }); const r = advance(q, 1, 1e-3, (_s, i) => (i === 500 ? { ...q, push: "off" } : undefined));
    expect(mk(r.s, r.p).arrows.filter(a => a.layer === "net")).toHaveLength(0);
  });

  it("預測上界涵蓋整段運動（施力／引擎在 HOLD 秒內放手／關掉）且有限；一直按着時 meta.sSeen / vSeen 只增不減", () => {
    for (const p of [table(), table({ F: 10, m: 0.1, f2: 0 }), { ...defaults, scene: "cloth" as const }, { ...defaults, scene: "bus" as const }, { ...defaults, scene: "space" as const, Fe: 5, trio: true }]) {
      const e = extent(p); for (const v of Object.values(e)) expect(Number.isFinite(v) && v > 0).toBe(true);
      let s = model.init(p); let smax = 0, vmax = 0; let q = p;
      for (let i = 0; i < 600; i++) { if (s.t >= HOLD) q = { ...p, push: "off", engine: "off" }; s = model.step(s, q, duration(p) / 600); const o = model.observe(s, q); smax = Math.max(smax, Math.abs(p.scene === "bus" ? o.sRel : o.s)); vmax = Math.max(vmax, Math.abs(o.v)); }
      expect(smax).toBeLessThanOrEqual(e.smax + 1e-9); expect(vmax).toBeLessThanOrEqual(e.vmax + 1e-9);
    }
    // 一直按着：sSeen / vSeen 隨時間單調不減，且等於至今的最大值
    const p = table({ F: 10, m: 0.1, f2: 0 }); let s = model.init(p); let prevS = 0, prevV = 0;
    for (let i = 0; i < 200; i++) { s = model.step(s, p, 0.05); const m = mk(s, p).meta!; expect(m.sSeen).toBeGreaterThanOrEqual(prevS); expect(m.vSeen).toBeGreaterThanOrEqual(prevV); expect(m.vSeen).toBeCloseTo(Math.abs(s.a.v), 9); prevS = m.sSeen; prevV = m.vSeen; }
  }, 60000);

  it("控制範圍內隨機 50 組參數：無 NaN / Infinity，箭嘴長度有界", () => {
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const scenes: P["scene"][] = ["table", "cloth", "bus", "space"];
    for (let k = 0; k < 50; k++) {
      const p: P = { ...defaults, scene: scenes[k % 4] };
      for (const c of controls) {
        if (c.kind === "segment" || c.kind === "select") (p as unknown as Record<string, unknown>)[c.key] = c.options![Math.floor(rnd() * c.options!.length)].value;
        else if (c.kind === "toggle") (p as unknown as Record<string, unknown>)[c.key] = rnd() < 0.5;
        else if (c.key !== "scene") (p as unknown as Record<string, unknown>)[c.key] = c.min! + rnd() * (c.max! - c.min!);
      }
      p.scene = scenes[k % 4];
      let s = model.init(p); let bad = 0; const T = duration(p);
      for (let i = 0; i < 300; i++) {
        s = model.step(s, p, T / 300);
        const pl = plan(s, p, model.observe(s, p), all);
        for (const a of pl.arrows) for (const c of a.vector) if (!Number.isFinite(c) || Math.abs(c) >= 1e5) bad++;
        for (const b of pl.bodies!) for (const c of b.position) if (!Number.isFinite(c)) bad++;
        for (const v of Object.values(pl.meta!)) if (!Number.isFinite(v)) bad++;
      }
      expect(bad, `case ${k} ${p.scene}`).toBe(0);
    }
  }, 60000);   // CI runner 較慢（第一次部署時 5 s 內未跑完）

  it("第二個方塊在 lane 1，箭嘴與模型一致；三艘飛船各在自己的 lane", () => {
    const p = table({ second: true, mB: 1, f1: 0, f2: 0 }); const s = advance(p, 0.5).s; const pl = mk(s, p); const o = model.observe(s, p);
    const bB = pl.bodies!.find(b => b.key === "blockB")!; expect(bB.position[2]).toBe(1); expect(bB.position[0]).toBe(s.b.s);
    expect(pl.arrows.find(a => a.kind === "velocity" && a.origin[2] === 1)!.vector[0]).toBeCloseTo(o.vB, 12);
    const q: P = { ...defaults, scene: "space", trio: true }; const t = advance(q, 1).s; const ql = mk(t, q);
    expect(ql.bodies!.map(b => b.key)).toEqual(["ship", "shipR", "shipL"]);
    expect(ql.arrows.filter(a => a.kind === "velocity")).toHaveLength(2);   // 主飛船 v = 0 不畫
  });

  const _a: ArrowPlan | undefined = undefined; void _a;
});
