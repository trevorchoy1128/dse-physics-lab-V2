import type { PlanFn, Vec3, ArrowPlan, BodyPlan, Layers } from "@/shell/types";
import { K_AIR, range, maxHeight, flightTime, trajectory, type S, type P } from "./model";

// 畫面的物理：純函數，輸出「畫甚麼」。Scene.tsx（3D）與 Views.tsx（側視、俯視、動能圖）只畫這裏的結果。
// 世界單位 = 米 × k，k = WORLD / L，L 為本次運行的場景範圍（米，由參數的解析射程與最高點決定，運行中不變）。
// 球心比物理點高 BALL_R（球放在地面上，地面 y = 0）。箭嘴 vector 一律填物理量（SI），縮放在 scales 統一。

export const WORLD = 20;          // 場景寬度 / 世界單位
export const BALL_R = 0.35;       // 球半徑 / 世界單位
export const STROBE_R = 0.16;     // 頻閃影像半徑 / 世界單位
export const Z_OFF = 3;           // 第二顆球的 z 偏移（向裏）/ 世界單位
export const SIDE_Z = -7;         // 側視投影牆的 z / 世界單位
export const GHOST_ANGLES = [15, 30, 45, 60, 75];
export const A_OFF = 0.8;         // 加速度箭嘴起點向觀眾方向的偏移 / 世界單位（避免與重量箭嘴重疊）
export const COLOR_A = "#e0891c";
export const COLOR_B = "#4a6fa5";

/** 場景範圍 L（米）：射程（含第二顆球、各角度比較）與最高點取大者 */
export function extent(p: P, layers: Layers): { L: number; xMax: number; yMax: number } {
  let xMax = Math.max(range(p, p.theta) * (p.companion === "fast" ? 2 : 1), 1);
  let yMax = Math.max(maxHeight(p, p.theta), p.h);
  if (layers.ghosts) for (const th of GHOST_ANGLES) { xMax = Math.max(xMax, range(p, th)); yMax = Math.max(yMax, maxHeight(p, th)); }
  const L = Math.max(xMax, 1.3 * yMax, 4);
  return { L, xMax, yMax };
}

/** 線性阻力（F = −k v）下的落地時刻：y(t) = h + (uᵧ + g/c)(1 − e^(−ct))/c − g t / c 的正根（c = k/m），以二分法求；只供時間拉桿的上限 */
export function flightTimeDrag(p: P, uy: number): number {
  if (p.h <= 0 && uy <= 0) return 0;
  const c = K_AIR / p.m, g = p.g;
  const y = (t: number) => p.h + ((uy + g / c) * (1 - Math.exp(-c * t))) / c - (g * t) / c;
  let lo = 0, hi = Math.max(1, (uy + Math.sqrt(uy * uy + 2 * g * p.h)) / g);
  while (y(hi) > 0 && hi < 1e4) { lo = hi; hi *= 2; }
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (y(mid) > 0) lo = mid; else hi = mid; }
  return hi;
}

/** 本次運行的總時長（秒）：兩顆球中較遲落地者（有阻力用閉式解求落地時刻），另加 0.3 s */
export function duration(p: P): number {
  const uy = p.u * Math.sin((p.theta * Math.PI) / 180);
  const tfA = p.air ? flightTimeDrag(p, uy) : flightTime(p, p.theta);
  let tf = tfA;
  if (p.companion === "drop") tf = Math.max(tf, p.air ? flightTimeDrag(p, 0) : Math.sqrt((2 * p.h) / p.g));
  return tf + 0.3;
}

