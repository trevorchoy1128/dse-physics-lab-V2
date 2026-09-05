// 第二實作（第 7 輪，獨立、純 JavaScript）：模擬器 7 運動線圖與真實運動同步
//
// 規格方程：v = u + a t，s = u t + ½ a t²，v² = u² + 2 a s；s = ∫ v dt（v–t 線下面積），a = Δv/Δt（斜率）。
//
// 積分方法：閉式逐段積分（非數值步進）。兩種模式的 v(t) 都是分段線性折線：
//   live：單一段，v(t) = u + a t，t ∈ [0, ∞)
//   draw：節點 vt[i] 位於 t = i 秒，段內線性；t ≥ 最後節點後 v 保持末節點值（斜率 0）
// 把兩種模式統一成「折線段列表」後，每段的位移為精確二次式 v0 τ + ½ m τ²；
// 路程在段內 v 變號處（最多一處）分割，取兩半絕對值之和。
// 步長 dt 只決定輸出幀時刻：t_k = min(k·dt, T)，k 用整數除法（k / (1/dt)）避免累加漂移。
//
// 規格未寫明、本實作採用的慣例（列入報告「規格待釐清」）：
//   C1 時間窗：t ≥ T 後模型凍結於 t = T，各讀數不再變化；a 讀數保持 T⁻（凍結前最後一段）的斜率。
//   C2 draw 模式節點處 a 取右段斜率（右連續）；T 落在節點上時凍結 a 取左段斜率。
//   C3 avgSpeed = dist / t，avgVel = s / t；t = 0 時定義為 0。
//   C4 area（線下面積）= s（含號）；speed = |v|。
//   C5 顯示層歸零：主實作把 |x| < 1e-9 的 s、dist、v、area、avgSpeed、avgVel 歸零；本實作 observe 輸出純解析值，
//      另提供 snapZero() 供比對時套用同一規則（speed 取 |v_snapped| 以維持 speed = |v|）。

// 把參數轉成折線段列表：每段 { t0, v0, m, len }（len 可為 Infinity）
function segmentsOf(p) {
  if (p.mode === "draw") {
    const vt = p.vt;
    const segs = [];
    for (let i = 0; i + 1 < vt.length; i++) segs.push({ t0: i, v0: vt[i], m: vt[i + 1] - vt[i], len: 1 });
    const last = vt.length - 1;
    segs.push({ t0: last, v0: vt[last], m: 0, len: Infinity });
    return segs;
  }
  return [{ t0: 0, v0: p.u, m: p.a, len: Infinity }];
}

// 一段內走 τ 的位移與路程
function walk(v0, m, tau) {
  const ds = v0 * tau + 0.5 * m * tau * tau;
  let dd = Math.abs(ds);
  if (m !== 0) {
    const tz = -v0 / m;                       // v = 0 的時刻（相對段起點）
    if (tz > 0 && tz < tau) {
      const sz = v0 * tz + 0.5 * m * tz * tz; // 到變號點的位移
      dd = Math.abs(sz) + Math.abs(ds - sz);
    }
  }
  return { ds, dd };
}

// 在 t 時刻的解析狀態：s、dist、v、a（a 為右連續斜率）
function stateAt(p, t) {
  const segs = segmentsOf(p);
  let s = 0, dist = 0, v = segs[0].v0, a = segs[0].m;
  for (const seg of segs) {
    if (t < seg.t0) break;
    const tau = Math.min(t - seg.t0, seg.len);
    const r = walk(seg.v0, seg.m, tau);
    s += r.ds; dist += r.dd;
    if (t - seg.t0 < seg.len) {               // t 落在此段內（含起點）
      v = seg.v0 + seg.m * tau; a = seg.m; break;
    }
  }
  return { s, dist, v, a };
}

// 凍結時的 a：包含 T⁻ 的段的斜率
function slopeLeftOf(p, T) {
  const segs = segmentsOf(p);
  let a = segs[0].m;
  for (const seg of segs) { if (seg.t0 < T) a = seg.m; else break; }
  return a;
}

export function observe(p, tRaw) {
  const frozen = tRaw >= p.T;
  const t = frozen ? p.T : tRaw;
  const st = stateAt(p, t);
  const a = frozen ? slopeLeftOf(p, p.T) : st.a;
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
