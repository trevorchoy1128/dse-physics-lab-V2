// 補充核數：對稱（內插）、兩球同高、最高點讀數、負角 H、空氣阻力落地時刻 vs 時間軸長度
import { readFileSync } from "node:fs";
const DEG = Math.PI / 180, K = 0.01;
const load = (dir, n) => JSON.parse(readFileSync(`${dir}/${n}.json`, "utf8"));
const interp = (fr, t, key) => { const i = Math.floor(t / 0.001); if (i + 1 >= fr.length) return fr[fr.length - 1].obs[key]; const a = fr[i].obs, b = fr[i + 1].obs; const s = (t - a.t) / (b.t - a.t); return a[key] + s * (b[key] - a[key]); };
console.log("== 驗證條件 1：對稱（h=0、無阻力）——y(t_up−τ) 與 y(t_up+τ) 線性內插比較，t_up = uy/g ==");
for (const n of ["default", "scenario-top-not-zero", "scenario-no-forward-force", "scenario-a-at-top", "scenario-range-45"]) {
  const d = load("../data", n), fr = d.frames, p = d.params; const uy = p.u * Math.sin(p.theta * DEG), tUp = uy / p.g, tf = 2 * uy / p.g;
  let m = 0; for (let tau = 0; tau <= tUp; tau += 0.001) m = Math.max(m, Math.abs(interp(fr, tUp - tau, "y") - interp(fr, tUp + tau, "y")));
  // 由數據找 vy 過零
  let iz = fr.findIndex((f, i) => i > 0 && fr[i - 1].obs.vy > 0 && f.obs.vy <= 0); const a = fr[iz - 1].obs, b = fr[iz].obs; const tUpData = a.t + (b.t - a.t) * a.vy / (a.vy - b.vy);
  const last = fr[fr.length - 1].obs;
  console.log(`${n}: t_up(數據)=${tUpData.toFixed(12)} t_up(解析)=${tUp.toFixed(12)} t_down=tf−t_up=${(last.tf - tUpData).toFixed(12)} |t_up−t_down|=${Math.abs(last.tf - 2 * tUpData).toExponential(2)} max|y(t_up−τ)−y(t_up+τ)|=${m.toExponential(2)} 落地速率=${last.v} u=${p.u} |v−u|=${Math.abs(last.v - p.u).toExponential(2)}`);
}
console.log("\n== 驗證條件 2：射程（u=15, h=0, 無阻力）==");
const R = {}; for (const th of [15, 30, 45, 60, 75]) { const d = load("extra-data", `angle-${th}`); const last = d.frames[d.frames.length - 1].obs; R[th] = last.x; console.log(`θ=${th}°: 落點 x=${last.x} 規格 R=u²sin2θ/g=${225 * Math.sin(2 * th * DEG) / 9.81} 差=${Math.abs(last.x - 225 * Math.sin(2 * th * DEG) / 9.81).toExponential(2)} tf=${last.tf}`); }
{ const d = load("../data", "scenario-range-45"); const last = d.frames[d.frames.length - 1].obs; R[70] = last.x; console.log(`θ=70°: 落點 x=${last.x} 規格 R=${225 * Math.sin(140 * DEG) / 9.81}`); }
console.log(`R45 最大? ${Object.entries(R).every(([k, v]) => +k === 45 || v < R[45])} | |R15−R75|=${Math.abs(R[15] - R[75]).toExponential(2)} | |R30−R60|=${Math.abs(R[30] - R[60]).toExponential(2)}`);
console.log("\n== 現象 1：兩球同高（y 對 yB）與同時落地 ==");
for (const [dir, n] of [["../data", "scenario-same-landing"], ["../data", "default"], ["extra-data", "drop-h20-theta0"]]) {
  const d = load(dir, n), fr = d.frames; let m = 0, mB = 0; for (const f of fr) { m = Math.max(m, Math.abs(f.obs.y - f.obs.yB)); }
  const iA = fr.findIndex((f) => f.meta.landedA), iB = fr.findIndex((f) => f.meta.landedB);
  console.log(`${n} (companion=${d.params.companion}, θ=${d.params.theta}, h=${d.params.h}): max|y−yB|=${m.toExponential(2)} 落地幀 A=${iA} B=${iB} 落地 xA=${fr[fr.length - 1].obs.x} xB=${fr[fr.length - 1].obs.xB}`);
}
console.log("\n== 最高點讀數（迷思：最高點速度為零／加速度為零）==");
for (const n of ["scenario-top-not-zero", "scenario-a-at-top"]) {
  const d = load("../data", n), fr = d.frames; let best = fr[0]; for (const f of fr) if (Math.abs(f.obs.vy) < Math.abs(best.obs.vy)) best = f;
  const acc = best.arrows.find((a) => a.layer === "acceleration"), vel = best.arrows.find((a) => a.layer === "velocity");
  console.log(`${n}: t=${best.obs.t.toFixed(3)} vy=${best.obs.vy.toExponential(2)} vx=${best.obs.vx} v=${best.obs.v} Ek=${best.obs.Ek} ½vx²=${0.5 * best.obs.vx ** 2} y=${best.obs.y} H=${best.obs.H} ax,ay=${best.obs.ax},${best.obs.ay} 加速度箭嘴=${JSON.stringify(acc.vector)} 速度箭嘴=${JSON.stringify(vel.vector)} meta.EkMin=${best.meta.EkMin}`);
}
console.log("\n== 負投射角的 H 讀數 vs 規格公式 ==");
for (const [dir, n] of [["../data", "random-3"], ["extra-data", "edge-theta-30-h0"], ["extra-data", "edge-u50-theta-30-h50-air"]]) {
  const d = load(dir, n), p = d.params, o = d.frames[0].obs; const spec = p.h + p.u ** 2 * Math.sin(p.theta * DEG) ** 2 / (2 * p.g);
  let ymax = -Infinity; for (const f of d.frames) ymax = Math.max(ymax, f.obs.y);
  console.log(`${n}: θ=${p.theta} h=${p.h} obs.H=${o.H} 規格公式=${spec} 數據實際最高 y=${ymax}`);
}
console.log("\n== θ≤0 且 h=0 的邊界：首幀讀數 ==");
for (const n of ["edge-theta-30-h0", "edge-u1-theta0-h0"]) { const d = load("extra-data", n); const o = d.frames[0].obs, m = d.frames[0].meta; console.log(`${n}: obs=${JSON.stringify(o)} landedA=${m.landedA} arrows=${d.frames[0].arrows.length} meta.tf=${m.tf}`); }
console.log("\n== 空氣阻力運行：我的 RK4 落地時刻 vs meta.tf（時間軸長度）與無阻力 tf ==");
function rk4Land(p) { const th = p.theta * DEG; let s = { x: 0, y: p.h, vx: p.u * Math.cos(th), vy: p.u * Math.sin(th) }; const g = p.g; const f = (q) => { const v = Math.hypot(q.vx, q.vy); return [q.vx, q.vy, -K * v * q.vx, -g - K * v * q.vy]; }; const add = (q, k, c) => ({ x: q.x + c * k[0], y: q.y + c * k[1], vx: q.vx + c * k[2], vy: q.vy + c * k[3] }); const h = 1e-4; let t = 0, ymax = s.y; while (t < 200) { const k1 = f(s), k2 = f(add(s, k1, h / 2)), k3 = f(add(s, k2, h / 2)), k4 = f(add(s, k3, h)); const n = { x: s.x + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y: s.y + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]), vx: s.vx + h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]), vy: s.vy + h / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]) }; if (n.y <= 0) { return { tf: t + h * s.y / (s.y - n.y), ymax }; } s = n; t += h; ymax = Math.max(ymax, s.y); } return { tf: Infinity, ymax }; }
for (const [dir, n] of [["../data", "random-0"], ["../data", "random-1"], ["../data", "random-2"], ["extra-data", "edge-u50-theta45-h50-g10-air"], ["extra-data", "edge-u50-theta-30-h50-air"]]) {
  const d = load(dir, n), p = d.params; const uy = p.u * Math.sin(p.theta * DEG); const tfNo = (uy + Math.sqrt(uy * uy + 2 * p.g * p.h)) / p.g; const r = rk4Land(p); const metaTf = d.frames[0].meta.tf;
  console.log(`${n}: 阻力落地 tf(RK4)=${r.tf.toFixed(4)} 無阻力 tf=${tfNo.toFixed(4)} meta.tf=${metaTf.toFixed(4)} (meta.tf−0.3)/tf無阻力=${((metaTf - 0.3) / tfNo).toFixed(4)} 時間軸涵蓋落地? ${r.tf <= metaTf} 最高 y=${r.ymax.toFixed(2)}`);
}
console.log("\n== 落地後讀數（凍結約定）==");
{ const d = load("../data", "default"); const o = d.frames[3999].obs; console.log(`default 最後幀: ${JSON.stringify(o)}`); }
console.log("\n== 頻閃間距（default，每 0.1 s）==");
{ const d = load("../data", "default"); const fr = d.frames; const pts = []; for (let i = 0; i < 1966; i += 100) pts.push(fr[i].obs); const dx = pts.slice(1).map((p, i) => p.x - pts[i].x), dy = pts.slice(1).map((p, i) => p.y - pts[i].y); console.log("Δx:", dx.map((v) => v.toFixed(6)).join(" ")); console.log("Δy:", dy.map((v) => v.toFixed(4)).join(" ")); }
