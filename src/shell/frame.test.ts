import { describe, it, expect } from "vitest";
import { X, Y, Z } from "./frame";
import { cross } from "@/physics/vec";
import { Vector3, Quaternion } from "three";

describe("座標約定", () => {
  it("x × y = z（右手系）", () => {
    expect(cross(X, Y)).toEqual(Z);
    expect(cross(Y, Z)).toEqual(X);
    expect(cross(Z, X)).toEqual(Y);
  });
  it("three.js 的叉積與我們一致", () => {
    const c = new Vector3(...X).cross(new Vector3(...Y));
    expect([c.x, c.y, c.z]).toEqual(Z);
  });
  it("繞 +y 旋轉 90° 把 +x 轉到 −z（右手定則）", () => {
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    const v = new Vector3(1, 0, 0).applyQuaternion(q);
    expect(v.x).toBeCloseTo(0, 12); expect(v.z).toBeCloseTo(-1, 12);
  });
});
