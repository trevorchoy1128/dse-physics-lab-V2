import { describe, it, expect } from "vitest";
import { arrowTransform, directionOf, ARROW_STYLE } from "./arrowMath";
import type { ArrowKind, Vec3 } from "@/shell/types";

const dirs: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1], [1, 1, 0], [3, -4, 12], [-2, 5, -7]];

describe("箭嘴渲染層", () => {
  it("朝向：旋轉後的 +y 與物理向量方向一致（誤差 1e-12）", () => {
    for (const d of dirs) {
      const tr = arrowTransform(d, 1);
      const got = directionOf(tr.quaternion);
      const n = Math.hypot(...d);
      for (let i = 0; i < 3; i++) expect(got[i]).toBeCloseTo(d[i] / n, 12);
    }
  });
  it("長度 = |vector| × scale；反向向量長度相同", () => {
    expect(arrowTransform([3, 4, 0], 0.5).length).toBeCloseTo(2.5, 12);
    expect(arrowTransform([0, -9.81, 0], 0.2).length).toBeCloseTo(arrowTransform([0, 9.81, 0], 0.2).length, 12);
  });
  it("零向量不畫", () => {
    expect(arrowTransform([0, 0, 0], 1).length).toBe(0);
  });
  it("頭與桿相加等於總長；頭長有上下限", () => {
    for (const L of [0.05, 0.5, 5]) {
      const tr = arrowTransform([0, L, 0], 1);
      expect(tr.headLength + tr.shaftLength).toBeCloseTo(tr.length, 12);
      expect(tr.headLength).toBeGreaterThanOrEqual(Math.min(0.08, L));
      expect(tr.headLength).toBeLessThanOrEqual(0.35);
    }
  });
  it("速度與力的箭頭形狀不同；加速度為虛線；顏色跟規格", () => {
    const forces: ArrowKind[] = ["weight", "normal", "friction", "tension", "net"];
    for (const k of forces) { expect(ARROW_STYLE[k].head).toBe("cone"); expect(ARROW_STYLE[k].dashed).toBe(false); }
    expect(ARROW_STYLE.velocity.head).toBe("open");
    expect(ARROW_STYLE.acceleration.head).toBe("open");
    expect(ARROW_STYLE.acceleration.dashed).toBe(true);
    expect(ARROW_STYLE.velocity.dashed).toBe(false);
    expect(ARROW_STYLE.velocity.color).toBe(ARROW_STYLE.acceleration.color); // 同色系
    expect(ARROW_STYLE.net.width).toBeGreaterThan(ARROW_STYLE.weight.width);   // 合力較粗
    expect(new Set(forces.map(k => ARROW_STYLE[k].color)).size).toBe(forces.length); // 各力顏色互異
  });
});
