import { describe, it, expect } from "vitest";
import { cross } from "@/physics/vec";

describe("左右手基準", () => {
  it("I 向右、B 入紙 ⇒ F 向上", () => {
    expect(cross([1, 0, 0], [0, 0, -1])).toEqual([0, 1, 0]);
  });
  it("B 出紙時 F 向下", () => {
    expect(cross([1, 0, 0], [0, 0, 1])).toEqual([0, -1, 0]);
  });
});
