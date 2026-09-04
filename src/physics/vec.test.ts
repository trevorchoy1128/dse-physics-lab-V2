import { describe, it, expect } from "vitest";
import { add, sub, scale, dot, cross, norm, unit, sum, resolve, angleBetween } from "./vec";

describe("vec", () => {
  it("基本運算", () => {
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(sub([1, 2, 3], [4, 5, 6])).toEqual([-3, -3, -3]);
    expect(scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(norm([3, 4, 0])).toBe(5);
    expect(unit([0, 0, 0])).toEqual([0, 0, 0]);
    expect(sum([1, 0, 0], [0, 1, 0], [0, 0, 1])).toEqual([1, 1, 1]);
  });
  it("分解：30° 的 10 N → (8.66, 5.00)", () => {
    const [x, y] = resolve(10, Math.PI / 6);
    expect(x).toBeCloseTo(8.660, 3); expect(y).toBeCloseTo(5, 9);
    expect(angleBetween([1, 0, 0], [0, 1, 0])).toBeCloseTo(Math.PI / 2, 12);
  });
});
