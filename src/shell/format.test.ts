import { describe, it, expect } from "vitest";
import { sig, withUnit, sup } from "./format";

describe("三位有效數字", () => {
  it("定點範圍保留尾隨零", () => {
    expect(sig(9.81)).toBe("9.81");
    expect(sig(9.8)).toBe("9.80");
    expect(sig(1)).toBe("1.00");
    expect(sig(12.345)).toBe("12.3");
    expect(sig(1234)).toBe("1230");
    expect(sig(0.0123456)).toBe("0.0123");
    expect(sig(-3.14159)).toBe("-3.14");
  });
  it("零與非數", () => {
    expect(sig(0)).toBe("0.00");
    expect(sig(NaN)).toBe("—");
    expect(sig(Infinity)).toBe("—");
  });
  it("大數小數用指數式", () => {
    expect(sig(42000)).toBe("4.20 × 10⁴");
    expect(sig(6.674e-11)).toBe("6.67 × 10⁻¹¹");
    expect(sig(4.2e7)).toBe("4.20 × 10⁷");
  });
  it("單位附在數值後", () => {
    expect(withUnit(9.81, "m s⁻²")).toBe("9.81 m s⁻²");
    expect(withUnit(3, undefined)).toBe("3.00");
    expect(sup(-11)).toBe("⁻¹¹");
  });
  it("尾數進位到 10 時指數加一，不遞歸（99960 → 1.00 × 10⁵；9.9995 × 10⁻¹⁴ → 1.00 × 10⁻¹³）", () => {
    expect(sig(99960)).toBe("1.00 × 10⁵");
    expect(sig(9.9995e-14)).toBe("1.00 × 10⁻¹³");
    expect(sig(-99960)).toBe("-1.00 × 10⁵");
  });
});
