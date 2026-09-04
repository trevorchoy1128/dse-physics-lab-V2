import type { ControlDef } from "@/shell/types";
import { gControl } from "@/shell/controls";
import type { P } from "./model";

// 規格「可調參數」表逐行照抄：符號、名稱、範圍、預設、單位。不得自行改動範圍與預設。
export const controls: ControlDef[] = [
  { key: "h", symbol: "h", label: { zh: "釋放高度", en: "Release height" }, unit: "m", min: 1, max: 50, step: 0.5, default: 20 },
  gControl,   // g：9.81 預設，可選 9.8 / 10
];

export const defaults: P = { h: 20, g: 9.81 };
