import type { ChartDef, LayerDef } from "@/shell/types";

// 規格「即時顯示」中隨時間變化的量做圖；要學生讀斜率的圖設 fit: "linear"
export const charts: ChartDef[] = [
  { key: "v-t", label: { zh: "速度—時間圖", en: "v-t graph" }, x: "t", y: ["v"], unitX: "s", unitY: "m s⁻¹", fit: "linear" },
  { key: "y-t", label: { zh: "高度—時間圖", en: "y-t graph" }, x: "t", y: ["y"], unitX: "s", unitY: "m" },
];

// 圖層：每支向量一個開關；shell 自動生成按鈕
export const layers: LayerDef[] = [
  { key: "velocity", label: { zh: "速度", en: "Velocity" }, default: true },
  { key: "acceleration", label: { zh: "加速度", en: "Acceleration" }, default: true },
  { key: "weight", label: { zh: "重量", en: "Weight" }, default: false },
];
