import type { ControlDef } from "@/shell/types";
import type { P } from "./model";

// 規格無參數表；範圍由開發端定（見 manifest.beyondSpec），待老師定奪。
export const controls: ControlDef[] = [
  {
    key: "mode", label: { zh: "模式", en: "Mode" }, kind: "select", default: "live",
    options: [
      { value: "live", label: { zh: "由運動生成圖：我控制小車", en: "Motion → graphs: I drive the trolley" } },
      { value: "draw", label: { zh: "由圖生成運動：我畫 v–t 圖", en: "Graph → motion: I draw the v–t graph" } },
    ],
  },
  { key: "u", symbol: "u", label: { zh: "初速", en: "Initial velocity" }, unit: "m s⁻¹", min: -5, max: 5, step: 0.5, default: 0, visible: p => p.mode === "live" },
  { key: "a", symbol: "a", label: { zh: "加速度（可隨時改）", en: "Acceleration (change any time)" }, unit: "m s⁻²", min: -10, max: 10, step: 0.5, default: 1, visible: p => p.mode === "live" },
  {
    key: "T", symbol: "T", label: { zh: "時間窗", en: "Time window" }, unit: "s", kind: "select", default: 10,
    options: [{ value: 5, label: { zh: "5 s", en: "5 s" } }, { value: 10, label: { zh: "10 s", en: "10 s" } }, { value: 20, label: { zh: "20 s", en: "20 s" } }],
  },
];

export const defaults: P = { mode: "live", u: 0, a: 1, T: 10, vt: [0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0] };
