// 第二實作（獨立、純 JavaScript）：拋體運動：水平與垂直的獨立性 —— 第 4 輪（主實作 v0.3.0）
// 規格：reference/11_Book2_難點與3D模擬器規格.md 模擬器 2
//
// 方程（規格）：x = u cosθ · t ； y = h + u sinθ · t − ½ g t² ； v_y = u sinθ − g t ； H = h + u² sin²θ / 2g
// 空氣阻力（老師 2026-09-06 決定）：F = −k v，a = −(k/m) v，k = 0.3 N s m⁻¹，對兩顆球都作用。
//   令 c = k/m（s⁻¹）、v_t = m g / k = g / c（終端速率）：
//     v_x = u cosθ · e^(−ct)
//     v_y = (u sinθ + g/c) e^(−ct) − g/c
//     x   = (u cosθ / c)(1 − e^(−ct))
//     y   = h + ((u sinθ + g/c) / c)(1 − e^(−ct)) − (g/c) t
//   1 − e^(−ct) 用 −Math.expm1(−ct) 計算以免 c 很小時抵消。
// 質量 m（kg）：Ek = ½ m v²、EkB = ½ m v_B²；無阻力時路徑與 m 無關（方程本身不含 m）。
//
// 積分方法：不做數值積分。每幀直接在 t = n·dt 代入閉式解（有阻力用上列指數解、無阻力用規格方程），
//   落地時刻：無阻力用二次方程精確解；有阻力對閉式 y(t) 在 [t_n, t_{n+1}] 內做 100 次二分法求根
//   （閉式解是解析的，所以此為解析解 → 比對容限 1e-6）。
// 落地規則：y ≤ 0 即落地，位置 y = 0、速度凍結在落地瞬間，加速度歸 0。
//           h = 0 且 θ ≤ 0 時，球一開始已在地面：vx = vy = 0、tf = 0（B 球同樣以 y ≤ 0 且 v_y ≤ 0 判斷）。
//           最後一顆球落地後整個狀態（含 t）凍結在最後落地時刻。

export const K_AIR = 0.3;   // N s m⁻¹

// ---- 單顆球的閉式解 ----
// 回傳在時刻 t 的 {x, y, vx, vy}；c = 0 代表無阻力
function closedForm(ux, uy, h, g, c, t) {
  if (c === 0) {
    return { x: ux * t, y: h + uy * t - 0.5 * g * t * t, vx: ux, vy: uy - g * t };
  }
  const e = Math.exp(-c * t);
  const q = -Math.expm1(-c * t);          // 1 − e^(−ct)
  const vt = g / c;
  return {
    x: (ux / c) * q,
    y: h + ((uy + vt) / c) * q - vt * t,
    vx: ux * e,
    vy: (uy + vt) * e - vt,
  };
}

function accelOf(vx, vy, g, c) {
  return [-c * vx, -g - c * vy];
}

// 無阻力落地時刻：h + uy t − ½ g t² = 0 的正根
function landTimeNoDrag(uy, h, g) {
  if (h <= 0 && uy <= 0) return 0;
  return (uy + Math.sqrt(uy * uy + 2 * g * h)) / g;
}

// 有阻力：在 [ta, tb] 內二分求 y(t) = 0（已知 y(ta) > 0 或 ta = 0 且向上、y(tb) ≤ 0）
function bisectLand(ux, uy, h, g, c, ta, tb) {
  let lo = ta, hi = tb;
  for (let i = 0; i < 100; i++) {
    const mid = 0.5 * (lo + hi);
    if (mid <= lo || mid >= hi) break;
    if (closedForm(ux, uy, h, g, c, mid).y <= 0) hi = mid; else lo = mid;
  }
  return hi;
}

export function createSim(params, dt) {
  const { u, theta, h, g, air, companion } = params;
  const m = params.m ?? 1;
  const k = params.k ?? K_AIR;
  const c = air ? k / m : 0;
  const th = (theta * Math.PI) / 180;
  const ux = u * Math.cos(th);
  const uy = u * Math.sin(th);
  const hasB = companion === "drop" || companion === "fast";
  const uxB = companion === "fast" ? 2 * ux : 0;
  const uyB = companion === "fast" ? uy : 0;
  const H = uy > 0 ? h + (uy * uy) / (2 * g) : h;   // 規格公式；θ < 0 時 = h

  const mk = (ux0, uy0) => ({ ux: ux0, uy: uy0, x: 0, y: h, vx: ux0, vy: uy0, landed: false, tLand: null });
  const balls = [mk(ux, uy)];
  if (hasB) balls.push(mk(uxB, uyB));

  let step = 0;
  let t = 0;
  let frozen = false;

  // 起始即在地面：y ≤ 0 且沒有向上初速
  for (const b of balls) {
    if (b.y <= 0 && b.uy <= 0) { b.y = 0; b.vx = 0; b.vy = 0; b.landed = true; b.tLand = 0; }
  }
  const checkFrozen = () => {
    if (balls.every((b) => b.landed)) {
      frozen = true;
      t = Math.max(...balls.map((b) => b.tLand));
    }
  };
  checkFrozen();

  function advance(b, tStart, tEnd) {
    if (b.landed) return;
    let tl = null;
    if (c === 0) {
      const tlAll = landTimeNoDrag(b.uy, h, g);
      if (tEnd >= tlAll) tl = tlAll;
    } else {
      const s = closedForm(b.ux, b.uy, h, g, c, tEnd);
      if (s.y <= 0) tl = bisectLand(b.ux, b.uy, h, g, c, tStart, tEnd);
    }
    if (tl !== null) {
      const s = closedForm(b.ux, b.uy, h, g, c, tl);
      Object.assign(b, s, { y: 0, landed: true, tLand: tl });
    } else {
      Object.assign(b, closedForm(b.ux, b.uy, h, g, c, tEnd), { landed: false, tLand: null });
    }
  }

  function stepOnce() {
    if (frozen) return;
    const tStart = step * dt;
    step += 1;
    const tEnd = step * dt;
    for (const b of balls) advance(b, tStart, tEnd);
    t = tEnd;
    checkFrozen();
  }

  function observe() {
    const A = balls[0];
    const [ax, ay] = A.landed ? [0, 0] : accelOf(A.vx, A.vy, g, c);
    const v = Math.hypot(A.vx, A.vy);
    const obs = { t, tf: t, x: A.x, y: A.y, vx: A.vx, vy: A.vy, v, ax, ay, Ek: 0.5 * m * v * v, H };
    if (hasB) {
      const B = balls[1];
      obs.xB = B.x; obs.yB = B.y;
      obs.EkB = 0.5 * m * (B.vx * B.vx + B.vy * B.vy);
    }
    return obs;
  }

  return { stepOnce, observe, get t() { return t; } };
}

export function runFrames(params, dt, frames) {
  const sim = createSim(params, dt);
  const out = [];
  for (let i = 0; i < frames; i++) {
    if (i > 0) sim.stepOnce();
    out.push({ t: sim.t, obs: sim.observe() });
  }
  return out;
}

// 供 checks.mjs 直接取閉式解（不經幀迴圈）
export function analytic(params, t) {
  const m = params.m ?? 1;
  const c = params.air ? (params.k ?? K_AIR) / m : 0;
  const th = (params.theta * Math.PI) / 180;
  return closedForm(params.u * Math.cos(th), params.u * Math.sin(th), params.h, params.g, c, t);
}
