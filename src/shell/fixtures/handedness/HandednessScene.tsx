import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import { PlanScene } from "@/components";
import { cross } from "@/physics/vec";
import type { RenderPlan, Vec3 } from "@/shell/types";

// 左右手基準場景：固定一組 I、B，畫出 F = I L × B。任何方向類模擬的截圖都與此並排比較，確認沒有鏡像。
// 座標約定：x 向右、y 向上、z 指向觀眾；B「入紙」= −z。
const I: Vec3 = [1, 0, 0];          // 電流向右
const B: Vec3 = [0, 0, -1];         // 磁場入紙
const F: Vec3 = cross(I, B);        // = [0, 1, 0]，向上（弗林明左手定則）

export const handednessPlan: RenderPlan = {
  bodies: [{ key: "wire", shape: "cylinder", position: [0, 0, 0], size: [0.04, 3, 0], color: "#b08968", rotation: [0, 0, Math.PI / 2] }],
  arrows: [
    { kind: "velocity", origin: [-1.2, 0.25, 0], vector: I, label: "I", layer: "I" },
    ...[-1, 0, 1].flatMap(x => [-1, 1].map(y => ({ kind: "field" as const, origin: [x, y, 0.6] as Vec3, vector: B, label: x === 1 && y === 1 ? "B" : undefined, layer: "B" }))),
    { kind: "net", origin: [0, 0, 0], vector: F, label: "F", layer: "F" },
  ],
  labels: [],
  scales: { velocity: 1.2, field: 1.2, net: 1.5 },
};

export function HandednessFixture() {
  return (
    <div className="fixture">
      <Canvas camera={{ position: [0, 0.8, 6], fov: 40 }}>
        <color attach="background" args={["#f5f7f4"]} />
        <ambientLight intensity={0.8} /><directionalLight position={[5, 10, 5]} intensity={1} />
        <Grid args={[10, 10]} cellColor="#d8ddd7" sectionColor="#c3cac2" position={[0, -1.5, 0]} />
        <PlanScene plan={handednessPlan} />
        <Html position={[0, -1.2, 0]} center><div className="fixture-caption">I 向右（+x）、B 入紙（−z）⇒ F = I L × B 向上（+y）。若截圖中 F 向下，即座標被鏡像。</div></Html>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
