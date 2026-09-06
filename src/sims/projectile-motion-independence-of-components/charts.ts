import type { ChartDef, LayerDef } from "@/shell/types";
import type { ReadoutDef } from "@/shell/readouts";

// 規格「即時顯示」隨時間變化的量：動能—時間圖（現象 3：動能不會歸零，最低點 = ½ m v_x²）。由 Views.tsx 畫出。
export const charts: ChartDef[] = [
  { key: "Ek-t", label: { zh: "動能—時間圖", en: "Kinetic energy–time graph" }, x: "t", y: ["Ek"], unitX: "s", unitY: "J" },
];

// 圖層：每支向量一個開關；頻閃、路徑、各角度射程比較另加
export const layers: LayerDef[] = [
  { key: "velocity", label: { zh: "速度 v", en: "Velocity v" }, default: true },
  { key: "vx", label: { zh: "速度水平分量 vₓ", en: "Horizontal component vₓ" }, default: true },
  { key: "vy", label: { zh: "速度垂直分量 vᵧ", en: "Vertical component vᵧ" }, default: true },
  { key: "acceleration", label: { zh: "加速度 a", en: "Acceleration a" }, default: true },
  { key: "weight", label: { zh: "重量 W", en: "Weight W" }, default: true },
  { key: "air", label: { zh: "空氣阻力箭嘴（開啟空氣阻力時）", en: "Air resistance arrow (when enabled)" }, default: true },
  { key: "strobe", label: { zh: "頻閃影像（每 0.1 s）", en: "Strobe images (every 0.1 s)" }, default: true },
  { key: "path", label: { zh: "路徑", en: "Path" }, default: true },
  { key: "ghosts", label: { zh: "各角度射程比較", en: "Range at different angles" }, default: false },
  { key: "photo", label: { zh: "頻閃照片模式（側視變黑底）", en: "Strobe photo mode (side view on black)" }, default: false },   // 老師 2026-09-06 定加入
];

export const readouts: ReadoutDef[] = [
  { key: "tf", symbol: "t", label: { zh: "飛行時間", en: "Time of flight" }, unit: "s", hint: { zh: "離開發射器起計，落地後停住", en: "Since launch; stops on landing" } },
  { key: "x", symbol: "x", label: { zh: "水平距離", en: "Horizontal distance" }, unit: "m" },
  { key: "y", symbol: "y", label: { zh: "當前高度", en: "Current height" }, unit: "m" },
  { key: "vx", symbol: "vₓ", label: { zh: "速度水平分量", en: "Horizontal component of velocity" }, unit: "m s⁻¹" },
  { key: "vy", symbol: "vᵧ", label: { zh: "速度垂直分量", en: "Vertical component of velocity" }, unit: "m s⁻¹", hint: { zh: "向上為正", en: "Upward positive" } },
  { key: "v", symbol: "v", label: { zh: "合速率", en: "Speed" }, unit: "m s⁻¹" },
  { key: "ay", symbol: "a", label: { zh: "加速度（垂直）", en: "Acceleration (vertical)" }, unit: "m s⁻²" },
  { key: "Ek", symbol: "Eₖ", label: { zh: "動能", en: "Kinetic energy" }, unit: "J" },
  { key: "xB", symbol: "x₂", label: { zh: "第二顆球水平距離", en: "Horizontal distance of second ball" }, unit: "m", visible: obs => Number.isFinite(obs.xB) },
  { key: "yB", symbol: "y₂", label: { zh: "第二顆球高度", en: "Height of second ball" }, unit: "m", visible: obs => Number.isFinite(obs.yB) },
];
