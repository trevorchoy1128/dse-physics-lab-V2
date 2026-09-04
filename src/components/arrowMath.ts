// 向量箭嘴的純數學與樣式：可測試，不依賴 React。
import { Quaternion, Vector3 } from "three";
import type { ArrowKind, Vec3 } from "@/shell/types";

export interface ArrowStyle {
  color: string;
  dashed: boolean;
  head: "cone" | "open";   // cone = 力（實心錐）；open = 速度/加速度（開口 V 形）
  width: number;           // 桿半徑（世界單位，乘以場景比例）
}

// 全站向量顏色與線型（Book 2 規格 §0.3）。速度與力的箭頭形狀不同是硬性要求。
export const ARROW_STYLE: Record<ArrowKind, ArrowStyle> = {
  weight:       { color: "#d62828", dashed: false, head: "cone", width: 0.03 },
  normal:       { color: "#1d5fd6", dashed: false, head: "cone", width: 0.03 },
  friction:     { color: "#f77f00", dashed: false, head: "cone", width: 0.03 },
  tension:      { color: "#7b2cbf", dashed: false, head: "cone", width: 0.03 },
  net:          { color: "#111111", dashed: false, head: "cone", width: 0.045 },
  velocity:     { color: "#1a9c4b", dashed: false, head: "open", width: 0.022 },
  acceleration: { color: "#1a9c4b", dashed: true,  head: "open", width: 0.022 },
  field:        { color: "#0e8f8a", dashed: false, head: "cone", width: 0.015 },
};

export interface ArrowTransform {
  length: number;              // 畫出的長度 = |vector| × scale
  quaternion: [number, number, number, number]; // 把 +y 轉到 vector 方向
  headLength: number;
  shaftLength: number;
}

const UP = new Vector3(0, 1, 0);

/** 由物理向量與縮放係數算出畫箭嘴所需的長度與朝向。零向量回傳 length 0。 */
export function arrowTransform(vector: Vec3, scale: number, headRatio = 0.25, minHead = 0.08, maxHead = 0.35): ArrowTransform {
  const v = new Vector3(...vector);
  const mag = v.length();
  const length = mag * scale;
  if (length === 0) return { length: 0, quaternion: [0, 0, 0, 1], headLength: 0, shaftLength: 0 };
  const q = new Quaternion().setFromUnitVectors(UP, v.clone().normalize());
  const headLength = Math.min(length, Math.min(maxHead, Math.max(minHead, length * headRatio)));
  const shaftLength = Math.max(0, length - headLength);
  return { length, quaternion: [q.x, q.y, q.z, q.w], headLength, shaftLength };
}

/** 檢驗用：把 +y 經 quaternion 旋轉後的方向 */
export function directionOf(q: [number, number, number, number]): Vec3 {
  const v = UP.clone().applyQuaternion(new Quaternion(...q));
  return [v.x, v.y, v.z];
}
