import { VectorArrow } from "./VectorArrow";
import { Label } from "./Label";
import { Trail } from "./Trail";
import type { RenderPlan } from "@/shell/types";

// 把 RenderPlan 畫出來：物體、箭嘴、標籤、軌跡。模擬的 Scene.tsx 通常包住它再加自己的固定幾何（地面、儀器）。
export function PlanScene({ plan }: { plan: RenderPlan }) {
  return (
    <>
      {plan.bodies?.map(b => (
        <mesh key={b.key} position={b.position} rotation={b.rotation ?? [0, 0, 0]} castShadow>
          {b.shape === "sphere" && <sphereGeometry args={[b.size[0], 32, 32]} />}
          {b.shape === "box" && <boxGeometry args={b.size} />}
          {b.shape === "cylinder" && <cylinderGeometry args={[b.size[0], b.size[0], b.size[1], 32]} />}
          <meshStandardMaterial color={b.color ?? "#1c2530"} />
        </mesh>
      ))}
      {plan.arrows.map((a, i) => (
        <VectorArrow key={`${a.kind}-${i}`} kind={a.kind} origin={a.origin} vector={a.vector} scale={plan.scales[a.kind] ?? 1} label={a.label} />
      ))}
      {plan.labels.map((l, i) => <Label key={i} position={l.position} symbol={l.symbol} value={l.value} unit={l.unit} />)}
      {plan.trails?.map(t => <Trail key={t.key} points={t.points} />)}
    </>
  );
}
