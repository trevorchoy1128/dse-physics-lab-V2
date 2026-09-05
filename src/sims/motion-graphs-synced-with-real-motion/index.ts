import { manifest } from "./manifest";
import { model } from "./model";
import { controls, defaults } from "./controls";
import { scenarios } from "./scenarios";
import { charts, layers, readouts } from "./charts";
import { plan } from "./plan";
import Scene from "./Scene";
import guideZh from "./guide.zh.md?raw";
import type { SimModule } from "@/shell/types";
import type { ReadoutDef } from "@/shell/readouts";
import type { S, P } from "./model";

const sim: SimModule<S, P> & { readouts: ReadoutDef[] } = {
  manifest, model, controls, defaults, scenarios, charts, layers, readouts, plan, Scene, guideZh,
  mode: "2d",
  liveParams: ["a", "T"],        // 加速度滑桿即時生效（由運動生成圖的核心）；時間窗改變亦不重置（學生試用者）
  duration: p => p.T,            // 播放列顯示時間拉桿，可跳到指定時刻（學生試用者：找 t = 4 s 的速度）
  stepSize: 0.1,                 // 逐格 0.1 s（學生試用者：0.001 s 形同無用）
  hints: [
    { zh: "小車已經在動：拖右邊的「加速度」滑桿可以隨時改變它，三張圖即時跟着變", en: "The trolley is already moving: drag the acceleration slider any time and watch the three graphs follow" },
    { zh: "想看某一刻？在「跳到 t =」輸入秒數，讀數面板就是那一刻的數值", en: "Want a specific instant? Type it in “Jump to t =” and read the panel" },
    { zh: "想自己畫 v–t 圖？按「由圖生成運動」，在圖框內按住哪個圓點的時間位置就拖哪個圓點", en: "Want to draw your own v–t graph? Choose Graph → motion, then press near a dot's time and drag" },
  ],
};
export default sim;
