import { Html } from "@react-three/drei";
import { withUnit } from "@/shell/format";
import type { Vec3 } from "@/shell/types";

// 場景內讀數標籤：三位有效數字、指數式單位、符號斜體
export function Label({ position, symbol, value, unit }: { position: Vec3; symbol: string; value: number; unit: string }) {
  return (
    <Html position={position} style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
      <span className="slabel"><i>{symbol}</i> = {withUnit(value, unit)}</span>
    </Html>
  );
}
