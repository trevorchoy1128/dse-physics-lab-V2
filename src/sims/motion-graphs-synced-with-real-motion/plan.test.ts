import { describe, it, expect } from "vitest";
import { model, type P, type S } from "./model";
import { plan, trackExtent } from "./plan";
import { UNITS_ALLOWED } from "@/shell/units";

const all = { velocity: true, acceleration: true, tangent: true, area: true };
const live = (u: number, a: number, T = 10): P => ({ mode: "live", u, a, T, vt: Array.from({ length: T + 1 }, () => 0) });
const draw = (vt: number[]): P => ({ mode: "draw", u: 0, a: 0, T: vt.length - 1, vt });
const advance = (p: P, T: number) => { let s: S = model.init(p); for (let i = 0; i < Math.round(T / 1e-3); i++) s = model.step(s, p, 1e-3); return s; };

describe("運動線圖 畫面", () => {
  it("速度箭嘴 = 模型 v，加速度箭嘴 = 模型 a，都沿 x 軸，起點在小車", () => {
    const p = live(2, 1.5);
    for (const T of [0, 0.5, 2, 4]) {
      const s = advance(p, T); const pl = plan(s, p, model.observe(s, p), all);
      const v = pl.arrows.find(x => x.kind === "velocity")!, a = pl.arrows.find(x => x.kind === "acceleration")!;
      expect(v.vector).toEqual([s.v, 0, 0]);
      expect(a.vector).toEqual([1.5, 0, 0]);
      expect(v.origin[0]).toBe(s.s); expect(a.origin[0]).toBe(s.s);
      expect(pl.bodies![0].position).toEqual([s.s, 0, 0]);
    }
  });
  it("三條線圖的最後一點 = 當前狀態；v–t 線下面積 = 位移", () => {
    const p = draw([0, 2, 2, 0, -2, -2, 0, 0, 0, 0, 0]);
    const s = advance(p, 7); const pl = plan(s, p, model.observe(s, p), all);
    const last = (k: string) => pl.trails!.find(t => t.key === k)!.points.at(-1)!;
    expect(last("s-t")[1]).toBeCloseTo(s.s, 12); expect(last("v-t")[1]).toBeCloseTo(s.v, 12);
    const vt = pl.trails!.find(t => t.key === "v-t")!.points;
    const area = vt.slice(1).reduce((acc, q, i) => acc + 0.5 * (vt[i][1] + q[1]) * (q[0] - vt[i][0]), 0);
    expect(Math.abs(area - s.s)).toBeLessThan(1e-6);
    expect(pl.meta!.area).toBe(1);
  });
  it("由圖生成運動：控制點軌跡 = vt 參數，不在 live 模式出現", () => {
    const vt = [0, 1, 3, 3, 0, -2, -2, 1, 1, 0, 0]; const p = draw(vt);
    const s = model.init(p); const pl = plan(s, p, model.observe(s, p), all);
    expect(pl.trails!.find(t => t.key === "vt-handles")!.points.map(q => q[1])).toEqual(vt);
    // T 大於 vt 長度：補齊至 T + 1 個，以最後值延續
    const p20: P = { ...p, T: 20 }; const pl20 = plan(model.init(p20), p20, model.observe(model.init(p20), p20), all);
    const h20 = pl20.trails!.find(t => t.key === "vt-handles")!.points;
    expect(h20).toHaveLength(21); expect(h20[20][1]).toBe(vt[10]); expect(h20[10][1]).toBe(vt[10]);
    expect(plan(model.init(live(0, 1)), live(0, 1), model.observe(model.init(live(0, 1)), live(0, 1)), all).trails!.some(t => t.key === "vt-handles")).toBe(false);
  });
  it("同一 kind 一個縮放係數；標籤 = observe；單位在允許清單", () => {
    const p = live(1, 1); const s = model.init(p); const obs = model.observe(s, p); const pl = plan(s, p, obs, all);
    for (const a of pl.arrows) expect(typeof pl.scales[a.kind]).toBe("number");
    for (const l of pl.labels) { expect(l.value).toBe(obs[l.symbol]); expect(UNITS_ALLOWED).toContain(l.unit); }
  });
  it("圖層關閉時箭嘴不畫；meta 旗標跟隨圖層", () => {
    const p = live(1, 1); const s = model.init(p);
    const pl = plan(s, p, model.observe(s, p), { velocity: false, acceleration: false, tangent: false, area: false });
    expect(pl.arrows).toHaveLength(0); expect(pl.meta!.tangent).toBe(0); expect(pl.meta!.area).toBe(0);
  });
  it("軌道範圍涵蓋整段運動且取好看刻度", () => {
    expect(trackExtent(live(0, 1, 10))).toBe(50);          // ½·1·100 = 50
    expect(trackExtent(live(5, 10, 20))).toBe(3000);       // 100 + 2000 = 2100 → 超出清單即向上取整至 1000 的倍數
    expect(trackExtent(draw([2, 2, 2, 2, 2, -2, -2, -2, -2, -2, -2]))).toBe(50);
    const p = live(0, 1, 10);
    for (const T of [0, 5, 10]) expect(Math.abs(advance(p, T).s)).toBeLessThanOrEqual(trackExtent(p) + 1e-9);
  });
  it("控制範圍內隨機 50 組參數：無 NaN / Infinity，箭嘴長度有界", () => {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 50; k++) {
      const T = [5, 10, 20][k % 3];
      const p: P = k % 2 ? live(-5 + rnd() * 10, -10 + rnd() * 20, T) : draw(Array.from({ length: T + 1 }, () => -5 + rnd() * 10));
      let s = model.init(p); let bad = 0;
      for (let i = 0; i < 400; i++) {
        s = model.step(s, p, 0.01);
        const pl = plan(s, p, model.observe(s, p), all);
        for (const a of pl.arrows) for (const c of a.vector) if (!Number.isFinite(c) || Math.abs(c) >= 1e4) bad++;
        if (i === 399) for (const tr of pl.trails!) for (const q of tr.points) if (!Number.isFinite(q[1])) bad++;
      }
      expect(bad).toBe(0);
    }
  });
});
