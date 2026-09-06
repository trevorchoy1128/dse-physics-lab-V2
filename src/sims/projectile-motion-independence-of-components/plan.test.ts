import { describe, it, expect } from "vitest";
import { model, type P, type S } from "./model";
import { plan, extent, duration, GHOST_ANGLES, WORLD, BALL_R, A_OFF } from "./plan";
import { UNITS_ALLOWED } from "@/shell/units";
import type { Vec3 } from "@/shell/types";

// 畫面正確：箭嘴方向 / 大小 / 起點、F = ma 一致、縮放一致、標籤 = observe、隨機參數無 NaN
const base: P = { u: 15, theta: 40, h: 0, g: 9.81, m: 1, air: false, companion: "fast" };
const ALL = { velocity: true, vx: true, vy: true, acceleration: true, weight: true, air: true, strobe: true, path: true, ghosts: true };
const DT = 1e-3;
const at = (p: P, t: number) => { let s: S = model.init(p); for (let i = 0; i < Math.round(t / DT); i++) s = model.step(s, p, DT); return s; };
const planAt = (p: P, t: number, layers = ALL) => { const s = at(p, t); return { s, pl: plan(s, p, model.observe(s, p), layers) }; };
const arrowsOf = (pl: ReturnType<typeof plan>, layer: string) => pl.arrows.filter(x => x.layer === layer);

