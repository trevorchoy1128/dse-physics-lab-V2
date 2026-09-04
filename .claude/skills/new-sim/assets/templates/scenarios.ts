import type { Scenario } from "@/shell/types";
import type { P } from "./model";

// 「試試看」：規格「常見迷思與反駁設計」表每一行一個。
// 先寫學生會怎樣想（misconception），再把參數設到能推翻它（params），再寫看甚麼（watch）和會見到甚麼（expect）。
export const scenarios: Scenario<P>[] = [
  {
    key: "a-at-top",
    misconception: { zh: "速度為零時加速度也為零", en: "When velocity is zero, acceleration is zero too" },
    params: { h: 20 },
    watch: { zh: "暫停在 t = 0，看加速度箭嘴與數值面板的 a", en: "Pause at t = 0 and watch the acceleration arrow and a in the panel" },
    expect: { zh: "v = 0 但 a = 9.81 m s⁻²，箭嘴仍然向下、長度不變", en: "v = 0 but a = 9.81 m s⁻²; the arrow still points down with the same length" },
    layers: ["velocity", "acceleration"],
  },
];
