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
};
export default sim;
