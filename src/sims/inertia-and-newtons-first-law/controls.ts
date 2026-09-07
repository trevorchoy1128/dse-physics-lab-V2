import type { ControlDef } from "@/shell/types";
import { gControl } from "@/shell/controls";
import type { P } from "./model";

// 規格 13_024 §5「可調參數」逐行照抄：範圍與預設值不得偏離。
// 情景 1 預設 = 2024 卷一乙部 Q3（m 0.20 kg、F 0.30 N、前段光滑、後段粗糙）。
const table = (p: Record<string, unknown>) => p.scene === "table";
const cloth = (p: Record<string, unknown>) => p.scene === "cloth";
const bus = (p: Record<string, unknown>) => p.scene === "bus";
const space = (p: Record<string, unknown>) => p.scene === "space";

export const controls: ControlDef[] = [
  {
    key: "scene", label: { zh: "情景", en: "Scene" }, kind: "segment", default: "table",
    options: [
      { value: "table", label: { zh: "水平桌面上的方塊", en: "Block on a table" } },
      { value: "cloth", label: { zh: "桌布實驗", en: "Tablecloth pull" } },
      { value: "bus", label: { zh: "巴士上的乘客", en: "Passenger on a bus" } },
      { value: "space", label: { zh: "太空中的飛船", en: "Spacecraft" } },
    ],
  },
  // ---- 情景 1 ----
  {
    key: "push", label: { zh: "水平外力（可隨時放手）", en: "Horizontal force (release any time)" }, kind: "segment", default: "on", visible: table,
    options: [
      { value: "on", label: { zh: "施力中", en: "Pushing" } },
      { value: "off", label: { zh: "已放手", en: "Released" } },
    ],
  },
  { key: "F", symbol: "F", label: { zh: "外加水平力（可隨時改）", en: "Applied horizontal force (change any time)" }, unit: "N", min: 0, max: 10, step: 0.05, default: 0.3, visible: table },
  { key: "m", symbol: "m", label: { zh: "方塊質量", en: "Mass of block" }, unit: "kg", min: 0.1, max: 5, step: 0.1, default: 0.2, visible: table },
  { key: "mu1", symbol: "μ₁", label: { zh: "前段桌面（A 至 B）的摩擦係數", en: "Friction coefficient, section A to B" }, min: 0, max: 0.6, step: 0.01, default: 0, visible: table },
  { key: "mu2", symbol: "μ₂", label: { zh: "後段桌面（B 之後）的摩擦係數", en: "Friction coefficient beyond B" }, min: 0, max: 0.6, step: 0.01, default: 0.2, visible: table },
  { key: "second", label: { zh: "第二個方塊（同一推力）", en: "Second block (same force)" }, kind: "toggle", default: false, visible: table },
  { key: "mB", symbol: "m_B", label: { zh: "第二個方塊質量", en: "Mass of second block" }, unit: "kg", min: 0.1, max: 5, step: 0.1, default: 1, visible: p => table(p) && p.second === true },
  // ---- 情景 2 ----
  { key: "vCloth", symbol: "v布", label: { zh: "桌布抽出速率", en: "Cloth pulling speed" }, unit: "m s⁻¹", min: 0.1, max: 10, step: 0.1, default: 5, visible: cloth },
  { key: "muCloth", symbol: "μ布", label: { zh: "布與物件之間的摩擦係數", en: "Friction coefficient, cloth–object" }, min: 0, max: 0.6, step: 0.01, default: 0.15, visible: cloth },
  { key: "muTable", symbol: "μ桌", label: { zh: "物件與桌面之間的摩擦係數", en: "Friction coefficient, object–table" }, min: 0, max: 0.6, step: 0.01, default: 0.2, visible: cloth },
  { key: "L", symbol: "L", label: { zh: "物件下方的桌布長度（布邊到樽的距離）", en: "Cloth length under the object (edge to bottle)" }, unit: "m", min: 0.1, max: 1, step: 0.05, default: 0.4, visible: cloth },
  // ---- 情景 3 ----
  { key: "aBus", symbol: "a", label: { zh: "巴士起步／煞車的加速度大小", en: "Bus acceleration / deceleration" }, unit: "m s⁻²", min: 0, max: 5, step: 0.1, default: 3, visible: bus },
  { key: "vBus", symbol: "v", label: { zh: "巴士巡航速度", en: "Bus cruising speed" }, unit: "m s⁻¹", min: 2, max: 15, step: 0.5, default: 10, visible: bus },
  { key: "muBus", symbol: "μ", label: { zh: "乘客（鞋）與地板的摩擦係數", en: "Friction coefficient, shoes–floor" }, min: 0, max: 0.6, step: 0.01, default: 0.2, visible: bus },
  { key: "handrail", label: { zh: "握扶手", en: "Holding the handrail" }, kind: "toggle", default: false, visible: bus },
  // ---- 情景 4 ----
  {
    key: "engine", label: { zh: "引擎", en: "Engine" }, kind: "segment", default: "on", visible: space,
    options: [
      { value: "on", label: { zh: "開", en: "On" } },
      { value: "off", label: { zh: "關", en: "Off" } },
    ],
  },
  { key: "Fe", symbol: "F引擎", label: { zh: "引擎推力（可隨時改）", en: "Engine thrust (change any time)" }, unit: "N", min: 0, max: 5, step: 0.1, default: 0, visible: space },
  {
    key: "dir", label: { zh: "引擎方向", en: "Engine direction" }, kind: "segment", default: "forward", visible: space,
    options: [
      { value: "forward", label: { zh: "向前", en: "Forward" } },
      { value: "backward", label: { zh: "向後", en: "Backward" } },
    ],
  },
  { key: "mShip", symbol: "m", label: { zh: "飛船質量", en: "Mass of spacecraft" }, unit: "kg", min: 0.5, max: 5, step: 0.1, default: 1, visible: space },
  { key: "trio", label: { zh: "三艘飛船（靜止、向右、向左）", en: "Three craft (at rest, moving right, moving left)" }, kind: "toggle", default: false, visible: space },
  gControl,
];

export const defaults: P = {
  scene: "table", g: 9.81,
  m: 0.2, F: 0.3, push: "on", mu1: 0, mu2: 0.2, second: false, mB: 1,
  vCloth: 5, muCloth: 0.15, muTable: 0.2, L: 0.4, mObj: 1,
  aBus: 3, vBus: 10, muBus: 0.2, handrail: false,
  Fe: 0, engine: "on", dir: "forward", mShip: 1, trio: false,
};
