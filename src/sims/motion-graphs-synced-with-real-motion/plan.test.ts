import { describe, it, expect } from "vitest";
import { model, type P, type S } from "./model";
import { plan, trackExtent, axesFor, type Axes } from "./plan";
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
    // 0.6.0：T > 10 s 時仍是 11 點，間距 T/10，橫跨整個時間窗
    const p20: P = { ...p, T: 20 }; const pl20 = plan(model.init(p20), p20, model.observe(model.init(p20), p20), all);
    const h20 = pl20.trails!.find(t => t.key === "vt-handles")!.points;
    expect(h20).toHaveLength(11); expect(h20[10]).toEqual([20, vt[10], 0]); expect(h20[5][0]).toBe(10);
    expect(plan(model.init(live(0, 1)), live(0, 1), model.observe(model.init(live(0, 1)), live(0, 1)), all).trails!.some(t => t.key === "vt-handles")).toBe(false);
  });
  it("同一 kind 一個縮放係數；標籤 = observe；單位在允許清單", () => {
    const p = live(1, 1); const s = model.init(p); const obs = model.observe(s, p); const pl = plan(s, p, obs, all);
    for (const a of pl.arrows) expect(typeof pl.scales[a.kind]).toBe("number");
    for (const l of pl.labels) { expect(l.value).toBe(obs[l.symbol]); expect(UNITS_ALLOWED).toContain(l.unit); }
  });
  it("meta 內所有數值有限（NaN 會令畫布比例失效，第 4 輪 F7）；標籤與起點用歸零後的 s（F6）", () => {
    const p = draw([2, 1.6, 1.2, 0.8, 0.4, 0, -0.4, -0.8, -1.2, -1.6, -2]);
    const s = advance(p, 10.5); const obs = model.observe(s, p); const pl = plan(s, p, obs, all);
    for (const [k, v] of Object.entries(pl.meta!)) expect(Number.isFinite(v), k).toBe(true);
    expect(obs.s).toBe(0);
    expect(pl.labels[0].value).toBe(0); expect(pl.labels[0].position[0]).toBe(0);
    for (const a of pl.arrows) expect(a.origin[0]).toBe(0);
    expect(pl.arrows.find(a => a.kind === "velocity")!.vector[0]).toBeCloseTo(-2, 12);
  });

  it("圖層關閉時箭嘴不畫；meta 旗標跟隨圖層", () => {
    const p = live(1, 1); const s = model.init(p);
    const pl = plan(s, p, model.observe(s, p), { velocity: false, acceleration: false, tangent: false, area: false });
    expect(pl.arrows).toHaveLength(0); expect(pl.meta!.tangent).toBe(0); expect(pl.meta!.area).toBe(0);
  });
  it("軌道範圍涵蓋整段運動且取好看刻度", () => {
    expect(trackExtent(live(0, 1, 10))).toBe(50);          // ½·1·100 = 50
    expect(trackExtent(live(5, 10, 20))).toBe(3000);       // 100 + 2000 = 2100 → 超出清單即向上取整至 1000 的倍數
    expect(trackExtent(draw([2, 2, 2, 2, 2, -2, -2, -2, -2, -2, -2]))).toBe(10);   // 精確極值：t = 4.5 s 時 s = 9（0.4.x 用 Σ|v| 上界得 50）
    // 控制點以外的保持段要計入（核數員第 7 輪 F9）：末值 −2 再走 50 s
    // 0.6.0：T > 10 s 時控制點間距為 T/10，折線橫跨整個時間窗
    expect(trackExtent({ ...draw([0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2]), T: 60 })).toBeGreaterThanOrEqual(90);    // 節點 8 時 s = 15 × 6 = 90
    expect(trackExtent({ ...draw([5, -5, 5, -5, 5, -5, 5, -5, 5, -5, 5]), T: 60 })).toBeGreaterThanOrEqual(7.5);  // 段內峰值 5 × 3 / 2
    for (const T of [2, 7, 10, 20, 45, 60]) {   // 任何 T 下 |s| 都不出軸
      const p = { ...draw([0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2]), T };
      let s: S = model.init(p); let m = 0; for (let i = 0; i < Math.round(T / 1e-3); i++) { s = model.step(s, p, 1e-3); m = Math.max(m, Math.abs(s.s)); }
      expect(m).toBeLessThanOrEqual(trackExtent(p) + 1e-9);
    }
    // 控制點位置：T = 45 s 時 11 點在 0, 4.5, …, 45 s；T = 5 s 時 6 點在 0…5 s
    const h45 = plan(model.init({ ...draw([0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2]), T: 45 }), { ...draw([0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2]), T: 45 }, {}, all).trails!.find(t => t.key === "vt-handles")!.points;
    expect(h45.map(q => q[0])).toEqual([0, 4.5, 9, 13.5, 18, 22.5, 27, 31.5, 36, 40.5, 45]);
    const h5 = plan(model.init({ ...draw([0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2]), T: 5 }), { ...draw([0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2]), T: 5 }, {}, all).trails!.find(t => t.key === "vt-handles")!.points;
    expect(h5.map(q => q[0])).toEqual([0, 1, 2, 3, 4, 5]);
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
  it("線圖軸範圍在整段運行中每一幀相同（老師：主格線不可中途改變）", () => {
    const cases: P[] = [
      live(0, 1, 10), live(3, -9.81, 5), live(0, 0, 10), live(5, 10, 20), live(-5, -10, 2), live(2, -1, 60),
      draw([2, 1.6, 1.2, 0.8, 0.4, 0, -0.4, -0.8, -1.2, -1.6, -2]), draw([2, 2, 2, 2, 2, -2, -2, -2, -2, -2, -2]),
      { ...draw([0, 1, 2, 3, 3, 3, 2, 1, 0, -1, -2]), T: 45 },
    ];
    for (let k = 0; k < 20; k++) cases.push(live(Math.round((Math.random() * 10 - 5) * 2) / 2, Math.round((Math.random() * 20 - 10) * 2) / 2, 2 + Math.floor(Math.random() * 59)));
    for (const p of cases) {
      let s: S = model.init(p); let ax: Axes = { s: 0, v: 0, a: 0, t: 0 };
      ax = axesFor(ax, plan(s, p, model.observe(s, p), all).meta!); const first = { ...ax };
      const n = Math.round(p.T / 1e-3) + 50;   // 走過 T 之後的凍結幀也要相同
      for (let i = 0; i < n; i++) {
        s = model.step(s, p, 1e-3);
        if (i % 25 === 0 || i === n - 1) { ax = axesFor(ax, plan(s, p, model.observe(s, p), all).meta!); expect([ax.s, ax.v, ax.a], JSON.stringify(p) + " t=" + s.t).toEqual([first.s, first.v, first.a]); }
      }
    }
  });
});
