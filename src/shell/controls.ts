import type { ControlDef } from "./types";

// 共用：重力加速度 g。預設 9.81（考評局數據表），可切 9.8 / 10 配合課本題目。
export const gControl: ControlDef = {
  key: "g",
  symbol: "g",
  label: { zh: "重力加速度", en: "Acceleration due to gravity" },
  unit: "m s⁻²",
  kind: "select",
  default: 9.81,
  options: [
    { value: 9.81, label: { zh: "9.81（考評局）", en: "9.81 (HKEAA)" } },
    { value: 9.8, label: { zh: "9.8", en: "9.8" } },
    { value: 10, label: { zh: "10", en: "10" } },
  ],
};

/** 由 controls 生成預設參數 */
export const defaultsOf = <P extends Record<string, unknown>>(controls: ControlDef[]): P =>
  Object.fromEntries(controls.map(c => [c.key, c.default])) as P;
