import { describe, it, expect } from "vitest";
import { rk4, semiImplicitEuler } from "./integrators";

describe("rk4", () => {
  it("自由下落（二次多項式）與解析解一致，相對誤差 < 1e-10", () => {
    const g = 9.81; let y = [20, 0]; let t = 0; const dt = 1e-3;
    for (let i = 0; i < 1000; i++) { y = rk4((_t, s) => [s[1], -g], y, t, dt); t += dt; }
    expect(Math.abs(y[0] - (20 - 0.5 * g * 1)) / 20).toBeLessThan(1e-10);
    expect(Math.abs(y[1] - -g * 1) / g).toBeLessThan(1e-10);
  });
  it("簡諧振動一個週期後回到原點，誤差 < 1e-8", () => {
    const w = 2 * Math.PI; let y = [1, 0]; let t = 0; const dt = 1e-3;
    for (let i = 0; i < 1000; i++) { y = rk4((_t, s) => [s[1], -w * w * s[0]], y, t, dt); t += dt; }
    expect(Math.abs(y[0] - 1)).toBeLessThan(1e-8);
    expect(Math.abs(y[1])).toBeLessThan(1e-7);
  });
});

describe("semiImplicitEuler", () => {
  it("簡諧振動 100 個週期能量漂移 < 1e-3", () => {
    const w = 1; let x = [1], v = [0]; let t = 0; const dt = 1e-3;
    const E = () => 0.5 * v[0] ** 2 + 0.5 * w * w * x[0] ** 2;
    const E0 = E();
    for (let i = 0; i < 100 * 2 * Math.PI / dt; i++) { [x, v] = semiImplicitEuler((_t, xx) => [-w * w * xx[0]], x, v, t, dt); t += dt; }
    expect(Math.abs(E() - E0) / E0).toBeLessThan(1e-3);
  });
});
