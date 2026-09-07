import type { ChartDef, LayerDef } from "@/shell/types";
import type { ReadoutDef } from "@/shell/readouts";

// 規格 13_024 §6「即時顯示」。線圖由 Scene 用 drawPane 畫（s–t、v–t）；此處登記鍵與單位。
export const charts: ChartDef[] = [
  { key: "s-t", label: { zh: "s–t 圖", en: "s–t graph" }, x: "t", y: ["s"], unitX: "s", unitY: "m" },
  { key: "v-t", label: { zh: "v–t 圖", en: "v–t graph" }, x: "t", y: ["v"], unitX: "s", unitY: "m s⁻¹" },
];

// 每支力可獨立開關（規格 §6、Book 2 規格 §4.3）；「只看淨力」= 隱藏個別力（迷思 M4）
export const layers: LayerDef[] = [
  { key: "weight", label: { zh: "重量", en: "Weight" }, default: true },
  { key: "normal", label: { zh: "法向反作用力", en: "Normal reaction" }, default: true },
  { key: "friction", label: { zh: "摩擦", en: "Friction" }, default: true },
  { key: "applied", label: { zh: "施力（手 / 扶手 / 引擎）", en: "Applied force (hand / handrail / engine)" }, default: true },
  { key: "net", label: { zh: "淨力", en: "Net force" }, default: true },
  { key: "velocity", label: { zh: "速度箭嘴", en: "Velocity arrow" }, default: true },
  { key: "acceleration", label: { zh: "加速度箭嘴", en: "Acceleration arrow" }, default: false },
  { key: "netOnly", label: { zh: "只看淨力（隱藏個別力）", en: "Net force only (hide individual forces)" }, default: false },
];

const t = (n: number) => (o: Record<string, number>) => o.scene === n;
export const readouts: ReadoutDef[] = [
  { key: "t", symbol: "t", label: { zh: "時間", en: "Time" }, unit: "s" },
  { key: "Fnet", symbol: "F", label: { zh: "淨力（向右為正）", en: "Net force (right = +)" }, unit: "N", hint: { zh: "所有力的總和；為零時速度不變", en: "Sum of all forces; zero means velocity does not change" } },
  // 「作用於物體的力：n 支（水平 n 支）」由畫布左上角以整數顯示（讀數面板固定三位有效數字，會把 3 顯示成 3.00）
  { key: "v", symbol: "v", label: { zh: "速度", en: "Velocity" }, unit: "m s⁻¹" },
  { key: "a", symbol: "a", label: { zh: "加速度", en: "Acceleration" }, unit: "m s⁻²" },
  { key: "s", symbol: "s", label: { zh: "位移", en: "Displacement" }, unit: "m" },
  { key: "f", symbol: "f", label: { zh: "摩擦（向右為正）", en: "Friction (right = +)" }, unit: "N", visible: o => o.scene !== 4 },
  { key: "Fapp", symbol: "F", label: { zh: "外加水平力", en: "Applied horizontal force" }, unit: "N", visible: t(1) },
  { key: "vB", symbol: "v_B", label: { zh: "第二個方塊速度", en: "Velocity of second block" }, unit: "m s⁻¹", visible: o => o.scene === 1 && o.vB !== undefined },
  { key: "vCloth", symbol: "v布", label: { zh: "桌布速度", en: "Cloth speed" }, unit: "m s⁻¹", visible: t(2) },
  { key: "dtPull", symbol: "Δt", label: { zh: "摩擦作用時間", en: "Time friction acts" }, unit: "s", visible: t(2), hint: { zh: "布仍在物件下方的時間；抽出後凍結", en: "Time the cloth is still under the object; frozen once out" } },
  { key: "J", symbol: "J", label: { zh: "衝量 J = fΔt", en: "Impulse J = fΔt" }, unit: "N s", visible: t(2) },
  { key: "dv", symbol: "Δv", label: { zh: "物件獲得的速度", en: "Velocity gained by the object" }, unit: "m s⁻¹", visible: t(2) },
  { key: "slide", symbol: "d", label: { zh: "抽出後的滑行距離", en: "Sliding distance after the pull" }, unit: "m", visible: t(2) },
  { key: "vBus", symbol: "v車", label: { zh: "巴士速度", en: "Bus velocity" }, unit: "m s⁻¹", visible: t(3) },
  { key: "aBusNow", symbol: "a車", label: { zh: "巴士加速度", en: "Bus acceleration" }, unit: "m s⁻²", visible: t(3) },
  { key: "sRel", symbol: "s_rel", label: { zh: "乘客相對巴士的位移", en: "Passenger displacement relative to the bus" }, unit: "m", visible: t(3), hint: { zh: "正 = 相對巴士向前滑", en: "Positive = slid forwards relative to the bus" } },
  { key: "Fhand", symbol: "F", label: { zh: "扶手施於乘客的力", en: "Force from the handrail on the passenger" }, unit: "N", visible: t(3) },
  { key: "Fe", symbol: "F引擎", label: { zh: "引擎推力（向右為正）", en: "Engine thrust (right = +)" }, unit: "N", visible: t(4) },
  { key: "fuel", symbol: "", label: { zh: "燃料消耗率（示意）", en: "Fuel consumption (indicative)" }, unit: "", visible: t(4), hint: { zh: "關引擎時為零", en: "Zero with the engine off" } },
  { key: "vB", symbol: "v₂", label: { zh: "向右那艘的速度", en: "Velocity of the right-moving craft" }, unit: "m s⁻¹", visible: o => o.scene === 4 && o.vB !== undefined },
  { key: "vC", symbol: "v₃", label: { zh: "向左那艘的速度", en: "Velocity of the left-moving craft" }, unit: "m s⁻¹", visible: o => o.scene === 4 && o.vC !== undefined },
];
