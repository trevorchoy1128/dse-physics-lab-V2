import type { Scenario } from "@/shell/types";
import type { P } from "./model";

export const scenarios: Scenario<P>[] = [
  {
    key: "a-at-top",
    misconception: { zh: "速度為零時加速度也為零", en: "When velocity is zero, acceleration is zero too" },
    params: { h: 20 },
    watch: { zh: "按「重置」後暫停在 t = 0，看加速度箭嘴與讀數 a", en: "Reset, pause at t = 0, watch the acceleration arrow and readout a" },
    expect: { zh: "v = 0 但 a = 9.81 m s⁻²，箭嘴仍然向下、長度不變", en: "v = 0 but a = 9.81 m s⁻²; the arrow still points down with the same length" },
    layers: ["velocity", "acceleration"],
  },
  {
    key: "mass",
    misconception: { zh: "較重的物體下落較快", en: "Heavier objects fall faster" },
    params: { m: 5 },
    watch: { zh: "把質量由 1 kg 改為 5 kg，看落地時間", en: "Change mass from 1 kg to 5 kg and watch the landing time" },
    expect: { zh: "落地時間完全相同；重量箭嘴變長，但加速度箭嘴不變", en: "Same landing time; the weight arrow grows but the acceleration arrow is unchanged" },
    layers: ["weight", "acceleration"],
  },
];
