// 第 2 輪補充核數：對稱（內插）、射程、兩球同高、最高點讀數、負角 H、阻力落地時刻、done/時鐘、頻閃間距、縮放規則
import { readFileSync } from "node:fs";
const DEG = Math.PI / 180, K = 0.01;
const load = (dir, n) => JSON.parse(readFileSync(`${dir}/${n}.json`, "utf8"));
const interp = (fr, t, key) => { const i = Math.floor(t / 0.001); if (i + 1 >= fr.length) return fr[fr.length - 1].obs[key]; const a = fr[i].obs, b = fr[i + 1].obs; if (b.t === a.t) return a[key]; const s = (t - a.t) / (b.t - a.t); return a[key] + s * (b[key] - a[key]); };
console.log("== 驗證條件 1：對稱（h=0、無阻力）——y(t_up−τ) 與 y(t_up+τ) 線性內插比較，t_up = uy/g ==");
for (const n of ["default", "scenario-top-not-zero", "scenario-no-forward-force", "scenario-a-at-top", "scenario-range-45"]) {
  const d = load("../data", n), fr = d.frames, p = d.params; const uy = p.u * Math.sin(p.theta * DEG), tUp = uy / p.g;
  let m = 0; for (let tau = 0; tau <= tUp; tau += 0.001) m = Math.max(m, Math.abs(interp(fr, tUp - tau, "y") - interp(fr, tUp + tau, "y")));
  let mv = 0; for (let tau = 0; tau <= tUp; tau += 0.001) mv = Math.max(mv, Math.abs(interp(fr, tUp - tau, "vy") + interp(fr, tUp + tau, "vy")));
  const iz = fr.findIndex((f, i) => i > 0 && fr[i - 1].obs.vy > 0 && f.obs.vy <= 0); const a = fr[iz - 1].obs, b = fr[iz].obs; const tUpData = a.t + (b.t - a.t) * a.vy / (a.vy - b.vy);
  const last = fr[fr.length - 1].obs;
  console.log(`${n}: t_up(數據)=${tUpData.toFixed(12)} t_up(解析)=${tUp.toFixed(12)} t_down=tf−t_up=${(last.tf - tUpData).toFixed(12)} |t_up−t_down|=${Math.abs(last.tf - 2 * tUpData).toExponential(2)} max|y(t_up−τ)−y(t_up+τ)|=${m.toExponential(2)} max|vy(t_up−τ)+vy(t_up+τ)|=${mv.toExponential(2)} 落地速率=${last.v} u=${p.u} |v−u|=${Math.abs(last.v - p.u).toExponential(2)} 落地 vy=${last.vy} −u sinθ=${-uy}`);
}
console.log("\n== 驗證條件 2：射程（u=15, h=0, 無阻力）==");
const R = {}; for (const th of [15, 30, 45, 60, 75]) { const d = load("extra-data-r2", `angle-${th}`); const last = d.frames[d.frames.length - 1].obs; R[th] = last.x; console.log(`θ=${th}°: 落點 x=${last.x} 規格 R=u²sin2θ/g=${225 * Math.sin(2 * th * DEG) / 9.81} 差=${Math.abs(last.x - 225 * Math.sin(2 * th * DEG) / 9.81).toExponential(2)} tf=${last.tf} 規格 tf=${2 * 15 * Math.sin(th * DEG) / 9.81}`); }
{ const d = load("../data", "scenario-range-45"); const last = d.frames[d.frames.length - 1].obs; R[70] = last.x; console.log(`θ=70°: 落點 x=${last.x} 規格 R=${225 * Math.sin(140 * DEG) / 9.81}`); }
{ const d = load("../data", "default"); const last = d.frames[d.frames.length - 1].obs; R[40] = last.x; console.log(`θ=40°: 落點 x=${last.x} 規格 R=${225 * Math.sin(80 * DEG) / 9.81}`); }
console.log(`R45 最大? ${Object.entries(R).every(([k, v]) => +k === 45 || v < R[45])} | |R15−R75|=${Math.abs(R[15] - R[75]).toExponential(2)} | |R30−R60|=${Math.abs(R[30] - R[60]).toExponential(2)}`);
{ const d = load("extra-data-r2", "official-scenario-range-45"); const f = d.frames[0]; const k = f.meta.k; for (const th of [15, 30, 45, 60, 75]) { const g = f.trails.find((q) => q.key === `ghost-${th}`); console.log(`ghost-${th}: 末點 x/k=${g.last[0] / k} 規格 R=${225 * Math.sin(2 * th * DEG) / 9.81} y=${g.last[1]} (r=${f.meta.r}) 首點=${JSON.stringify(g.first)} n=${g.n}`); } }
console.log("\n== 現象 1：兩球同高（y 對 yB）與同時落地 ==");
for (const [dir, n] of [["../data", "scenario-same-landing"], ["../data", "default"], ["extra-data-r2", "drop-default"], ["extra-data-r2", "air-default-fast"]]) {
  const d = load(dir, n), fr = d.frames; let m = 0; for (const f of fr) m = Math.max(m, Math.abs(f.obs.y - f.obs.yB));
  const iA = fr.findIndex((f) => f.meta.landedA), iB = fr.findIndex((f) => f.meta.landedB);
  console.log(`${n} (companion=${d.params.companion}, θ=${d.params.theta}, h=${d.params.h}, air=${d.params.air}): max|y−yB|=${m.toExponential(2)} 落地幀 A=${iA} B=${iB} 落地 xA=${fr[fr.length - 1].obs.x} xB=${fr[fr.length - 1].obs.xB} tf=${fr[fr.length - 1].obs.tf} √(2h/g)=${Math.sqrt(2 * d.params.h / d.params.g)}`);
}
console.log("\n== 最高點讀數（迷思：最高點速度為零／加速度為零）==");
for (const n of ["scenario-top-not-zero", "scenario-a-at-top"]) {
  const d = load("../data", n), fr = d.frames; let best = fr[0]; for (const f of fr) if (Math.abs(f.obs.vy) < Math.abs(best.obs.vy)) best = f;
  const acc = best.arrows.find((a) => a.layer === "acceleration"), vel = best.arrows.find((a) => a.layer === "velocity"), w = best.arrows.find((a) => a.layer === "weight");
  console.log(`${n}: t=${best.obs.t.toFixed(3)} vy=${best.obs.vy.toExponential(2)} vx=${best.obs.vx} v=${best.obs.v} Ek=${best.obs.Ek} ½vx²=${0.5 * best.obs.vx ** 2} y=${best.obs.y} H=${best.obs.H} ax,ay=${best.obs.ax},${best.obs.ay} a箭嘴=${JSON.stringify(acc.vector)} 畫長=${Math.hypot(...acc.vector) * best.scales.acceleration} W箭嘴=${JSON.stringify(w.vector)} 畫長=${Math.hypot(...w.vector) * best.scales.weight} v箭嘴=${JSON.stringify(vel.vector)} meta.EkMin=${best.meta.EkMin}`);
}
console.log("\n== 負投射角的 H 讀數 vs 規格公式 ==");
for (const [dir, n] of [["../data", "random-3"], ["extra-data-r2", "edge-theta-30-h0"], ["extra-data-r2", "edge-u50-theta-30-h50-air"]]) {
  const d = load(dir, n), p = d.params, o = d.frames[0].obs; const spec = p.h + p.u ** 2 * Math.sin(p.theta * DEG) ** 2 / (2 * p.g);
  let ymax = -Infinity; for (const f of d.frames) ymax = Math.max(ymax, f.obs.y);
  console.log(`${n}: θ=${p.theta} h=${p.h} obs.H=${o.H} 規格公式字面=${spec} 數據實際最高 y=${ymax}`);
}
console.log("\n== θ≤0 且 h=0 的邊界：首幀 ==");
for (const n of ["edge-theta-30-h0", "edge-u1-theta0-h0", "edge-theta-30-h0-fast"]) { const d = load("extra-data-r2", n); const f = d.frames[0]; console.log(`${n}: obs=${JSON.stringify(f.obs)} landedA=${f.meta.landedA} landedB=${f.meta.landedB} arrows=${f.arrows.length} bodies=${f.bodies.map((b) => b.key).join(",")} meta.tf=${f.meta.tf} done=${f.done} doneAt=${d.doneAt}`); }
console.log("\n== 空氣阻力運行：我的 RK4 落地時刻 vs 數據 tf vs meta.tf ==");
function rk4Land(p, init) { let s = init; const g = p.g; const f = (q) => { const v = Math.hypot(q.vx, q.vy); return [q.vx, q.vy, -K * v * q.vx, -g - K * v * q.vy]; }; const add = (q, k, c) => ({ x: q.x + c * k[0], y: q.y + c * k[1], vx: q.vx + c * k[2], vy: q.vy + c * k[3] }); const step = (q, hh) => { const k1 = f(q), k2 = f(add(q, k1, hh / 2)), k3 = f(add(q, k2, hh / 2)), k4 = f(add(q, k3, hh)); return { x: q.x + hh / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y: q.y + hh / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]), vx: q.vx + hh / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]), vy: q.vy + hh / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]) }; }; const h = 1e-4; let t = 0, ymax = s.y; if (s.y <= 0 && s.vy <= 0) return { tf: 0, ymax }; while (t < 200) { const n = step(s, h); if (n.y <= 0) { let lo = 0, hi = h; for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (step(s, mid).y <= 0) hi = mid; else lo = mid; } return { tf: t + hi, ymax, x: n.x }; } s = n; t += h; ymax = Math.max(ymax, s.y); } return { tf: Infinity, ymax }; }
for (const [dir, n] of [["../data", "random-0"], ["../data", "random-1"], ["../data", "random-2"], ["extra-data-r2", "edge-u50-theta45-h50-g10-air"], ["extra-data-r2", "edge-u50-theta-30-h50-air"], ["extra-data-r2", "air-default-fast"], ["extra-data-r2", "air-u50-theta40-h0-drop"]]) {
  const d = load(dir, n), p = d.params; const th = p.theta * DEG; const uy = p.u * Math.sin(th), ux = p.u * Math.cos(th); const tfNo = (uy + Math.sqrt(uy * uy + 2 * p.g * p.h)) / p.g; const r = rk4Land(p, { x: 0, y: p.h, vx: ux, vy: uy }); const metaTf = d.frames[0].meta.tf; const last = d.frames[d.frames.length - 1].obs;
  let rB = null; if (p.companion !== "none") rB = rk4Land(p, p.companion === "drop" ? { x: 0, y: p.h, vx: 0, vy: 0 } : { x: 0, y: p.h, vx: 2 * ux, vy: uy });
  console.log(`${n}: 阻力落地 tf(RK4)=${r.tf.toFixed(9)} 數據 tf=${last.tf.toFixed(9)} 數據 t=${last.t.toFixed(9)} 無阻力 tf=${tfNo.toFixed(4)} meta.tf=${metaTf.toFixed(4)} (meta.tf−0.3)/tf無阻力=${((metaTf - 0.3) / tfNo).toFixed(4)} 時間軸涵蓋落地? ${r.tf <= metaTf} 最高 y=${r.ymax.toFixed(2)}${rB ? ` | B 落地 tf(RK4)=${rB.tf.toFixed(9)}` : ""} doneAt=${d.doneAt ?? "n/a"}`);
}
console.log("\n== done 旗標與時鐘（extra 匯出）==");
for (const n of ["official-default", "official-scenario-same-landing", "official-random-0", "edge-u50-theta-30-h50-air", "air-u50-theta40-h0-drop", "edge-u50-theta45-h50-g1.6", "edge-theta-30-h0"]) {
  const d = load("extra-data-r2", n), fr = d.frames; const i = d.doneAt; const f = i !== null ? fr[i] : null; const prev = i ? fr[i - 1] : null;
  console.log(`${n}: doneAt=${i} ${f ? `t(done)=${f.obs.t} landedA=${f.meta.landedA} landedB=${f.meta.landedB} 前一幀 landedA=${prev?.meta.landedA} landedB=${prev?.meta.landedB} done=${prev?.done}` : "4 s 內未 done"} 最後幀 t=${fr[fr.length - 1].obs.t} tf=${fr[fr.length - 1].obs.tf} done=${fr[fr.length - 1].done}`);
}
console.log("\n== 落地後讀數（凍結約定）==");
{ const d = load("../data", "default"); const o = d.frames[3999].obs; console.log(`default 最後幀: ${JSON.stringify(o)}`); }
{ const d = load("extra-data-r2", "edge-u50-theta-30-h50-air"); const o = d.frames[3999].obs; console.log(`edge-u50-theta-30-h50-air 最後幀: ${JSON.stringify(o)}`); }
console.log("\n== 頻閃間距（default，每 0.1 s，來自 strobe-a bodies 世界座標 / k）==");
{ const d = load("extra-data-r2", "official-default"); const f = d.frames[3999]; const k = f.meta.k; const pts = f.bodies.filter((b) => b.key.startsWith("strobe-a-")).sort((a, b) => +a.key.split("-")[2] - +b.key.split("-")[2]).map((b) => [b.position[0] / k, (b.position[1] - f.meta.r) / k]); const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]), dy = pts.slice(1).map((p, i) => p[1] - pts[i][1]); console.log("n=" + pts.length, "Δx:", dx.map((v) => v.toFixed(6)).join(" ")); console.log("Δy:", dy.map((v) => v.toFixed(4)).join(" ")); console.log("Δy 差分(應=−g·0.01=−0.0981):", dy.slice(1).map((v, i) => (v - dy[i]).toFixed(5)).join(" ")); }
{ const d = load("extra-data-r2", "official-scenario-same-landing"); const f = d.frames[3999]; const k = f.meta.k; for (const who of ["a", "b"]) { const pts = f.bodies.filter((b) => b.key.startsWith(`strobe-${who}-`)).sort((a, b) => +a.key.split("-")[2] - +b.key.split("-")[2]).map((b) => [b.position[0] / k, (b.position[1] - f.meta.r) / k]); const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]), dy = pts.slice(1).map((p, i) => p[1] - pts[i][1]); console.log(`same-landing ${who}: n=${pts.length} Δx:`, dx.slice(0, 5).map((v) => v.toFixed(4)).join(" "), "… Δy:", dy.slice(0, 6).map((v) => v.toFixed(4)).join(" "), "…"); }
  const pa = f.bodies.filter((b) => b.key.startsWith("strobe-a-")).sort((a, b) => +a.key.split("-")[2] - +b.key.split("-")[2]), pb = f.bodies.filter((b) => b.key.startsWith("strobe-b-")).sort((a, b) => +a.key.split("-")[2] - +b.key.split("-")[2]); let m = 0; for (let i = 0; i < Math.min(pa.length, pb.length); i++) m = Math.max(m, Math.abs(pa[i].position[1] - pb[i].position[1])); console.log("same-landing 頻閃影像 a/b 逐格高度差 max =", m, " a n=", pa.length, " b n=", pb.length); }
console.log("\n== 縮放係數規則（各運行）==");
for (const n of ["default", "scenario-same-landing", "scenario-no-forward-force", "random-0", "random-1", "random-4"]) { const d = load("../data", n); const s = d.frames[0].scales, p = d.params; console.log(`${n}: u=${p.u.toFixed(2)} g=${p.g} scales=${JSON.stringify(s)} v·u=${(s.velocity * p.u).toFixed(6)} a·g=${(s.acceleration * p.g).toFixed(6)} W·g=${(s.weight * p.g).toFixed(6)} k=${d.frames[0].meta.k} world=${d.frames[0].meta.world} L=${d.frames[0].meta.L}`); }
