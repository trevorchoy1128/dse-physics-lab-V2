import type { Vec3 } from "@/shell/types";
export type { Vec3 };
// 所有結果 + 0：把 −0 正規化為 0，避免測試與比對出現 −0 ≠ 0
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0] + 0, a[1] + b[1] + 0, a[2] + b[2] + 0];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0] + 0, a[1] - b[1] + 0, a[2] - b[2] + 0];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k + 0, a[1] * k + 0, a[2] * k + 0];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1] + 0, a[2] * b[0] - a[0] * b[2] + 0, a[0] * b[1] - a[1] * b[0] + 0];
export const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: Vec3): Vec3 => { const n = norm(a); return n === 0 ? [0, 0, 0] : scale(a, 1 / n); };
export const sum = (...vs: Vec3[]): Vec3 => vs.reduce(add, [0, 0, 0]);
/** 把大小為 m、與 x 軸成 θ（弧度，逆時針）的平面矢量分解為 [x, y, 0] */
export const resolve = (m: number, theta: number): Vec3 => [m * Math.cos(theta), m * Math.sin(theta), 0];
export const angleBetween = (a: Vec3, b: Vec3) => Math.acos(Math.min(1, Math.max(-1, dot(a, b) / (norm(a) * norm(b)))));
