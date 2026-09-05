import type { PlanFn, Vec3, ArrowPlan } from "@/shell/types";
import type { S, P } from "./model";

// 畫面的物理（純函數）。2D 場景：軌道上的小車 + 三張線圖，線圖以 trails 傳遞（點 = [t, y, 0]），
// 軸範圍與旗標放 meta（非物理判斷）。

/** 軌道要顯示的位移範圍（正負對稱），取整到好看的刻度 */
export function trackExtent(p: P): number {
  let smax: number;
  if (p.mode === "draw") smax = p.vt.reduce((acc, v) => acc + Math.abs(v), 0);      // 每段 1 s，上界
  else smax = Math.abs(p.u) * p.T + 0.5 * Math.abs(p.a) * p.T * p.T;
  smax = Math.max(5, smax);
  const steps = [5, 10, 20, 50, 100, 200, 500, 1000];
  return steps.find(x => x >= smax) ?? Math.ceil(smax / 1000) * 1000;
}

export const plan: PlanFn<S, P> = (s, p, obs, layers) => {
  const pos: Vec3 = [s.s, 0, 0];
  const arrows: ArrowPlan[] = [];
  if (layers.velocity) arrows.push({ kind: "velocity", origin: [s.s, 0.45, 0], vector: [s.v, 0, 0], label: "v", layer: "velocity" });
  if (layers.acceleration) arrows.push({ kind: "acceleration", origin: [s.s, 0.75, 0], vector: [obs.a, 0, 0], label: "a", layer: "acceleration" });
  const vmax = p.mode === "draw" ? Math.max(1, ...p.vt.map(Math.abs)) : Math.max(1, Math.abs(p.u), Math.abs(p.u + p.a * p.T));
  const amax = p.mode === "draw" ? Math.max(1, ...p.vt.slice(1).map((v, k) => Math.abs(v - p.vt[k]))) : Math.max(1, Math.abs(p.a));
  const smaxGraph = Math.max(1, ...s.hist.map(h => Math.abs(h.s)), Math.abs(s.s));
  return {
    bodies: [{ key: "trolley", shape: "box", position: pos, size: [0.6, 0.3, 0.3], color: "#1c2530" }],
    arrows,
    labels: [{ position: [s.s, -0.5, 0], symbol: "s", value: s.s, unit: "m" }],
    trails: [
      { key: "s-t", points: s.hist.map(h => [h.t, h.s, 0] as Vec3) },
      { key: "v-t", points: s.hist.map(h => [h.t, h.v, 0] as Vec3) },
      { key: "a-t", points: s.hist.map(h => [h.t, h.a, 0] as Vec3) },
      // 控制點補齊至 T + 1 個；vt 短於 T 時以最後一個值延續（與 vAt 的夾持一致）
      ...(p.mode === "draw" ? [{ key: "vt-handles", points: Array.from({ length: p.T + 1 }, (_, k) => [k, p.vt[Math.min(k, p.vt.length - 1)], 0] as Vec3) }] : []),
    ],
    scales: { velocity: 0.25, acceleration: 0.25 },
    meta: {
      t: s.t, T: p.T, s: s.s, v: s.v, a: obs.a,
      smax: trackExtent(p), sGraph: smaxGraph, vmax, amax,
      draw: p.mode === "draw" ? 1 : 0,
      tangent: layers.tangent ? 1 : 0, area: layers.area ? 1 : 0,
      done: s.done ? 1 : 0,
    },
  };
};
