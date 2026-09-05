import type { ChartDef, LayerDef } from "@/shell/types";
import type { ReadoutDef } from "@/shell/readouts";

export const charts: ChartDef[] = [
  { key: "s-t", label: { zh: "s–t 圖", en: "s–t graph" }, x: "t", y: ["s"], unitX: "s", unitY: "m" },
  { key: "v-t", label: { zh: "v–t 圖", en: "v–t graph" }, x: "t", y: ["v"], unitX: "s", unitY: "m s⁻¹" },
  { key: "a-t", label: { zh: "a–t 圖", en: "a–t graph" }, x: "t", y: ["a"], unitX: "s", unitY: "m s⁻²" },
];

export const layers: LayerDef[] = [
  { key: "velocity", label: { zh: "速度箭嘴", en: "Velocity arrow" }, default: true },
  { key: "acceleration", label: { zh: "加速度箭嘴", en: "Acceleration arrow" }, default: true },
  { key: "tangent", label: { zh: "切線（斜率）", en: "Tangent (slope)" }, default: true },
  { key: "area", label: { zh: "線下面積", en: "Area under graph" }, default: false },
];

export const readouts: ReadoutDef[] = [
  { key: "t", symbol: "t", label: { zh: "時間", en: "Time" }, unit: "s" },
  { key: "s", symbol: "s", label: { zh: "位移", en: "Displacement" }, unit: "m" },
  { key: "dist", symbol: "d", label: { zh: "路程", en: "Distance" }, unit: "m" },
  { key: "v", symbol: "v", label: { zh: "速度", en: "Velocity" }, unit: "m s⁻¹" },
  { key: "a", symbol: "a", label: { zh: "加速度", en: "Acceleration" }, unit: "m s⁻²" },
  { key: "area", symbol: "A", label: { zh: "v–t 線下面積", en: "Area under v–t" }, unit: "m" },
  { key: "avgSpeed", symbol: "", label: { zh: "平均速率（路程 ÷ 時間）", en: "Average speed (distance ÷ time)" }, unit: "m s⁻¹" },
  { key: "avgVel", symbol: "", label: { zh: "平均速度（位移 ÷ 時間）", en: "Average velocity (displacement ÷ time)" }, unit: "m s⁻¹" },
];
