import type { ControlDef } from "@/shell/types";
import { gControl } from "@/shell/controls";
import type { P } from "./model";

export const controls: ControlDef[] = [
  { key: "h", symbol: "h", label: { zh: "釋放高度", en: "Release height" }, unit: "m", min: 1, max: 50, step: 0.5, default: 20 },
  { key: "m", symbol: "m", label: { zh: "質量", en: "Mass" }, unit: "kg", min: 0.1, max: 5, step: 0.1, default: 1 },
  gControl,
];
export const defaults: P = { h: 20, m: 1, g: 9.81 };
