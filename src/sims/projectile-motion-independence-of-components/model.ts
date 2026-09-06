import type { SimModel } from "@/shell/types";
import { rk4 } from "@/physics/integrators";

// Book 2 規格 模擬器 2：拋體運動。方程照規格：
//   水平（a = 0）：x = u cosθ · t
//   垂直（a = −g）：y = h + u sinθ · t − ½gt²，v_y = u sinθ − gt
//   飛行時間（同一水平面）t = 2u sinθ / g；射程 R = u² sin2θ / g；最高點 H = h + u² sin²θ / 2g
// 空氣阻力（規格只說「開／關」；老師 2026-09-06 定：與 v 成正比、效果要明顯）：F = −k v，a = −(k/m) v，k = K_AIR。
// 質量 m（老師 2026-09-06 定加入滑桿）只影響動能、重量與空氣阻力的加速度；無阻力時路徑與 m 無關。
// 兩顆球共用同一組方程；第二顆球只是初速不同（自由下落 u = 0，或水平初速加倍）。

export interface P {
  u: number;                              // 初速 / m s⁻¹
  theta: number;                          // 投射角 / °（控制項用度；模型內轉弧度）
  h: number;                              // 發射高度 / m
  g: number;                              // 重力加速度 / m s⁻²
  m: number;                              // 質量 / kg
  air: boolean;                           // 空氣阻力
  companion: "none" | "drop" | "fast";    // 第二顆球：無 / 同時自由下落 / 水平初速加倍
}

export interface Ball {
  x: number; y: number;                   // 位置 / m（發射點 x = 0，地面 y = 0）
  vx: number; vy: number;                 // 速度分量 / m s⁻¹
  landed: boolean;
  tLand: number;                          // 落地時刻 / s（未落地為 NaN）
}

export interface S {
  t: number;
  a: Ball;                                // 主球
  b?: Ball;                               // 第二顆球
  path: [number, number][];               // 主球路徑樣本（每 SAMPLE_DT）/ m
  pathB: [number, number][];
  strobe: [number, number, number][];     // 頻閃影像 [x, y, t]，每 STROBE_DT 一個
  strobeB: [number, number, number][];
  hist: { t: number; Ek: number; EkB: number }[];   // 動能—時間樣本（每 SAMPLE_DT）
  sinceSample: number;
  sinceStrobe: number;
}

export const K_AIR = 0.3;        // 空氣阻力係數 / N s m⁻¹（F = −k v；老師定「正比、明顯」：m = 1 kg 時 2 s 內 vₓ 減約 45%，終端速率 m g / k ≈ 33 m s⁻¹）
export const SAMPLE_DT = 0.02;
export const STROBE_DT = 0.1;

const rad = (deg: number) => (deg * Math.PI) / 180;

// 導數：狀態 [x, y, vx, vy]
const deriv = (p: P) => (_t: number, s: number[]) => {
  const [, , vx, vy] = s;
  let ax = 0, ay = -p.g;
  if (p.air) { ax -= (K_AIR / p.m) * vx; ay -= (K_AIR / p.m) * vy; }
  return [vx, vy, ax, ay];
};

const launch = (p: P, ux: number, uy: number): Ball => {
  // h = 0 而不向上射（θ ≤ 0）：一開始已在地面
  const onGround = p.h <= 0 && uy <= 0;
  return { x: 0, y: p.h, vx: onGround ? 0 : ux, vy: onGround ? 0 : uy, landed: onGround, tLand: onGround ? 0 : NaN };
};

/** 推進一顆球 dt；越過地面時以二分法找出落地瞬間（RK4 對無阻力運動精確，故落地時刻與解析解一致） */
function advance(b: Ball, p: P, t: number, dt: number): Ball {
  if (b.landed) return b;
  const f = deriv(p);
  const y0 = [b.x, b.y, b.vx, b.vy];
  let y1 = rk4(f, y0, t, dt);
  if (y1[1] > 0) return { ...b, x: y1[0], y: y1[1], vx: y1[2], vy: y1[3] };
  // 二分 τ ∈ (0, dt]：y(τ) = 0
  let lo = 0, hi = dt;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const ym = rk4(f, y0, t, mid);
    if (ym[1] > 0) lo = mid; else hi = mid;
  }
  y1 = rk4(f, y0, t, hi);
  return { x: y1[0], y: 0, vx: y1[2], vy: y1[3], landed: true, tLand: t + hi };
}

