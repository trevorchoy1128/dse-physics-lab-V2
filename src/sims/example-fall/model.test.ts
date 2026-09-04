import { describe, it, expect } from "vitest";
import { model, type P, type S } from "./model";

const run = (p: P, T: number, dt = 1e-3) => {
  let s: S = model.init(p); const trace: S[] = [s];
  for (let i = 0; i * dt < T; i++) { s = model.step(s, p, dt); trace.push(s); }
  return trace;
};

describe("自由下落（範本）", () => {
  const p: P = { h: 20, m: 1, g: 9.81 };

  it("落地時間與解析解 t = √(2h/g) 相符（誤差 ≤ 一步）", () => {
    const landed = run(p, 5).find(s => s.landed)!;
    const tExact = Math.sqrt((2 * p.h) / p.g);
    expect(Math.abs(landed.t - tExact)).toBeLessThan(1e-3 + 1e-9);
  });

  it("下落途中 v = −gt（絕對誤差 ≤ 1e-9）", () => {
    for (const s of run(p, 1).slice(1)) { if (s.landed) break; expect(Math.abs(s.v - -p.g * s.t)).toBeLessThan(1e-9); }
  });

  it("t = 0 時 v = 0 但 a = −g", () => {
    const s = model.init(p);
    expect(s.v).toBe(0);
    expect(model.observe(s, p).a).toBeCloseTo(-p.g, 12);
  });

  it("機械能守恆：Ek + Ep 漂移 ≤ 1e-6 J", () => {
    const E0 = p.m * p.g * p.h;
    for (const s of run(p, 1)) { if (s.landed) break; const o = model.observe(s, p); expect(Math.abs(o.Ek + o.Ep - E0)).toBeLessThan(1e-6); }
  });

  it("落地事件只發生一次", () => {
    let s = model.init(p); let n = 0;
    for (let i = 0; i < 5000; i++) { const nx = model.step(s, p, 1e-3); n += model.events!(s, nx, p).length; s = nx; }
    expect(n).toBe(1);
  });
});
