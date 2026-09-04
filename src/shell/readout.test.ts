import { describe, it, expect } from "vitest";
import { formatReadouts } from "./readouts";
import { deg } from "./format";
import { isUnit } from "./units";

describe("讀數面板", () => {
  const defs = [
    { key: "v", symbol: "v", label: { zh: "速度", en: "Velocity" }, unit: "m s⁻¹" },
    { key: "theta", symbol: "θ", label: { zh: "角度", en: "Angle" }, unit: "°", transform: deg },
    { key: "n", symbol: "n", label: { zh: "數目", en: "Count" }, unit: "" },
  ];
  it("三位有效數字、指數式單位、角度以度顯示", () => {
    const r = formatReadouts({ v: 12.3456, theta: Math.PI / 6, n: 7 }, defs);
    expect(r[0].text).toBe("12.3 m s⁻¹");
    expect(r[1].text).toBe("30.0 °");
    expect(r[2].text).toBe("7.00");
  });
  it("缺值顯示破折號", () => {
    expect(formatReadouts({}, defs)[0].text).toBe("— m s⁻¹");
  });
  it("單位都在允許清單內", () => {
    for (const d of defs) expect(isUnit(d.unit)).toBe(true);
  });
});
