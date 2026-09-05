import type { Scenario } from "@/shell/types";
import type { P } from "./model";

// 規格「常見迷思與反駁設計」表逐行一個。
export const scenarios: Scenario<P>[] = [
  {
    key: "below-axis",
    misconception: { zh: "v–t 圖上的線在時間軸以下即是減速", en: "A v–t line below the time axis means slowing down" },
    params: { mode: "draw", T: 10, vt: [2, 1.6, 1.2, 0.8, 0.4, 0, -0.4, -0.8, -1.2, -1.6, -2] },
    watch: { zh: "看 t = 5 s 前後小車的方向，以及 a–t 圖", en: "Watch the trolley's direction before and after t = 5 s, and the a–t graph" },
    expect: { zh: "5 s 後小車向左走而且愈走愈快；a–t 圖全程都是 −0.4 m s⁻²，沒有變過。線在軸下 = 反方向，不是減速", en: "After 5 s the trolley moves left and speeds up; a stays −0.4 m s⁻² throughout. Below the axis means opposite direction, not slowing down" },
    layers: ["velocity", "acceleration"],
  },
  {
    key: "st-not-path",
    misconception: { zh: "s–t 圖是物體走過的路徑", en: "The s–t graph is the path the object travels" },
    params: { mode: "live", u: 0, a: 0, T: 10 },
    watch: { zh: "看小車和 s–t 圖", en: "Watch the trolley and the s–t graph" },
    expect: { zh: "小車完全不動，s–t 圖卻是一條向右延伸的水平線。圖形的形狀與路徑無關", en: "The trolley does not move, yet the s–t graph is a horizontal line extending to the right. The graph's shape is not the path" },
    layers: ["velocity"],
  },
  {
    key: "v-zero-a-not",
    misconception: { zh: "速度為零則加速度為零", en: "Zero velocity means zero acceleration" },
    params: { mode: "live", u: 3, a: -9.81, T: 5 },
    watch: { zh: "加速度設為 −9.81（等同豎直上拋）。看 v 讀數過零那一刻的 a 讀數", en: "With a = −9.81 (as in a vertical throw), watch the a readout at the instant v passes through zero" },
    expect: { zh: "t ≈ 0.31 s 時 v = 0，但 a 仍是 −9.81 m s⁻²，加速度箭嘴長度不變", en: "At t ≈ 0.31 s, v = 0 but a is still −9.81 m s⁻²; the acceleration arrow keeps its length" },
    layers: ["velocity", "acceleration"],
  },
  {
    key: "area-not-distance",
    misconception: { zh: "線下面積永遠是走過的路程", en: "The area under the graph is always the distance travelled" },
    params: { mode: "draw", T: 10, vt: [2, 2, 2, 2, 2, -2, -2, -2, -2, -2, -2] },
    watch: { zh: "開啟「線下面積」，比較「位移」和「路程」兩個讀數", en: "Turn on the area layer and compare the displacement and distance readouts" },
    expect: { zh: "軸下的面積是負的：10 s 後位移 = −2 m，路程 = 19 m。面積的總和是位移，不是路程", en: "Area below the axis is negative: after 10 s displacement = −2 m but distance = 19 m. The total area is displacement, not distance" },
    layers: ["area"],
  },
];
