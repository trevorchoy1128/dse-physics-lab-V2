import type { ControlDef } from "@/shell/types";
import { gControl } from "@/shell/controls";
import type { P } from "./model";

// 規格「可調參數」表逐行照抄：u 1–50（預設 15）、θ −30°–90°（預設 40°）、h 0–50（預設 0）、g 1.6 / 3.7 / 9.81、空氣阻力預設關閉。
export const controls: ControlDef[] = [
  { key: "u", symbol: "u", label: { zh: "初速", en: "Initial speed" }, unit: "m s⁻¹", min: 1, max: 50, step: 0.5, default: 15 },
  { key: "theta", symbol: "θ", label: { zh: "投射角", en: "Angle of projection" }, unit: "°", min: -30, max: 90, step: 1, default: 40 },
  { key: "h", symbol: "h", label: { zh: "發射高度", en: "Launch height" }, unit: "m", min: 0, max: 50, step: 0.5, default: 0 },
  {
    ...gControl,   // 共用 g（9.81 預設、9.8、10）；本節規格另加月球 1.6 與火星 3.7
    options: [
      ...gControl.options!,
      { value: 3.7, label: { zh: "3.7（火星）", en: "3.7 (Mars)" } },
      { value: 1.6, label: { zh: "1.6（月球）", en: "1.6 (Moon)" } },
    ],
  },
  { key: "m", symbol: "m", label: { zh: "質量", en: "Mass" }, unit: "kg", min: 0.1, max: 5, step: 0.1, default: 1 },   // 老師 2026-09-06 定加入（規格參數表沒有）
  { key: "air", label: { zh: "空氣阻力", en: "Air resistance" }, kind: "toggle", default: false },
  {
    key: "companion", label: { zh: "第二顆球（同時發射）", en: "Second ball (launched together)" }, kind: "segment", default: "none",   // 老師 2026-09-06 定預設「無」
    options: [
      { value: "none", label: { zh: "無", en: "None" } },
      { value: "drop", label: { zh: "同時自由下落", en: "Dropped at the same time" } },
      { value: "fast", label: { zh: "水平初速加倍", en: "Double horizontal speed" } },
    ],
  },
];

export const defaults: P = { u: 15, theta: 40, h: 0, g: 9.81, m: 1, air: false, companion: "none" };
