import { manifest } from "./manifest";
import { model } from "./model";
import { controls, defaults } from "./controls";
import { scenarios } from "./scenarios";
import { charts, layers, readouts } from "./charts";
import { plan, duration } from "./plan";
import Scene from "./Scene";
import Views from "./Views";
import guideZh from "./guide.zh.md?raw";
import type { SimModule } from "@/shell/types";
import type { ReadoutDef } from "@/shell/readouts";
import type { S, P } from "./model";

const sim: SimModule<S, P> & { readouts: ReadoutDef[] } = {
  manifest, model, controls, defaults, scenarios, charts, layers, readouts, plan, Scene, Views, guideZh,
  mode: "3d",
  // 世界寬 20 單位（x 0–20），相機由右前上方看向場景中央，一眼見到兩球並排飛出、側視牆與地面影子
  camera: { position: [8, 6, 22], target: [9, 2.5, -2], fov: 40 },
  duration,                 // 時間拉桿：可跳到最高點或落地瞬間
  stepSize: 0.05,
  hints: [
    { zh: "球已經射出：留意地面影子等距（水平勻速）、牆上高度影子愈落愈疏（垂直加速）", en: "The ball is already in flight: ground shadows are equally spaced (uniform horizontal motion); the height shadows on the wall spread out (vertical acceleration)" },
    { zh: "下面三個視窗與 3D 同步：側視看垂直運動、俯視看水平勻速、右邊是動能—時間圖；右欄「第二顆球」可加一顆同時發射的球比較", en: "The three panels below run in sync: side = vertical, top = uniform horizontal, right = kinetic energy–time; add a second ball from the panel to compare" },
    { zh: "拖「跳到 t =」可以停在最高點；按「試試看」測試你的想法", en: "Drag “Jump to t =” to stop at the highest point; press a Try-it card to test your own prediction" },
  ],
};
export default sim;