export const model: SimModel<S, P> = {
  init(p) {
    const th = rad(p.theta);
    const ux = p.u * Math.cos(th), uy = p.u * Math.sin(th);
    const a = launch(p, ux, uy);
    const b = p.companion === "drop" ? launch(p, 0, 0) : p.companion === "fast" ? launch(p, 2 * ux, uy) : undefined;
    return {
      t: 0, a, b,
      path: [[a.x, a.y]], pathB: b ? [[b.x, b.y]] : [],
      strobe: [[a.x, a.y, 0]], strobeB: b ? [[b.x, b.y, 0]] : [],
      hist: [{ t: 0, Ek: ek(a, p.m), EkB: b ? ek(b, p.m) : 0 }],
      sinceSample: 0, sinceStrobe: 0,
    };
  },

  step(s, p, dt) {
    const a = advance(s.a, p, s.t, dt);
    const b = s.b ? advance(s.b, p, s.t, dt) : undefined;
    if (s.a.landed && (!s.b || s.b.landed)) return s;   // 落地即停：整個狀態（含 t）凍結在最後一顆球落地的瞬間
    const allLanded = a.landed && (!b || b.landed);
    const t = allLanded ? Math.max(a.tLand, b?.tLand ?? 0) : s.t + dt;   // 最後一顆落地的一步：t 取準確的落地時刻

    let { sinceSample, sinceStrobe } = s;
    let path = s.path, pathB = s.pathB, strobe = s.strobe, strobeB = s.strobeB, hist = s.hist;
    sinceSample += dt; sinceStrobe += dt;
    if (sinceSample >= SAMPLE_DT - 1e-9 || allLanded) {
      sinceSample = allLanded ? 0 : sinceSample - SAMPLE_DT;
      path = [...path, [a.x, a.y]];
      if (b) pathB = [...pathB, [b.x, b.y]];
      hist = [...hist, { t, Ek: ek(a, p.m), EkB: b ? ek(b, p.m) : 0 }];
    }
    if (sinceStrobe >= STROBE_DT - 1e-9) {
      sinceStrobe -= STROBE_DT;
      const tImg = Math.round(t / STROBE_DT) * STROBE_DT;
      if (!s.a.landed) strobe = [...strobe, [a.x, a.y, tImg]];
      if (b && !s.b!.landed) strobeB = [...strobeB, [b.x, b.y, tImg]];
    }
    return { t, a, b, path, pathB, strobe, strobeB, hist, sinceSample, sinceStrobe };
  },

  // 規格「即時顯示」：v_x、v_y、合速率、飛行時間、當前高度、水平距離；另加動能（現象 3）與加速度（箭嘴）
  observe(s, p) {
    const a = s.a;
    const v = Math.hypot(a.vx, a.vy);
    let ax = 0, ay = a.landed ? 0 : -p.g;
    if (p.air && !a.landed) { ax -= (K_AIR / p.m) * a.vx; ay -= (K_AIR / p.m) * a.vy; }
    const o: Record<string, number> = {
      t: s.t,
      tf: a.landed ? a.tLand : s.t,
      x: a.x, y: a.y, vx: a.vx, vy: a.vy, v,
      ax, ay,
      Ek: ek(a, p.m),
      H: maxHeight(p, p.theta),
    };
    if (s.b) { o.xB = s.b.x; o.yB = s.b.y; o.EkB = ek(s.b, p.m); }
    return o;
  },

  done: s => s.a.landed && (!s.b || s.b.landed),

  events(prev, next) {
    const ev = [];
    if (!prev.a.landed && next.a.landed) ev.push({ key: "landed", t: next.a.tLand, label: { zh: "落地", en: "Landed" } });
    if (prev.a.vy > 0 && next.a.vy <= 0) ev.push({ key: "top", t: next.t, label: { zh: "最高點", en: "Highest point" } });
    return ev;
  },
};

const ek = (b: Ball, m: number) => 0.5 * m * (b.vx * b.vx + b.vy * b.vy);

// ---- 解析解（無空氣阻力），供時間拉桿、場景範圍與「各角度射程比較」圖層 ----
/** 飛行時間 / s：h + u sinθ t − ½gt² = 0 的正根；h = 0 時即 2u sinθ / g */
export function flightTime(p: Pick<P, "u" | "h" | "g">, thetaDeg: number): number {
  const uy = p.u * Math.sin(rad(thetaDeg));
  if (p.h <= 0 && uy <= 0) return 0;
  return (uy + Math.sqrt(uy * uy + 2 * p.g * p.h)) / p.g;
}
/** 射程 / m */
export const range = (p: Pick<P, "u" | "h" | "g">, thetaDeg: number) => p.u * Math.cos(rad(thetaDeg)) * flightTime(p, thetaDeg);
/** 最高點 / m：H = h + u² sin²θ / 2g（向下射時即 h） */
export function maxHeight(p: Pick<P, "u" | "h" | "g">, thetaDeg: number): number {
  const uy = p.u * Math.sin(rad(thetaDeg));
  return uy > 0 ? p.h + (uy * uy) / (2 * p.g) : p.h;
}
/** 解析路徑（無空氣阻力）n + 1 點，由發射點到落地點 */
export function trajectory(p: Pick<P, "u" | "h" | "g">, thetaDeg: number, n = 60): [number, number][] {
  const th = rad(thetaDeg), tf = flightTime(p, thetaDeg);
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = (tf * i) / n;
    pts.push([p.u * Math.cos(th) * t, Math.max(0, p.h + p.u * Math.sin(th) * t - 0.5 * p.g * t * t)]);
  }
  return pts;
}
