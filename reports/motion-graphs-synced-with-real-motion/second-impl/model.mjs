// 第二實作（獨立，純 JavaScript）：模擬器 7 運動線圖與真實運動同步
// 規格方程：v = u + a t, s = u t + ½ a t², s = ∫ v dt（線下面積），a = Δv/Δt（斜率）
//
// 積分方法：解析逐段積分。兩種模式下 v(t) 都是分段線性，故每段 s 為精確二次式，
// 不需數值積分；路程 dist 在段內找 v = 0 的交叉點（最多一個）分割後取絕對值相加。
// 步長 dt 只用來決定輸出幀的時刻 t_k = k / (1/dt)（用整數除法避免累加誤差）。
//
// 慣例（規格未寫明，見報告「規格待釐清」）：
//  - t ≥ T 後運動停止，狀態凍結於 t = T，a 讀數為 0。
//  - draw 模式 vt[i] 為 t = i 秒的節點值，段內線性插值，超出末節點後 v 保持最後值、a = 0。
//  - avgSpeed = dist / t，avgVel = s / t；t = 0 時兩者為 0。
//  - area（v–t 線下面積）= s（含號）。speed = |v|。

// 在一段上：v(τ) = v0 + m τ，回傳 τ 內的位移增量與路程增量
function segmentIntegrals(v0, m, tau) {
  const s = v0 * tau + 0.5 * m * tau * tau;
  let dist;
  if (m !== 0) {
    const tStar = -v0 / m; // v = 0 的時刻
    if (tStar > 0 && tStar < tau) {
      const sStar = v0 * tStar + 0.5 * m * tStar * tStar;
      dist = Math.abs(sStar) + Math.abs(s - sStar);
    } else {
      dist = Math.abs(s);
    }
  } else {
    dist = Math.abs(s);
  }
  return { s, dist };
}

// live 模式：恆定加速度
function liveState(p, t) {
  const { u, a } = p;
  const v = u + a * t;
  const { s, dist } = segmentIntegrals(u, a, t);
  return { s, dist, v, a };
}

// draw 模式：vt 折線
function drawState(p, t) {
  const vt = p.vt;
  const n = vt.length;
  let s = 0, dist = 0;
  let v = vt[0], a = 0;
  if (n === 1) {
    // 單一節點：v 恆定
    const r = segmentIntegrals(vt[0], 0, t);
    return { s: r.s, dist: r.dist, v: vt[0], a: 0 };
  }
  // 完整走過的段
  const iFull = Math.min(Math.floor(t), n - 1);
  for (let i = 0; i < iFull; i++) {
    const m = vt[i + 1] - vt[i];
    const r = segmentIntegrals(vt[i], m, 1);
    s += r.s; dist += r.dist;
  }
  if (iFull < n - 1) {
    // 位於段 iFull 內
    const m = vt[iFull + 1] - vt[iFull];
    const tau = t - iFull;
    const r = segmentIntegrals(vt[iFull], m, tau);
    s += r.s; dist += r.dist;
    v = vt[iFull] + m * tau;
    a = m;
  } else {
    // 超出末節點：v 保持最後值
    const tau = t - (n - 1);
    const r = segmentIntegrals(vt[n - 1], 0, tau);
    s += r.s; dist += r.dist;
    v = vt[n - 1];
    a = 0;
  }
  return { s, dist, v, a };
}

export function observe(p, tRaw) {
  const stopped = tRaw >= p.T;
  const t = stopped ? p.T : tRaw;
  const st = p.mode === "draw" ? drawState(p, t) : liveState(p, t);
  const a = stopped ? 0 : st.a;
  return {
    t,
    obs: {
      s: st.s,
      dist: st.dist,
      v: st.v,
      a,
      speed: Math.abs(st.v),
      area: st.s,
      avgSpeed: t > 0 ? st.dist / t : 0,
      avgVel: t > 0 ? st.s / t : 0,
    },
  };
}

export function simulate(p, dt, frames) {
  const perSec = Math.round(1 / dt);
  const out = [];
  for (let k = 0; k < frames; k++) {
    const t = k / perSec;
    out.push(observe(p, t));
  }
  return out;
}
