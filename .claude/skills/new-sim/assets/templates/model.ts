import type { SimModel } from "@/shell/types";
import { rk4 } from "@/physics/integrators";

// 參數：與 controls.ts 的 key 一一對應，符號跟考評局公式表
export interface P {
  h: number;   // 釋放高度 / m
  g: number;   // 重力加速度 / m s⁻²
}
// 狀態：只放隨時間演化的量
export interface S {
  t: number;
  y: number;   // 高度 / m
  v: number;   // 速度，向上為正 / m s⁻¹
  landed: boolean;
}

// 方程照規格抄：a = −g（無空氣阻力）
const deriv = (p: P) => (_t: number, s: number[]) => [s[1], -p.g];

export const model: SimModel<S, P> = {
  init: (p) => ({ t: 0, y: p.h, v: 0, landed: false }),

  step(s, p, dt) {
    if (s.landed) return s;
    const [y, v] = rk4(deriv(p), [s.y, s.v], s.t, dt);
    const landed = y <= 0;
    return { t: s.t + dt, y: landed ? 0 : y, v: landed ? 0 : v, landed };
  },

  // 即時顯示的量：SI 單位，不格式化（三位有效數字由 shell 處理）
  observe: (s, p) => ({
    t: s.t,
    y: s.y,
    v: s.v,
    a: s.landed ? 0 : -p.g,
    speed: Math.abs(s.v),
    Ek: 0.5 * 1 * s.v * s.v,        // 以 1 kg 計；真正的模擬把 m 放入 P
  }),

  events: (prev, next) => (!prev.landed && next.landed ? [{ key: "landed", t: next.t, label: { zh: "落地", en: "Landed" } }] : []),
};
