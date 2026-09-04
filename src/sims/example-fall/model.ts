import type { SimModel } from "@/shell/types";
import { rk4 } from "@/physics/integrators";

export interface P { h: number; m: number; g: number }
export interface S { t: number; y: number; v: number; landed: boolean }

const deriv = (p: P) => (_t: number, s: number[]) => [s[1], -p.g];

export const model: SimModel<S, P> = {
  init: (p) => ({ t: 0, y: p.h, v: 0, landed: false }),
  step(s, p, dt) {
    if (s.landed) return { ...s, t: s.t + dt };
    const [y, v] = rk4(deriv(p), [s.y, s.v], s.t, dt);
    const landed = y <= 0;
    return { t: s.t + dt, y: landed ? 0 : y, v: landed ? 0 : v, landed };
  },
  observe: (s, p) => ({
    y: s.y,
    v: s.v,
    a: s.landed ? 0 : -p.g,
    speed: Math.abs(s.v),
    Ek: 0.5 * p.m * s.v * s.v,
    Ep: p.m * p.g * s.y,
    W: p.m * p.g,
  }),
  events: (prev, next) => (!prev.landed && next.landed ? [{ key: "landed", t: next.t, label: { zh: "落地", en: "Landed" } }] : []),
};
