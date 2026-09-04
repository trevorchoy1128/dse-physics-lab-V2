// 全站座標約定（不得自行換軸）：x 向右、y 向上、z 指向觀眾，右手系。
// three.js 本身就是右手 y-up；這裏把約定寫成常數並以 frame.test.ts 固定。
import type { Vec3 } from "./types";
export const X: Vec3 = [1, 0, 0];
export const Y: Vec3 = [0, 1, 0];
export const Z: Vec3 = [0, 0, 1];
export const FRAME = {
  right: X, up: Y, towardViewer: Z,
  note: "x 向右、y 向上、z 指向觀眾（右手系）。磁場「入紙」= −z，「出紙」= +z。",
} as const;
