import { manifest } from "./manifest";
import { model, duration } from "./model";
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
  liveParams: ["push", "engine", "dir"],   // 「放手」與引擎開關是本模擬的核心操作：即時生效，不重置運行
  duration,                                // 時間拉桿：可跳到放手後、煞車後、抽布後的任何一刻
  stepSize: 0.05,
  hints: [
    { zh: "方塊已經被一支 0.30 N 的力推着（2024 年 DSE 那條題）：想看放手後會怎樣，按右邊的「已放手」", en: "The block is being pushed by 0.30 N (the 2024 DSE question): press “Released” on the right to see what happens when the push stops" },
    { zh: "看讀數「作用於物體的力」和「淨力」：放手一刻由 3 支變 2 支，淨力 0 N，速度卻不變", en: "Watch the “forces acting” and “net force” readouts: on release the count drops from 3 to 2, net force 0 N, yet the velocity stays" },
    { zh: "上面「情景」可以換成桌布實驗、巴士上的乘客、太空中的飛船；按「試試看」測試你的想法", en: "Switch scene at the top to the tablecloth, the bus passenger or the spacecraft; press a Try-it card to test your own prediction" },
  ],
};
export default sim;
