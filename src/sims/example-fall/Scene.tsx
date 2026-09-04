import { PlanScene } from "@/components";
import type { SceneProps } from "@/shell/types";

// 只畫 plan 的結果，加固定的地面。沒有物理、沒有 if 判斷方向。
export default function Scene({ plan }: SceneProps) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#e6ebe5" />
      </mesh>
      <PlanScene plan={plan} />
    </>
  );
}
