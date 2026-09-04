import { Html } from "@react-three/drei";
import { ARROW_STYLE, arrowTransform } from "./arrowMath";
import type { ArrowKind, Vec3 } from "@/shell/types";

export interface VectorArrowProps {
  kind: ArrowKind;
  origin: Vec3;
  vector: Vec3;      // 物理量（SI）
  scale: number;     // 畫出長度 = |vector| × scale；同一 kind 全場景一個
  label?: string;
}

// 向量箭嘴：顏色與線型由 kind 決定，不可覆寫。力 = 實心錐頭；速度/加速度 = 開口 V 頭，加速度虛線。
export function VectorArrow({ kind, origin, vector, scale, label }: VectorArrowProps) {
  const st = ARROW_STYLE[kind];
  const tr = arrowTransform(vector, scale);
  if (tr.length === 0) return null;
  const w = st.width;
  const dashes = st.dashed ? Math.max(2, Math.round(tr.shaftLength / (w * 6))) : 1;
  const dashLen = tr.shaftLength / dashes;
  return (
    <group position={origin} quaternion={tr.quaternion}>
      {Array.from({ length: dashes }, (_, i) => (
        (!st.dashed || i % 2 === 0) && (
          <mesh key={i} position={[0, dashLen * (i + 0.5), 0]}>
            <cylinderGeometry args={[w, w, dashLen * (st.dashed ? 0.7 : 1), 8]} />
            <meshStandardMaterial color={st.color} />
          </mesh>
        )
      ))}
      {st.head === "cone" ? (
        <mesh position={[0, tr.shaftLength + tr.headLength / 2, 0]}>
          <coneGeometry args={[w * 3, tr.headLength, 16]} />
          <meshStandardMaterial color={st.color} />
        </mesh>
      ) : (
        [-1, 1].map(s => (
          <mesh key={s} position={[s * tr.headLength * 0.3, tr.length - tr.headLength * 0.45, 0]} rotation={[0, 0, s * 0.6]}>
            <cylinderGeometry args={[w, w, tr.headLength, 8]} />
            <meshStandardMaterial color={st.color} />
          </mesh>
        ))
      )}
      {label && (
        <Html position={[0, tr.length + 0.15, 0]} center style={{ pointerEvents: "none" }}>
          <span className="vlabel" style={{ color: st.color }}><i>{label}</i></span>
        </Html>
      )}
    </group>
  );
}
