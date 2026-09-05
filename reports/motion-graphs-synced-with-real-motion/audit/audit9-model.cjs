// 第 9 輪獨立模型（不讀 model.ts / plan.ts / Scene.tsx / *.test.ts）。由 audit9.cjs 與 boundary-check9.cjs 共用。
// v(t) 表示為折線段列表 {t0, v0, m, len}。live：一段 v = u + a t。
// draw（0.6.0 規則）：nodeDt = max(1, T/10)；第 k 點在 t = k·nodeDt（k = 0…10）；段內線性，a = Δv / nodeDt；第 10 點以後 v 保持 vt[10]、a = 0。
function nodeDt(p) { return Math.max(1, p.T / 10); }
function segments(p) {
  if (p.mode !== "draw") return [{ t0: 0, v0: p.u, m: p.a, len: Infinity }];
  const vt = p.vt, n = vt.length - 1, h = nodeDt(p), segs = [];
  for (let k = 0; k < n; k++) segs.push({ t0: k * h, v0: vt[k], m: (vt[k + 1] - vt[k]) / h, len: h });
  segs.push({ t0: n * h, v0: vt[n], m: 0, len: Infinity });
  return segs;
}
function segS(g, tau) { return g.v0 * tau + 0.5 * g.m * tau * tau; }
function segD(g, tau) { if (tau <= 0) return 0; if (g.m !== 0) { const tz = -g.v0 / g.m; if (tz > 0 && tz < tau) return Math.abs(segS(g, tz)) + Math.abs(segS(g, tau) - segS(g, tz)); } return Math.abs(segS(g, tau)); }
function segIndexRight(segs, t) { let k = 0; while (k + 1 < segs.length && t >= segs[k + 1].t0) k++; return k; } // t 在節點取右段
function segIndexLeft(segs, t) { let k = 0; while (k + 1 < segs.length && t > segs[k + 1].t0) k++; return k; }   // t 在節點取左段（T 的左極限）
function state(p, t, side) {
  const segs = segments(p); let s = 0, d = 0;
  for (let k = 0; k < segs.length; k++) { const g = segs[k]; if (t <= g.t0) break; const tau = Math.min(t, g.t0 + g.len) - g.t0; s += segS(g, tau); d += segD(g, tau); if (t <= g.t0 + g.len) break; }
  const g = segs[(side === "left" ? segIndexLeft : segIndexRight)(segs, t)];
  return { s, dist: d, v: g.v0 + g.m * (t - g.t0), a: g.m };
}
function expect(p, t, side) { const m = state(p, t, side); return { ...m, speed: Math.abs(m.v), area: m.s, avgSpeed: t > 0 ? m.dist / t : 0, avgVel: t > 0 ? m.s / t : 0 }; }
// 是否節點幀（t 距 k·nodeDt < 1e-9，1 ≤ k ≤ 10）
function nodeInfo(p, t) { if (p.mode !== "draw") return null; const h = nodeDt(p); const k = Math.round(t / h); if (k >= 1 && k <= 10 && Math.abs(t - k * h) < 1e-9) { const vt = p.vt; return { k, tNode: k * h, left: (vt[k] - vt[k - 1]) / h, right: k < 10 ? (vt[k + 1] - vt[k]) / h : 0 }; } return null; }
// [0, T] 內 |s|、|v|、|a| 的準確極值（候選：0、T、段界、段內 v = 0）
function exactExtrema(p, T) {
  const segs = segments(p); const cand = new Set([0, T]);
  for (const g of segs) { if (g.t0 > 0 && g.t0 < T) cand.add(g.t0); if (g.m !== 0) { const tz = g.t0 - g.v0 / g.m; if (tz > g.t0 && tz < g.t0 + g.len && tz > 0 && tz < T) cand.add(tz); } }
  let sMax = 0, sAt = 0, vMax = 0, vAt = 0, aMax = 0;
  for (const t of cand) { const st = state(p, t, "left"); if (Math.abs(st.s) > sMax) { sMax = Math.abs(st.s); sAt = t; } if (Math.abs(st.v) > vMax) { vMax = Math.abs(st.v); vAt = t; } }
  for (const g of segs) if (g.t0 < T) aMax = Math.max(aMax, Math.abs(g.m));
  return { sMax, sAt, vMax, vAt, aMax, candidates: [...cand].sort((a, b) => a - b) };
}
// draw：max|Δv| / nodeDt（只計 T 以內開始的段）
function drawAmax(p) { const h = nodeDt(p); let m = 0; for (let k = 0; k < 10; k++) if (k * h < p.T) m = Math.max(m, Math.abs(p.vt[k + 1] - p.vt[k]) / h); return m; }
// 預期控制點：第 k 點 t = k·nodeDt，數目 = min(11, floor(T/nodeDt) + 1)
function expectHandles(p) { const h = nodeDt(p); const n = Math.min(11, Math.floor(p.T / h + 1e-9) + 1); const pts = []; for (let k = 0; k < n; k++) pts.push([k * h, p.vt[k], 0]); return pts; }
// 解析反向時刻：v 的非零符號第一次改變的時刻（段內過零取 tz；恰在節點過零取節點時刻）
function firstReversal(p, T) {
  let sign = 0;
  for (const g of segments(p)) {
    if (g.t0 >= T) break;
    const end = Math.min(g.len, T - g.t0); const vEnd = g.v0 + g.m * end;
    const s0 = Math.sign(g.v0), s1 = Math.sign(vEnd);
    if (s0 !== 0 && sign !== 0 && s0 !== sign) return g.t0;
    if (s0 !== 0) sign = s0;
    if (g.m !== 0 && s0 !== 0 && s1 === -s0) return g.t0 - g.v0 / g.m;
    if (s0 === 0 && sign !== 0 && s1 === -sign) return g.t0;
    if (s1 !== 0) sign = s1;
  }
  return null;
}
module.exports = { nodeDt, segments, state, expect, nodeInfo, exactExtrema, drawAmax, expectHandles, firstReversal };
