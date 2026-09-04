import { Line } from "@react-three/drei";
import type { Vec3 } from "@/shell/types";

export function Trail({ points, color = "#7a8592" }: { points: Vec3[]; color?: string }) {
  if (points.length < 2) return null;
  return <Line points={points} color={color} lineWidth={1.5} dashed dashSize={0.08} gapSize={0.05} />;
}
