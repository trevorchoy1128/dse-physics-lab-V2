import { describe, it, expect } from "vitest";
import { model, type P, type S } from "./model";

// 每個 it() 的名稱 = 規格「驗證條件」的中文原句。先寫測試，再寫 model。
const run = (p: P, T: number, dt = 1e-3) => {
  let s: S = model.init(p);
  const trace: S[] = [s];
  for (let i = 0; i * dt < T; i++) { s = model.step(s, p, dt); trace.push(s); }
  return trace;
};

describe("自由下落（範本）", () => {
  const p: P = { h: 20, g: 9.81 };

  it("落地時間與解析解 t = √(2h/g) 相符（相對誤差 ≤ 1e-3，受步長限制）", () => {
    const trace = run(p, 5);
    const landed = trace.find(s => s.landed)!;
    const tExact = Math.sqrt((2 * p.h) / p.g);
    expect(Math.abs(landed.t - tExact) / tExact).toBeLessThan(1e-3);
  });

  it("下落途中 v 與解析解 v = −gt 相符（相對誤差 ≤ 1e-6）", () => {
    const trace = run(p, 1);
    for (const s of trace.slice(1)) {
      if (s.landed) break;
      expect(Math.abs(s.v - -p.g * s.t)).toBeLessThan(1e-6 * p.g * Math.max(s.t, 1e-3) + 1e-9);
    }
  });

  it("加速度在最高點（t = 0）不為零，等於 g", () => {
    const s = model.init(p);
    expect(model.observe(s, p).a).toBeCloseTo(-p.g, 12);
  });

  it("機械能守恆：½v² + gy 的漂移 ≤ 1e-6", () => {
    const trace = run(p, 1);
    const E0 = p.g * p.h;
    for (const s of trace) if (!s.landed) expect(Math.abs(0.5 * s.v * s.v + p.g * s.y - E0)).toBeLessThan(1e-6);
  });
});