describe("拋體運動（S2）畫面", () => {
  it("加速度箭嘴全程等於 (0, −g, 0)，最高點亦然；與速度無關", () => {
    const p = { ...base, companion: "none" as const };
    for (let t = 0; t < 1.9; t += 0.05) {
      const { pl } = planAt(p, t);
      expect(arrowsOf(pl, "acceleration")[0].vector).toEqual([0, -p.g, 0]);
    }
  });

  it("速度箭嘴 = (vₓ, vᵧ, 0)，分量箭嘴各取一個分量；最高點 vᵧ 箭嘴為零、vₓ 箭嘴不變", () => {
    const p = { ...base, companion: "none" as const };
    const ux = p.u * Math.cos((p.theta * Math.PI) / 180);
    for (const t of [0.2, 0.983, 1.5]) {
      const { s, pl } = planAt(p, t);
      expect(arrowsOf(pl, "velocity")[0].vector).toEqual([s.a.vx, s.a.vy, 0]);
      expect(arrowsOf(pl, "vx")[0].vector).toEqual([s.a.vx, 0, 0]);
      expect(arrowsOf(pl, "vy")[0].vector).toEqual([0, s.a.vy, 0]);
      expect(Math.abs(arrowsOf(pl, "vx")[0].vector[0] - ux)).toBeLessThan(1e-6);
    }
    const { pl } = planAt(p, 0.983);
    expect(Math.abs(arrowsOf(pl, "vy")[0].vector[1])).toBeLessThan(p.g * DT);
  });

  it("重量箭嘴全程 (0, −mg, 0)；F = ma：力箭嘴之和 = m × 加速度箭嘴（有無空氣阻力皆然）", () => {
    for (const p of [{ ...base, companion: "none" as const }, { ...base, companion: "none" as const, air: true, u: 30 }, { ...base, companion: "none" as const, air: true, u: 30, m: 2.5 }]) {
      for (const t of [0.1, 0.8, 1.5]) {
        const { pl } = planAt(p, t);
        expect(arrowsOf(pl, "weight")[0].vector).toEqual([0, -p.m * p.g, 0]);
        const forces = pl.arrows.filter(x => x.kind === "weight" || x.kind === "friction");
        expect(forces.length).toBe(p.air ? 2 : 1);
        const sum = forces.reduce((acc, f) => [acc[0] + f.vector[0], acc[1] + f.vector[1], acc[2] + f.vector[2]], [0, 0, 0]);
        const a = arrowsOf(pl, "acceleration")[0].vector;
        for (let i = 0; i < 3; i++) expect(Math.abs(sum[i] - p.m * a[i])).toBeLessThan(1e-9);
      }
    }
  });

  it("所有箭嘴由對應的球心出發；球心 = 物理位置 × k + 球半徑", () => {
    const { s, pl } = planAt(base, 0.6);
    const k = pl.meta!.k;
    const ballA = pl.bodies!.find(b => b.key === "ball-a")!, ballB = pl.bodies!.find(b => b.key === "ball-b")!;
    expect(ballA.position[0]).toBeCloseTo(s.a.x * k, 9); expect(ballA.position[1]).toBeCloseTo(s.a.y * k + BALL_R, 9); expect(ballA.position[2]).toBe(0);
    expect(ballB.position[1]).toBeCloseTo(s.b!.y * k + BALL_R, 9);
    for (const a of pl.arrows) {
      const ball = a.origin[2] < -1 ? ballB.position : ballA.position;
      // 加速度箭嘴：起點向觀眾方向偏移 A_OFF（畫面約定，避免與同向同長的重量箭嘴重疊），x、y 仍在球心
      const expected: Vec3 = a.kind === "acceleration" ? [ball[0], ball[1], ball[2] + A_OFF] : ball;
      expect(a.origin).toEqual(expected);
    }
  });

  it("同一 kind 只有一個縮放係數；重量與空氣阻力（力）共用同一係數，速度另一係數", () => {
    const { pl } = planAt({ ...base, air: true }, 0.5);
    for (const a of pl.arrows) expect(typeof pl.scales[a.kind]).toBe("number");
    expect(pl.scales.weight).toBe(pl.scales.friction);
    expect(pl.scales.velocity).not.toBe(pl.scales.weight);
  });

  it("標籤數值等於 observe()，單位在允許清單內", () => {
    const s = at(base, 0.4); const obs = model.observe(s, base);
    for (const l of plan(s, base, obs, ALL).labels) { expect(l.value).toBe(obs[l.symbol]); expect(UNITS_ALLOWED).toContain(l.unit); }
  });

  it("兩顆球高度相同時，連線 sync 是水平的（只有 z 方向）", () => {
    const { pl } = planAt(base, 0.7);
    const sync = pl.trails!.find(t => t.key === "sync")!;
    expect(Math.abs(sync.points[0][1] - sync.points[1][1])).toBeLessThan(1e-9);
    expect(sync.points[0][2]).not.toBe(sync.points[1][2]);
  });

  it("頻閃影像數 = 模型的頻閃樣本數；圖層關閉時沒有", () => {
    const { s, pl } = planAt(base, 1.0);
    expect(pl.bodies!.filter(b => b.key.startsWith("strobe-a-")).length).toBe(s.strobe.length);
    expect(pl.bodies!.filter(b => b.key.startsWith("strobe-b-")).length).toBe(s.strobeB.length);
    const off = plan(s, base, model.observe(s, base), { ...ALL, strobe: false });
    expect(off.bodies!.filter(b => b.key.startsWith("strobe-")).length).toBe(0);
  });

  it("加速度箭嘴與重量箭嘴畫出長度不同（3.2 對 2.4 個世界單位），無空氣阻力時兩者物理量相等", () => {
    const { pl } = planAt({ ...base, companion: "none" as const }, 0.5);
    const a = arrowsOf(pl, "acceleration")[0], w = arrowsOf(pl, "weight")[0];
    expect(Math.hypot(...a.vector)).toBeCloseTo(Math.hypot(...w.vector), 12);
    expect(Math.hypot(...a.vector) * pl.scales.acceleration!).toBeCloseTo(3.2, 9);
    expect(Math.hypot(...w.vector) * pl.scales.weight!).toBeCloseTo(2.4, 9);
  });

  it("牆左緣高度影子列：有頻閃即有，且 x 固定；第二顆球「同時自由下落」時不畫（該球本身就是高度列）", () => {
    const on = planAt({ ...base, companion: "none" }, 1.0).pl;
    const ycol = on.bodies!.filter(b => b.key.startsWith("ycol-a-"));
    expect(ycol.length).toBeGreaterThan(5);
    for (const b of ycol) expect(b.position[0]).toBe(-0.9);
    const off = planAt({ ...base, theta: 0, h: 20, companion: "drop" }, 1.0).pl;
    expect(off.bodies!.filter(b => b.key.startsWith("ycol-a-")).length).toBe(0);
  });

  it("所有標籤都在地面上方（y ≥ 0）", () => {
    for (const t of [0, 0.5, 1.5]) for (const l of planAt(base, t).pl.labels) expect(l.position[1]).toBeGreaterThanOrEqual(0);
  });

  it("每顆球永遠有一個地面影子，x 與球相同、y 在地面", () => {
    const { pl } = planAt(base, 0.5);
    for (const [ball, sh] of [["ball-a", "gshadow-a"], ["ball-b", "gshadow-b"]]) {
      const b = pl.bodies!.find(x => x.key === ball)!, s = pl.bodies!.find(x => x.key === sh)!;
      expect(s.position[0]).toBe(b.position[0]); expect(s.position[2]).toBe(b.position[2]); expect(s.position[1]).toBeLessThan(0.1);
    }
  });

  it("各角度射程比較：45° 的路徑最遠；15° 與 75°、30° 與 60° 落點相同", () => {
    const p = { ...base, companion: "none" as const, theta: 70 };
    const { pl } = planAt(p, 0.1);
    const endX = Object.fromEntries(GHOST_ANGLES.map(th => { const tr = pl.trails!.find(t => t.key === `ghost-${th}`)!; return [th, tr.points[tr.points.length - 1][0]]; }));
    expect(Math.max(...Object.values(endX))).toBe(endX[45]);
    expect(Math.abs(endX[15] - endX[75])).toBeLessThan(1e-9);
    expect(Math.abs(endX[30] - endX[60])).toBeLessThan(1e-9);
    for (const th of GHOST_ANGLES) for (const pt of pl.trails!.find(t => t.key === `ghost-${th}`)!.points) expect(pt[1]).toBeGreaterThanOrEqual(BALL_R - 1e-9);
  });

  it("動能—時間軌跡 = 模型的 hist；最低點不為零且 ≈ ½ m vₓ²", () => {
    const p = { ...base, companion: "none" as const };
    const { s, pl } = planAt(p, 2.0);
    const ek = pl.trails!.find(t => t.key === "Ek-t")!;
    expect(ek.points.length).toBe(s.hist.length);
    ek.points.forEach((pt, i) => { expect(pt[0]).toBe(s.hist[i].t); expect(pt[1]).toBe(s.hist[i].Ek); });
    const min = Math.min(...ek.points.map(pt => pt[1]));
    expect(min).toBeGreaterThan(0);
    expect(Math.abs(min - pl.meta!.EkMin) / pl.meta!.EkMin).toBeLessThan(1e-4);
  });

  it("時間拉桿上限 duration ≥ 落地時刻（有阻力、小質量亦然）", () => {
    for (const q of [{ ...base, air: true, m: 0.15, companion: "none" as const }, { ...base, air: true, m: 0.1, u: 50, theta: 45, h: 50, companion: "none" as const }, { ...base, air: true, m: 1, companion: "drop" as const, h: 20 }]) {
      let s = model.init(q); let n = 0;
      while (!(s.a.landed && (!s.b || s.b.landed)) && n < 60000) { s = model.step(s, q, DT); n++; }
      expect(s.a.landed).toBe(true);
      expect(duration(q)).toBeGreaterThanOrEqual(s.t);
      expect(duration(q) - s.t).toBeLessThan(0.31);
    }
  });

  it("場景範圍：射程與最高點都落在 WORLD 內；k 在運行中不變", () => {
    for (const p of [base, { ...base, u: 50, g: 1.6, theta: 45 }, { ...base, u: 50, theta: 90, h: 50 }]) {
      const k0 = planAt(p, 0).pl.meta!.k;
      const T = duration(p);
      for (const f of [0.25, 0.5, 0.9]) {
        const { pl } = planAt(p, T * f);
        expect(pl.meta!.k).toBe(k0);
        for (const b of pl.bodies!) { expect(b.position[0]).toBeLessThanOrEqual(WORLD * 1.01); expect(b.position[1]).toBeLessThanOrEqual(WORLD * 1.01); }
      }
      const { L, xMax, yMax } = extent(p, ALL);
      expect(L).toBeGreaterThanOrEqual(xMax); expect(L).toBeGreaterThanOrEqual(1.3 * yMax);
    }
  });

  it("控制範圍內隨機 50 組參數：無 NaN / Infinity，箭嘴畫出長度有界", () => {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const comps = ["none", "drop", "fast"] as const;
    for (let n = 0; n < 50; n++) {
      const q: P = { u: 1 + rnd() * 49, theta: -30 + rnd() * 120, h: rnd() * 50, g: [9.81, 9.8, 10, 3.7, 1.6][n % 5], m: 0.1 + rnd() * 4.9, air: rnd() < 0.3, companion: comps[n % 3] };
      let s = model.init(q);
      const T = duration(q);
      for (let i = 0; i < 40; i++) {
        for (let j = 0; j < 25; j++) s = model.step(s, q, T / 1000);
        const pl = plan(s, q, model.observe(s, q), ALL);
        for (const a of pl.arrows) {
          const len = Math.hypot(...a.vector) * pl.scales[a.kind]!;
          expect(Number.isFinite(len)).toBe(true); expect(len).toBeLessThan(12);
          for (const c of a.origin) expect(Number.isFinite(c)).toBe(true);
        }
        for (const b of pl.bodies!) for (const c of b.position) expect(Number.isFinite(c)).toBe(true);
        for (const v of Object.values(pl.meta!)) expect(Number.isFinite(v)).toBe(true);
      }
    }
  }, 30000);
});
