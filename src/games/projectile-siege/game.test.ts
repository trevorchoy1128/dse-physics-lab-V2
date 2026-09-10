import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { flightTime, maxHeight, minSpeedTo, range, simulateShot, solutions, starsFor } from "./game";

describe("拋體攻城：物理與 #033 解析解一致", () => {
  it("u = 20, θ = 45°, g = 9.81：R = u²/g", () => {
    expect(range(20, 45, 0, 9.81)).toBeCloseTo(400 / 9.81, 6);
    expect(flightTime(20, 45, 0, 9.81)).toBeCloseTo((2 * 20 * Math.SQRT1_2) / 9.81, 6);
    expect(maxHeight(20, 45, 0, 9.81)).toBeCloseTo(200 / 9.81 / 2, 6);
  });
  it("懸崖平射：t = √(2h/g)，x = ut", () => {
    expect(flightTime(10, 0, 20, 9.81)).toBeCloseTo(Math.sqrt(40 / 9.81), 9);
    expect(range(10, 0, 20, 9.81)).toBeCloseTo(10 * Math.sqrt(40 / 9.81), 9);
  });
  it("最小初速：平地 u² = gR", () => { expect(minSpeedTo(40, 0, 0, 9.81) ** 2).toBeCloseTo(40 * 9.81, 9); });
  it("落地：xEnd 等於解析射程，miss 為 xEnd − 目標", () => {
    const L = LEVELS[0]; const r = simulateShot(L, 12, 45);
    expect(r.outcome).toBe("ground"); expect(r.xEnd).toBeCloseTo(144 / 9.81, 6); expect(r.miss).toBeCloseTo(144 / 9.81 - 30, 6);
    expect(r.path.at(-1)![1]).toBe(0);
  });
  it("牆擋住低射", () => { const L = LEVELS.find(l => l.id === "wall")!; expect(simulateShot(L, 21, 30).outcome).toBe("block"); });
  it("橋擋住高射", () => { const L = LEVELS.find(l => l.id === "bridge")!; expect(simulateShot(L, 22, 45).outcome).toBe("block"); });
});

describe("每關有解（滑桿格點窮舉）", () => {
  for (const L of LEVELS) {
    it(`${L.id}：預設不命中，且至少一組 (u, θ) 命中`, () => {
      expect(simulateShot(L, L.start.u, L.start.theta).outcome).not.toBe("hit");
      expect(solutions(L).length).toBeGreaterThan(0);
    }, 30000);
  }
  it("twin：45° 兩側都有解", () => {
    const sol = solutions(LEVELS.find(l => l.id === "twin")!);
    expect(sol.some(([, th]) => th < 45)).toBe(true); expect(sol.some(([, th]) => th > 45)).toBe(true);
  });
  it("economy：存在三星解", () => {
    const L = LEVELS.find(l => l.id === "economy")!;
    expect(solutions(L).some(([u, th]) => starsFor(L, { shots: 1, u, theta: th, hitBothSides: false }) === 3)).toBe(true);
  });
  it("星數規則", () => {
    const L = LEVELS[0];
    expect(starsFor(L, { shots: 1, u: 20, theta: 45, hitBothSides: false })).toBe(3);
    expect(starsFor(L, { shots: 3, u: 20, theta: 45, hitBothSides: false })).toBe(2);
    expect(starsFor(L, { shots: 4, u: 20, theta: 45, hitBothSides: false })).toBe(1);
  });
});
