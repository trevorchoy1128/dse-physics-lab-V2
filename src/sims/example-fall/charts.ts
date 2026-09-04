import type { ChartDef, LayerDef } from "@/shell/types";
import type { ReadoutDef } from "@/shell/readouts";

export const charts: ChartDef[] = [
  { key: "v-t", label: { zh: "速度—時間圖", en: "v-t graph" }, x: "t", y: ["v"], unitX: "s", unitY: "m s⁻¹", fit: "linear" },
  { key: "y-t", label: { zh: "高度—時間圖", en: "y-t graph" }, x: "t", y: ["y"], unitX: "s", unitY: "m" },
];

export const layers: LayerDef[] = [
  { key: "velocity", label: { zh: "速度", en: "Velocity" }, default: true },
  { key: "acceleration", label: { zh: "加速度", en: "Acceleration" }, default: true },
  { key: "weight", label: { zh: "重量", en: "Weight" }, default: false },
];

export const readouts: ReadoutDef[] = [
  { key: "t", symbol: "t", label: { zh: "時間", en: "Time" }, unit: "s" },
  { key: "y", symbol: "y", label: { zh: "高度", en: "Height" }, unit: "m" },
  { key: "v", symbol: "v", label: { zh: "速度", en: "Velocity" }, unit: "m s⁻¹" },
  { key: "a", symbol: "a", label: { zh: "加速度", en: "Acceleration" }, unit: "m s⁻²" },
  { key: "Ek", symbol: "Eₖ", label: { zh: "動能", en: "Kinetic energy" }, unit: "J" },
  { key: "Ep", symbol: "Eₚ", label: { zh: "重力勢能", en: "Gravitational potential energy" }, unit: "J" },
];
