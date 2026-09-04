import { VectorArrow, Label, Trail } from "@/components";
import type { RenderPlan } from "@/shell/types";

// 只畫 plan() 的結果。這裏沒有物理、沒有 if 判斷方向。
export default function Scene({ plan }: { plan: RenderPlan }) {
  return (
    <>
      {/* 地面：儀器與物件一律程式幾何 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#d9ded8" />
      </mesh>

      {/* 主體：球，位置取第一支箭嘴的起點（範本簡化；真正的模擬把物體位置也放入 plan） */}
      <mesh position={plan.arrows[0]?.origin ?? [0, 0, 0]} castShadow>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial color="#1c2530" />
      </mesh>

      {plan.arrows.map((a, i) => (
        <VectorArrow key={i} kind={a.kind} origin={a.origin} vector={a.vector} scale={plan.scales[a.kind] ?? 1} label={a.label} />
      ))}
      {plan.labels.map((l, i) => (
        <Label key={i} position={l.position} symbol={l.symbol} value={l.value} unit={l.unit} />
      ))}
      {plan.trails?.map(t => <Trail key={t.key} points={t.points} />)}
    </>
  );
}
