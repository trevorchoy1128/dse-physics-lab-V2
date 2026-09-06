import type { Scenario } from "@/shell/types";
import type { P } from "./model";

// 「試試看」：規格「常見迷思與模擬器如何直接反駁」表每一行一個。
// 先寫學生會怎樣想，再把參數設到能推翻它，再寫看甚麼、會見到甚麼。
export const scenarios: Scenario<P>[] = [
  {
    key: "same-landing",
    misconception: { zh: "速度較大的拋體，飛行時間較長", en: "The faster projectile stays in the air longer" },
    params: { u: 10, theta: 0, h: 20, companion: "drop" },
    watch: { zh: "一顆球以 10 m s⁻¹ 水平射出，另一顆同一刻由靜止釋放（水平初速 0）。看側視投影的高度連線，和讀數「當前高度」「第二顆球高度」「飛行時間」", en: "One ball is launched horizontally at 10 m s⁻¹, the other is released from rest at the same instant (zero horizontal speed). Watch the height link in the side view and the height and time readouts" },
    expect: { zh: "兩球全程同一高度，同一刻落地（2.02 s）；射出的一顆只是飛得遠。飛行時間只由垂直運動決定。再把第二顆球改為「水平初速加倍」，結果一樣", en: "Both balls stay level and land at the same instant (2.02 s); the launched one only travels further. Time of flight is set by the vertical motion alone. Switch the second ball to double horizontal speed and it is the same" },
    layers: ["strobe", "path", "vx", "vy"],
  },
  {
    key: "top-not-zero",
    misconception: { zh: "最高點速度為零", en: "Velocity is zero at the highest point" },
    params: { u: 15, theta: 40, h: 0, companion: "none" },
    watch: { zh: "拖時間拉桿到最高點（約 0.98 s），看讀數 v_y、v_x 和動能—時間圖", en: "Drag the time slider to the highest point (about 0.98 s); read v_y, v_x and the kinetic energy graph" },
    expect: { zh: "v_y = 0，但 v_x = 11.5 m s⁻¹ 不變；速度箭嘴變成水平但不消失；動能最低而不是零，等於 ½ m v_x²", en: "v_y = 0 but v_x = 11.5 m s⁻¹ is unchanged; the velocity arrow turns horizontal but does not vanish; kinetic energy is at its minimum, ½ m v_x², not zero" },
    layers: ["velocity", "vx", "vy"],
  },
  {
    key: "no-forward-force",
    misconception: { zh: "拋體在空中受到一個向前的力", en: "A projectile is pushed forward by a force while in the air" },
    params: { u: 20, theta: 50, h: 0, companion: "none" },
    watch: { zh: "只看紅色的力箭嘴（重量），全程留意它的方向和長度", en: "Watch only the red force arrow (weight) throughout the flight" },
    expect: { zh: "受力圖全程只有一支重量箭嘴，向下、等長；球向前只是因為水平方向沒有力改變它的 v_x", en: "The only force is weight, downward and constant; the ball keeps moving forward because no horizontal force changes v_x" },
    layers: ["weight", "velocity"],
  },
  {
    key: "a-at-top",
    misconception: { zh: "加速度在最高點為零", en: "Acceleration is zero at the highest point" },
    params: { u: 15, theta: 60, h: 0, companion: "none" },
    watch: { zh: "拖時間拉桿到最高點（約 1.32 s），看綠色虛線的加速度箭嘴和讀數", en: "Drag the time slider to the highest point (about 1.32 s); watch the dashed green acceleration arrow" },
    expect: { zh: "加速度箭嘴全程等長、向下，最高點也一樣：a = 9.81 m s⁻² 向下，與速度無關", en: "The acceleration arrow is the same length and points down throughout, including at the top: a = 9.81 m s⁻² downward, regardless of velocity" },
    layers: ["acceleration", "velocity"],
  },
  {
    key: "range-45",
    misconception: { zh: "射程角度愈大愈遠", en: "The larger the angle, the longer the range" },
    params: { u: 15, theta: 70, h: 0, companion: "none" },
    watch: { zh: "開啟「各角度射程比較」：15°、30°、45°、60°、75° 的路徑一起畫出，比較落點", en: "Turn on “Range at different angles”: the paths for 15°, 30°, 45°, 60° and 75° are drawn together; compare where they land" },
    expect: { zh: "45° 最遠；15° 與 75°、30° 與 60° 落點相同；70° 比 45° 近。角度愈大只是飛得愈高、愈久", en: "45° goes furthest; 15° and 75°, 30° and 60° land at the same spot; 70° is shorter than 45°. A larger angle only means higher and longer in the air" },
    layers: ["ghosts", "path"],
  },
];
