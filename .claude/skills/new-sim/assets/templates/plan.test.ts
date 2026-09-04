import { describe, it, expect } from "vitest";
import { model, type P } from "./model";
import { plan } from "./plan";
import { UNITS_ALLOWED } from "@/shell/units";

// 畫面正確：箭嘴方向 / 大小 / 起點、縮放一致、標籤 = observe、隨機參數無 NaN
const all = { velocity: true, acceleration: true, weight: true };

describe("自由下落（範本）畫面", () => {
  const p: P = { h: 20, g: 9.81 };

  it("加速度箭嘴全程等於 (0, −g, 0)，與速度無關", () => {
    let s = model.init(p);
    for (let i = 0; i < 500; i++) {
      s = model.step(s, p, 1e-3);
      const a = plan(s, p, model.observe(s, p), all).arrows.find(x => x.kind === "acceleration")!;
      expect(a.vector).toEqual([0, -p.g, 0]);
    }
  });

  it("t = 0 時速度箭嘴為零向量，加速度箭嘴不為零", () => {
    const s = model.init(p);
    const pl = plan(s, p, model.observe(s, p), all);
    expect(pl.arrows.find(x => x.kind === "velocity")!.vector).toEqual([0, 0, 0]);
    expect(pl.arrows.find(x => x.kind === "acceleration")!.vector[1]).toBeLessThan(0);
  });

  it("所有箭嘴由物體位置出發", () => {
    let s = model.init(p); s = model.step(s, p, 0.5);
    for (const a of plan(s, p, model.observe(s, p), all).arrows) expect(a.origin).toEqual([0, s.y, 0]);
  });

  it("同一 kind 只有一個縮放係數；力與速度各自一致", () => {
    const pl = plan(model.init(p), p, model.observe(model.init(p), p), all);
    for (const a of pl.arrows) expect(typeof pl.scales[a.kind]).toBe("number");
  });

  it("標籤數值等於 observe()，單位在允許清單內", () => {
    const s = model.init(p); const obs = model.observe(s, p);
    for (const l of plan(s, p, obs, all).labels) {
      expect(l.value).toBe(obs[l.symbol]);
      expect(UNITS_ALLOWED).toContain(l.unit);
    }
  });

  it("控制範圍內隨機 50 組參數：無 NaN / Infinity，箭嘴長度有界", () => {
    let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 50; k++) {
      const q: P = { h: 1 + rnd() * 49, g: [9.81, 9.8, 10][k % 3] };
      let s = model.init(q);
      for (let i = 0; i < 300; i++) {
        s = model.step(s, q, 1e-2);
        for (const a of plan(s, q, model.observe(s, q), all).arrows) {
          for (const c of a.vector) { expect(Number.isFinite(c)).toBe(true); expect(Math.abs(c)).toBeLessThan(1e4); }
        }
      }
    }
  });
});
