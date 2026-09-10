import type { Level } from "./game";

// 關卡：每關一個物理要點。數值經 game.test.ts 以滑桿格點窮舉，保證每關有解（twin 兩側有解、economy 有滿星解）。
const G = 9.81;
const wall = (x: number, height: number, thick = 2) => ({ x0: x, x1: x + thick, y0: 0, y1: height });
const ceiling = (x0: number, x1: number, y: number, thick = 2) => ({ x0, x1, y0: y, y1: y + thick });
const cliff = (h: number) => ({ x0: -8, x1: 0, y0: 0, y1: h });   // 炮台所在的懸崖（x₁ = 0：球心在邊緣不算撞牆）

export const LEVELS: Level[] = [
  {
    id: "warmup", name: { zh: "熱身：平地靶", en: "Warm-up: flat target" },
    brief: { zh: "調校初速 u 與投射角 θ，把炮彈射中 30 m 外的靶。", en: "Set the initial speed u and angle θ to hit the target 30 m away." },
    hint: { zh: "同一水平面的射程 R = u² sin 2θ / g。先揀一個角，再倒算 u。", en: "Range on level ground: R = u² sin 2θ / g. Pick an angle, then solve for u." },
    g: G, h: 0, target: { x: 30, y: 0, r: 1.5 }, blocks: [], uMax: 40, world: { xMax: 50, yMax: 25 }, start: { u: 12, theta: 45 },
  },
  {
    id: "hill", name: { zh: "山上的城", en: "Castle on the hill" },
    brief: { zh: "靶在 12 m 高的山上。射程公式只適用於同一水平面，這次要用 x 和 y 兩條方程。", en: "The target sits on a 12 m hill. The range formula only works on level ground; use both the x and y equations." },
    hint: { zh: "x = u cosθ · t，y = u sinθ · t − ½gt²。要同時滿足 x = 54 與 y = 13.5。", en: "x = u cosθ · t and y = u sinθ · t − ½gt². Both x = 54 and y = 13.5 must hold at the same t." },
    g: G, h: 0, target: { x: 54, y: 13.5, r: 1.5 }, blocks: [{ x0: 46, x1: 62, y0: 0, y1: 12 }], uMax: 40, world: { xMax: 70, yMax: 35 }, start: { u: 20, theta: 30 },
  },
  {
    id: "wall", name: { zh: "高牆", en: "The high wall" },
    brief: { zh: "中間有一幅 18 m 高的牆。要越過牆頂，再落在 45 m 的靶上。", en: "An 18 m wall stands in the way. Clear it and land on the target at 45 m." },
    hint: { zh: "最高點 H = u² sin²θ / 2g，但最高點未必在牆的位置。用 x = 25 時的 t 代入 y 檢查。", en: "Max height H = u² sin²θ / 2g, but the peak may not be above the wall. Find t when x = 25 and check y there." },
    g: G, h: 0, target: { x: 45, y: 0, r: 1.5 }, blocks: [wall(24, 18)], uMax: 40, world: { xMax: 60, yMax: 40 }, start: { u: 21, theta: 30 },
  },
  {
    id: "bridge", name: { zh: "低橋", en: "Under the bridge" },
    brief: { zh: "頭頂有一座橋，離地只有 10 m。炮彈要從橋底穿過，再射中 50 m 的靶。", en: "A bridge hangs 10 m above the ground. Pass underneath it and hit the target at 50 m." },
    hint: { zh: "橋在 x = 15 m 至 35 m。全程最高點不可超過 10 m，所以要用低角度、高初速。", en: "The bridge spans x = 15 m to 35 m. The whole flight must stay below 10 m: low angle, high speed." },
    g: G, h: 0, target: { x: 50, y: 0, r: 1.5 }, blocks: [ceiling(15, 35, 10)], uMax: 40, world: { xMax: 60, yMax: 25 }, start: { u: 22, theta: 45 },
  },
  {
    id: "fixed-angle", name: { zh: "固定 45°", en: "Locked at 45°" },
    brief: { zh: "炮管卡住了，只能 45° 發射。靶在 60 m。只可以調初速。", en: "The barrel is stuck at 45°. The target is at 60 m. You can only change the speed." },
    hint: { zh: "45° 時 sin 2θ = 1，所以 R = u² / g，u = √(gR)。", en: "At 45°, sin 2θ = 1, so R = u² / g and u = √(gR)." },
    g: G, h: 0, target: { x: 60, y: 0, r: 1.5 }, blocks: [], lock: { theta: 45 }, uMax: 40, world: { xMax: 75, yMax: 30 }, start: { u: 30, theta: 45 },
  },
  {
    id: "twin", name: { zh: "一速兩角", en: "One speed, two angles" },
    brief: { zh: "初速固定 25 m s⁻¹，靶在 55 m。有兩個投射角都可以命中：兩個都找到才有三星。", en: "Speed is locked at 25 m s⁻¹, target at 55 m. Two angles both work: find both for three stars." },
    hint: { zh: "sin 2θ = Rg / u²。2θ 有兩個解：2θ 和 180° − 2θ，即 θ 和 90° − θ。", en: "sin 2θ = Rg / u² has two solutions: 2θ and 180° − 2θ, so θ and 90° − θ." },
    g: G, h: 0, target: { x: 55, y: 0, r: 1.5 }, blocks: [], lock: { u: 25 }, uMax: 40, world: { xMax: 70, yMax: 35 }, goal: "twin", start: { u: 25, theta: 45 },
  },
  {
    id: "cliff", name: { zh: "懸崖平射", en: "Horizontal from a cliff" },
    brief: { zh: "炮台在 20 m 高的懸崖上，炮管水平。靶在崖下 40 m 遠。", en: "Your cannon is on a 20 m cliff, firing horizontally. The target is 40 m out on the ground below." },
    hint: { zh: "垂直方向由 h = ½gt² 求 t（與 u 無關）；再用 x = u t 求 u。", en: "Vertically h = ½gt² gives t (independent of u); then x = u t gives u." },
    g: G, h: 20, target: { x: 40, y: 0, r: 1.5 }, blocks: [cliff(20)], lock: { theta: 0 }, uMax: 40, world: { xMax: 55, yMax: 30 }, start: { u: 10, theta: 0 },
  },
  {
    id: "moon", name: { zh: "月球基地", en: "Moon base" },
    brief: { zh: "月球上 g = 1.62 m s⁻²。靶在 80 m。用地球的習慣射，會飛出畫面。", en: "On the Moon g = 1.62 m s⁻². Target at 80 m. Earth habits will send it off the screen." },
    hint: { zh: "R = u² sin 2θ / g：g 細了六倍，同樣的 u 射程遠六倍。", en: "R = u² sin 2θ / g: g is six times smaller, so the same u goes six times further." },
    g: 1.62, h: 0, target: { x: 80, y: 0, r: 2 }, blocks: [], uMax: 40, world: { xMax: 100, yMax: 50 }, start: { u: 20, theta: 45 },
  },
  {
    id: "gap", name: { zh: "穿隙", en: "Through the gap" },
    brief: { zh: "牆上有一個缺口，離地 12 m 至 18 m。炮彈要穿過缺口，再落在 60 m 的靶。", en: "The wall has a gap between 12 m and 18 m up. Thread the gap, then land on the target at 60 m." },
    hint: { zh: "先由射程定出 u 與 θ 的組合，再檢查 x = 31 m 時 y 是否在 12 至 18 m 之間。", en: "First find (u, θ) pairs from the range, then check that y at x = 31 m lies between 12 and 18 m." },
    g: G, h: 0, target: { x: 60, y: 0, r: 2 }, blocks: [wall(30, 12), ceiling(30, 32, 18, 22)], uMax: 40, world: { xMax: 75, yMax: 40 }, start: { u: 25, theta: 45 },
  },
  {
    id: "economy", name: { zh: "最省力", en: "Least effort" },
    brief: { zh: "靶在 40 m。用越小的初速命中，星越多。哪個角度最省力？", en: "Target at 40 m. The smaller the speed you hit with, the more stars. Which angle needs the least speed?" },
    hint: { zh: "R = u² sin 2θ / g 中 sin 2θ 最大是 1（θ = 45°），所以最小 u = √(gR)。", en: "In R = u² sin 2θ / g the largest sin 2θ is 1 (θ = 45°), so the minimum u is √(gR)." },
    g: G, h: 0, target: { x: 40, y: 0, r: 1.5 }, blocks: [], uMax: 40, world: { xMax: 55, yMax: 30 }, goal: "economy", start: { u: 30, theta: 20 },
  },
];
