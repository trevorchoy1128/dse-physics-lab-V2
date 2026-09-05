// 第二實作（第 9 輪，獨立、純 JavaScript）：模擬器 7 運動線圖與真實運動同步 — 對應主實作 0.6.0
//
// 規格方程：v = u + a t，s = u t + ½ a t²，v² = u² + 2 a s；s = ∫ v dt（v–t 線下面積），a = Δv/Δt（斜率）。
//
// 積分方法：閉式逐段積分（非數值步進）。兩種模式的 v(t) 都是分段線性折線，每段位移為精確二次式，
// 路程在段內 v 變號點分割後取兩半絕對值之和。步長 dt 只決定輸出幀時刻 t_k = min(k / (1/dt), T)（整數格點，不累加）。
//
// 0.6.0 規則（開發端定，規格以外）：
//   draw 模式固定 11 個控制點 vt[0..10]，間距 nodeDt = max(1, T / 10)；第 k 點在 t = k·nodeDt。
//   段內 v 線性插值，a = Δv / nodeDt；T ≤ 10 時 t 超過第 10 點後 v 保持 vt[10]、a = 0。
//   節點處 a 取右段；凍結幀（t = T）a 取 T⁻ 所在段（左段）。
//   本實作以歸一化時間 τ = t / nodeDt 定位段（節點在整數 τ），與「在 t 軸上找節點」的寫法刻意不同：
//   段 i = ⌊τ⌋（τ ≥ 10 為尾段），段內位移 = nodeDt · (v0 f + ½ Δv f²)，f = τ − i。
//   |τ − round(τ)| < 1e-9 時把 τ 貼到整數（節點判定的 ulp 保護，見報告「規格待釐清」7）。
//   live 模式：單一段 v = u + a t，t ∈ [0, ∞)。
//
// 其他慣例（沿用前幾輪、列入報告「規格待釐清」）：
//   C1 t ≥ T 後凍結於 t = T，各讀數不變。
//   C3 avgSpeed = dist / t，avgVel = s / t；t = 0 時定義為 0。
//   C4 area = s（含號）；speed = |v|。
//   C5 歸零：|x| < 1e-9 → 0（s、dist、v、area、avgSpeed、avgVel；a 不歸零）。本檔 observe 輸出純解析值，
//      snapZero() 供比對時套用同一規則。

export function nodeDtOf(T) { return Math.max(1, T / 10); }

// 一段：起速 v0、末速 v1、段長 L（秒），走到段內比例 f ∈ [0, 1]（或 f 為絕對秒數時 L = 1、v1 = v0 + m）
// 回傳位移與路程；路程在 v 變號點 f* = v0 / (v0 − v1) 分割
function segWalk(v0, v1, L, f) {
  const dv = v1 - v0;
  const ds = L * (v0 * f + 0.5 * dv * f * f);
  let dd = Math.abs(ds);
  if (dv !== 0) {
    const fz = -v0 / dv;
    if (fz > 0 && fz < f) {
      const sz = L * (v0 * fz + 0.5 * dv * fz * fz);
      dd = Math.abs(sz) + Math.abs(ds - sz);
    }
  }
  return { ds, dd };
}

function drawState(p, t) {
  const vt = p.vt, N = vt.length - 1;           // N = 10
  const h = nodeDtOf(p.T);
  let tau = t / h;
  // 節點判定的 ulp 保護：t 與 k·nodeDt 相差 < 1e-9·nodeDt 時視為在節點上（k·nodeDt 與 t 的浮點乘除可差 1 ulp）
  const tauR = Math.round(tau); if (Math.abs(tau - tauR) < 1e-9) tau = tauR;
  let s = 0, dist = 0;
  const iCur = Math.min(N, Math.floor(tau));   // 所在段（N 表示尾段）
  for (let i = 0; i < iCur; i++) {              // 完整走完的段
    const r = segWalk(vt[i], vt[i + 1], h, 1); s += r.ds; dist += r.dd;
  }
  let v, a;
  if (iCur < N) {
    const f = tau - iCur;
    const r = segWalk(vt[iCur], vt[iCur + 1], h, f); s += r.ds; dist += r.dd;
    v = vt[iCur] + (vt[iCur + 1] - vt[iCur]) * f;
    a = (vt[iCur + 1] - vt[iCur]) / h;
  } else {                                      // 尾段：v 保持 vt[N]，a = 0
    const dtTail = t - N * h;
    s += vt[N] * dtTail; dist += Math.abs(vt[N] * dtTail);
    v = vt[N]; a = 0;
  }
  return { s, dist, v, a };
}

// 凍結幀 a：T⁻ 所在段的斜率
function drawSlopeLeftOf(p, T) {
  const vt = p.vt, N = vt.length - 1, h = nodeDtOf(T);
  const i = Math.min(N - 1, Math.max(0, Math.ceil(T / h) - 1));
  if (T / h > N) return 0;                      // T 已在尾段內（T ≤ 10 時不會發生：T/h = T ≤ 10）
  return (vt[i + 1] - vt[i]) / h;
}

function liveState(p, t) {
  const { u, a } = p;
  const s = u * t + 0.5 * a * t * t;
  let dist = Math.abs(s);
  if (a !== 0) {
    const tz = -u / a;
    if (tz > 0 && tz < t) { const sz = u * tz + 0.5 * a * tz * tz; dist = Math.abs(sz) + Math.abs(s - sz); }
  }
  return { s, dist, v: u + a * t, a };
}

export function observe(p, tRaw) {
  const frozen = tRaw >= p.T;
  const t = frozen ? p.T : tRaw;
  const st = p.mode === "draw" ? drawState(p, t) : liveState(p, t);
  const a = frozen && p.mode === "draw" ? drawSlopeLeftOf(p, p.T) : st.a;
  return {
    t,
    obs: {
      s: st.s, dist: st.dist, v: st.v, a,
      speed: Math.abs(st.v), area: st.s,
      avgSpeed: t > 0 ? st.dist / t : 0,
      avgVel: t > 0 ? st.s / t : 0,
    },
  };
}

export const SNAP_EPS = 1e-9;
export const SNAP_KEYS = ["s", "dist", "v", "area", "avgSpeed", "avgVel"];
export function snapZero(obs) {
  const o = { ...obs };
  for (const k of SNAP_KEYS) if (Math.abs(o[k]) < SNAP_EPS) o[k] = 0;
  o.speed = Math.abs(o.v);
  return o;
}

export function simulate(p, dt, frames) {
  const perSec = Math.round(1 / dt);
  const out = new Array(frames);
  for (let k = 0; k < frames; k++) out[k] = observe(p, k / perSec);
  return out;
}
