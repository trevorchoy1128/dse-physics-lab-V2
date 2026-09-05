import type { PlanFn, Vec3, ArrowPlan } from "@/shell/types";
import { nodeDt, type S, type P } from "./model";

// 畫面的物理（純函數）。2D 場景：軌道上的小車 + 三張線圖，線圖以 trails 傳遞（點 = [t, y, 0]），
// 軸範圍與旗標放 meta（非物理判斷）。

/** s–t 圖軸範圍（正負對稱）：時間窗內 |s| 的最大值取整到好看的刻度；重置時定好，播放期間不變 */
export function trackExtent(p: P): number {
  let smax: number;
  if (p.mode === "draw") {
    // 折線逐段（每段 1 s）精確積分，段內 v 變號處也取值；控制點以外（t > n）v 保持末值，這段位移必須計入（核數員第 7 輪 F9）
    const n = p.vt.length - 1, dN = nodeDt(p); let acc = 0; smax = 0;
    for (let k = 0; k < n; k++) {
      const dur = Math.min(dN, p.T - k * dN); if (dur <= 0) break;
      const v0 = p.vt[k], v1 = v0 + (p.vt[k + 1] - v0) * (dur / dN);
      if (v0 * v1 < 0) { const f = v0 / (v0 - v1); smax = Math.max(smax, Math.abs(acc + 0.5 * v0 * f * dur)); }
      acc += 0.5 * (v0 + v1) * dur; smax = Math.max(smax, Math.abs(acc));
    }
    if (p.T > n * dN) smax = Math.max(smax, Math.abs(acc + p.vt[n] * (p.T - n * dN)));
  }
  else {
    // |s| 在時間窗內的準確最大值：s = ut + ½at² 是二次式，極值只會在端點或頂點 t* = −u/a
    const sAt = (t: number) => Math.abs(p.u * t + 0.5 * p.a * t * t);
    const tStar = p.a !== 0 ? -p.u / p.a : -1;
    smax = Math.max(sAt(p.T), tStar > 0 && tStar < p.T ? sAt(tStar) : 0);
  }
  smax = Math.max(5, smax);
  const steps = [5, 10, 20, 50, 100, 200, 500, 1000];
  return steps.find(x => x >= smax) ?? Math.ceil(smax / 1000) * 1000;
}

export const plan: PlanFn<S, P> = (s, p, obs, layers) => {
  // 位置、標籤、箭嘴一律用 observe() 歸零後的值，畫面與讀數面板一致（核數員 F6）
  const pos: Vec3 = [obs.s, 0, 0];
  const arrows: ArrowPlan[] = [];
  if (layers.velocity) arrows.push({ kind: "velocity", origin: [obs.s, 0.45, 0], vector: [obs.v, 0, 0], label: "v", layer: "velocity" });
  if (layers.acceleration) arrows.push({ kind: "acceleration", origin: [obs.s, 0.75, 0], vector: [obs.a, 0, 0], label: "a", layer: "acceleration" });
  const vmax = p.mode === "draw" ? Math.max(1, ...p.vt.map(Math.abs)) : Math.max(1, Math.abs(p.u), Math.abs(p.u + p.a * p.T));
  const amax = p.mode === "draw" ? Math.max(1, ...p.vt.slice(1).map((v, k) => Math.abs(v - p.vt[k]) / nodeDt(p))) : Math.max(1, Math.abs(p.a));
  const smaxGraph = Math.max(1, ...s.hist.map(h => Math.abs(h.s)), Math.abs(s.s));
  // 至今出現過的最大 |v|、|a|：畫面軸範圍只按實際數據放大，不因滑桿改動而跳動（學生試用者第 3 輪）
  const vSeen = Math.max(1, ...s.hist.map(h => Math.abs(h.v)), Math.abs(s.v));
  const aSeen = Math.max(1, ...s.hist.map(h => Math.abs(h.a)), Math.abs(obs.a));
  return {
    bodies: [{ key: "trolley", shape: "box", position: pos, size: [0.6, 0.3, 0.3], color: "#1c2530" }],
    arrows,
    labels: [{ position: [obs.s, -0.5, 0], symbol: "s", value: obs.s, unit: "m" }],
    trails: [
      { key: "s-t", points: s.hist.map(h => [h.t, h.s, 0] as Vec3) },
      { key: "v-t", points: s.hist.map(h => [h.t, h.v, 0] as Vec3) },
      { key: "a-t", points: s.hist.map(h => [h.t, h.a, 0] as Vec3) },
      // 控制點：第 k 點在 t = k·nodeDt；只列時間窗內的點（T ≤ 10 s 時為 T + 1 個，否則 11 個橫跨 0 至 T）
      ...(p.mode === "draw" ? [{ key: "vt-handles", points: Array.from({ length: Math.min(p.vt.length, Math.floor(p.T / nodeDt(p) + 1e-9) + 1) }, (_, k) => [k * nodeDt(p), p.vt[k], 0] as Vec3) }] : []),
    ],
    scales: { velocity: 0.25, acceleration: 0.25 },
    meta: {
      t: s.t, T: p.T, s: obs.s, v: obs.v, a: obs.a,   // 與讀數面板同一來源（圖內斜率標籤曾顯示 2 × 10⁻¹⁵）
      smax: trackExtent(p), sGraph: smaxGraph, vmax, amax, vSeen, aSeen,
      draw: p.mode === "draw" ? 1 : 0,
      tangent: layers.tangent ? 1 : 0, area: layers.area ? 1 : 0,
      done: s.done ? 1 : 0,
    },
  };
};
