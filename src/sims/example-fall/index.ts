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
  manifest, model, controls, defaults, scenarios, charts, layers, readouts, plan, Scene, guideZh, mode: "3d",
  camera: { position: [18, 14, 30], target: [0, 9, 0], fov: 40 },
};
export default sim;