export const plan: PlanFn<S, P> = (s, p, obs, layers) => {
  const { L, xMax, yMax } = extent(p, layers);
  const k = WORLD / L;
  const w = (x: number, y: number, z = 0): Vec3 => [x * k, y * k + BALL_R, z];
  const a = s.a, b = s.b;
  const posA = w(a.x, a.y), posB = b ? w(b.x, b.y, -Z_OFF) : undefined;

  // ---- 物體 ----
  const bodies: BodyPlan[] = [{ key: "ball-a", shape: "sphere", position: posA, size: [BALL_R, 0, 0], color: COLOR_A }];
  if (posB) bodies.push({ key: "ball-b", shape: "sphere", position: posB, size: [BALL_R, 0, 0], color: COLOR_B });
  // 球的地面影子（永遠有：落地後可見球貼地，斜視不會像浮在半空）
  bodies.push({ key: "gshadow-a", shape: "cylinder", position: [posA[0], 0.015, 0], size: [BALL_R * 0.9, 0.02, 0] });
  if (posB) bodies.push({ key: "gshadow-b", shape: "cylinder", position: [posB[0], 0.015, -Z_OFF], size: [BALL_R * 0.9, 0.02, 0] });
  if (layers.strobe) {
    s.strobe.forEach(([x, y], i) => {
      bodies.push({ key: `strobe-a-${i}`, shape: "sphere", position: w(x, y), size: [STROBE_R, 0, 0], color: COLOR_A });
      bodies.push({ key: `shadow-a-${i}`, shape: "cylinder", position: [x * k, 0.01, 0], size: [STROBE_R, 0.02, 0], color: COLOR_A });   // 俯視投影：地面影子
      bodies.push({ key: `wall-a-${i}`, shape: "cylinder", position: [x * k, y * k + BALL_R, SIDE_Z], size: [STROBE_R * 0.8, 0.02, 0] });   // 側視投影：牆上影子
      if (p.companion !== "drop") bodies.push({ key: `ycol-a-${i}`, shape: "cylinder", position: [-0.9, y * k + BALL_R, SIDE_Z], size: [STROBE_R * 0.8, 0.02, 0] });   // 牆左緣：只看高度的影子列（垂直運動）；自由下落的第二顆球本身就是這一列，故不重複
    });
    s.strobeB.forEach(([x, y], i) => {
      bodies.push({ key: `strobe-b-${i}`, shape: "sphere", position: w(x, y, -Z_OFF), size: [STROBE_R, 0, 0], color: COLOR_B });
      bodies.push({ key: `shadow-b-${i}`, shape: "cylinder", position: [x * k, 0.01, -Z_OFF], size: [STROBE_R, 0.02, 0], color: COLOR_B });
    });
  }

  // ---- 箭嘴（物理量，SI）----
  const arrows: ArrowPlan[] = [];
  const vA = Math.hypot(a.vx, a.vy);
  const ballArrows = (o: Vec3, bl: typeof a, tag: string) => {
    if (bl.landed) return;   // 落地即停：不再畫箭嘴（讀數保留落地瞬間的值）
    if (layers.velocity) arrows.push({ kind: "velocity", origin: o, vector: [bl.vx, bl.vy, 0], label: "v", layer: "velocity" });
    if (layers.vx) arrows.push({ kind: "velocity", origin: o, vector: [bl.vx, 0, 0], label: "vₓ", layer: "vx" });
    if (layers.vy) arrows.push({ kind: "velocity", origin: o, vector: [0, bl.vy, 0], label: "vᵧ", layer: "vy" });
    if (tag === "a") {
      // 加速度箭嘴與重量箭嘴同向同長（m = 1 kg），故起點向觀眾方向偏移 A_OFF，兩支才都看得見（畫面約定，不是物理）
      if (layers.acceleration) arrows.push({ kind: "acceleration", origin: [o[0], o[1], o[2] + A_OFF], vector: [obs.ax, obs.ay, 0], label: "a", layer: "acceleration" });
      if (layers.weight) arrows.push({ kind: "weight", origin: o, vector: [0, -p.m * p.g, 0], label: "W", layer: "weight" });
      if (layers.air && p.air) arrows.push({ kind: "friction", origin: o, vector: [-K_AIR * bl.vx, -K_AIR * bl.vy, 0], label: "f", layer: "air" });
    }
  };
  ballArrows(posA, a, "a");
  if (b && posB) ballArrows(posB, b, "b");

  // 縮放：速度以主球可達的最大速率為準（4 個世界單位）；力與加速度以本次運行可達的最大值為準（3 個世界單位）；
  // 力的 kind（重量、空氣阻力）共用一個係數，以本次運行的最大加速度 aMax = g + (k/m)·vRef 為準，運行中不變
  const vRef = Math.max(1, Math.sqrt(p.u * p.u + 2 * p.g * p.h));
  const aMax = p.g + (p.air ? (K_AIR / p.m) * vRef : 0);
  // 加速度與重量同向：畫出長度刻意不同（3.2 對 2.4），加上 z 偏移，兩支箭嘴與標籤才分得開
  const forceScale = 2.4 / (p.m * aMax);
  const scales = { velocity: 4 / vRef, acceleration: 3.2 / aMax, weight: forceScale, friction: forceScale };

  // ---- 標籤：x 在球的正下方地面，y 在發射器旁同一高度 ----
  const labels = [
    { position: [posA[0], 0.05, 1.4] as Vec3, symbol: "x", value: a.x, unit: "m" },   // 地面上方、球的正前方（不放地面以下）
    { position: [-3.6, posA[1], 0] as Vec3, symbol: "y", value: a.y, unit: "m" },
  ];

  // ---- 軌跡與線 ----
  const trails: { key: string; points: Vec3[] }[] = [];
  if (layers.path) {
    trails.push({ key: "path-a", points: s.path.map(([x, y]) => w(x, y)) });
    trails.push({ key: "proj-top-a", points: s.path.map(([x]) => [x * k, 0.02, 0] as Vec3) });
    trails.push({ key: "proj-side-a", points: s.path.map(([x, y]) => [x * k, y * k + BALL_R, SIDE_Z] as Vec3) });
    if (b) trails.push({ key: "path-b", points: s.pathB.map(([x, y]) => w(x, y, -Z_OFF)) });
  }
  if (!a.landed) trails.push({ key: "drop-a", points: [posA, [posA[0], 0, 0]] });
  if (posB) trails.push({ key: "sync", points: [posA, posB] });
  if (layers.ghosts) for (const th of GHOST_ANGLES) trails.push({ key: `ghost-${th}`, points: trajectory(p, th, 60).map(([x, y]) => w(x, y)) });
  trails.push({ key: "Ek-t", points: s.hist.map(hh => [hh.t, hh.Ek, 0] as Vec3) });
  if (b) trails.push({ key: "EkB-t", points: s.hist.map(hh => [hh.t, hh.EkB, 0] as Vec3) });

  const th = (p.theta * Math.PI) / 180;
  const ux = p.u * Math.cos(th), uy = p.u * Math.sin(th);
  const EkMax = 0.5 * p.m * ((p.companion === "fast" ? 4 * ux * ux : ux * ux) + uy * uy + 2 * p.g * p.h);
  return {
    bodies, arrows, labels, trails, scales,
    meta: {
      k, L, xMax, yMax, r: BALL_R, zOff: Z_OFF, sideZ: SIDE_Z, world: WORLD,
      t: s.t, tf: duration(p), hasB: b ? 1 : 0, dropB: p.companion === "drop" ? 1 : 0, air: p.air ? 1 : 0, landedA: a.landed ? 1 : 0, landedB: b?.landed ? 1 : 0,
      g: p.g, u: p.u, h: p.h, theta: p.theta, m: p.m, ux, uy,
      EkMax, EkMin: 0.5 * p.m * ux * ux, vA, photo: layers.photo ? 1 : 0,
      xA: a.x, yA: a.y, xB: b?.x ?? 0, yB: b?.y ?? 0,
    },
  };
};
