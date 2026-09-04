import type { PlanFn, Vec3, ArrowPlan } from "@/shell/types";
import type { S, P } from "./model";

export const plan: PlanFn<S, P> = (s, _p, obs, layers) => {
  const pos: Vec3 = [0, s.y, 0];
  const arrows: ArrowPlan[] = [];
  if (layers.velocity) arrows.push({ kind: "velocity", origin: pos, vector: [0, s.v, 0], label: "v", layer: "velocity" });
  if (layers.acceleration) arrows.push({ kind: "acceleration", origin: pos, vector: [0, obs.a, 0], label: "a", layer: "acceleration" });
  if (layers.weight) arrows.push({ kind: "weight", origin: pos, vector: [0, -obs.W, 0], label: "W", layer: "weight" });
  return {
    bodies: [{ key: "ball", shape: "sphere", position: pos, size: [0.25, 0, 0], color: "#1c2530" }],
    arrows,
    labels: [{ position: [0.6, s.y, 0], symbol: "y", value: s.y, unit: "m" }],
    scales: { velocity: 0.15, acceleration: 0.15, weight: 0.15 },
  };
};
