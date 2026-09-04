import type { PlanFn } from "@/shell/types";
import type { S, P } from "./model";

// 畫面的物理：純函數，輸出「畫甚麼」。Scene.tsx 只畫這裏的結果。
// vector 一律填物理量（SI）；縮放係數在 scales 統一，同一 kind 只有一個。
export const plan: PlanFn<S, P> = (s, p, obs, layers) => {
  const pos: [number, number, number] = [0, s.y, 0];
  return {
    arrows: [
      ...(layers.velocity ? [{ kind: "velocity" as const, origin: pos, vector: [0, s.v, 0] as [number, number, number], label: "v", layer: "velocity" }] : []),
      ...(layers.acceleration ? [{ kind: "acceleration" as const, origin: pos, vector: [0, obs.a, 0] as [number, number, number], label: "a", layer: "acceleration" }] : []),
      ...(layers.weight ? [{ kind: "weight" as const, origin: pos, vector: [0, -p.g, 0] as [number, number, number], label: "W", layer: "weight" }] : []),
    ],
    labels: [{ position: [1.2, s.y, 0], symbol: "y", value: s.y, unit: "m" }],
    scales: { velocity: 0.2, acceleration: 0.2, weight: 0.2 },
  };
};
