// 額外檢查（第 4 輪：線性阻力 F = −k v、k = 0.3 N s m⁻¹、質量 m）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runFrames, analytic, K_AIR } from "./model.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
const index = JSON.parse(fs.readFileSync(path.join(dataDir, "index.json"), "utf8"));
const { dt, frames } = index;
const load = (n) => JSON.parse(fs.readFileSync(path.join(dataDir, n + ".json"), "utf8")).frames;
const lastOf = (arr) => arr[arr.length - 1];
const ex = (x) => x.toExponential(2);

// ---------- A. 主實作數據的內部一致性（不經第二實作） ----------
console.log("== A. 主實作數據內部一致性");
for (const run of index.runs) {
  const F = load(run.name);
  const p = run.params;
  const c = p.air ? K_AIR / p.m : 0;
  const th = (p.theta * Math.PI) / 180;
  const fly = F.filter((f) => f.obs.ay !== 0 || f.obs.t === 0);
  const f0 = F[0].obs;
  const r0 = Math.max(Math.abs(f0.x), Math.abs(f0.y - p.h), Math.abs(f0.vx - p.u * Math.cos(th)), Math.abs(f0.vy - p.u * Math.sin(th)), Math.abs(f0.t), Math.abs(f0.tf),
    Math.abs(f0.ax + c * p.u * Math.cos(th)), Math.abs(f0.ay + p.g + c * p.u * Math.sin(th)), Math.abs(f0.Ek - 0.5 * p.m * p.u * p.u));
  const rEk = Math.max(...F.map((f) => Math.abs(f.obs.Ek - 0.5 * p.m * (f.obs.vx ** 2 + f.obs.vy ** 2))));
  let line = `${run.name} m=${p.m.toFixed(3)} air=${p.air}: t0 residual ${ex(r0)}  |Ek-0.5mv^2| ${ex(rEk)}`;
  if (!p.air) {
    const dvx = Math.max(...F.map((f) => Math.abs(f.obs.vx - f0.vx)));
    const E0 = f0.Ek + p.m * p.g * f0.y;
    const dE = Math.max(...F.map((f) => Math.abs(f.obs.Ek + p.m * p.g * f.obs.y - E0)));
    line += `  max|vx-vx0| ${ex(dvx)}  max|dE| ${ex(dE)}`;
  } else {
    let worst = 0;
    for (const f of fly) worst = Math.max(worst, Math.abs(f.obs.ax + c * f.obs.vx), Math.abs(f.obs.ay + p.g + c * f.obs.vy));
    let worstP = 0;
    for (let i = 1; i + 1 < fly.length; i++) {
      const Em = fly[i - 1].obs.Ek + p.m * p.g * fly[i - 1].obs.y, Ep = fly[i + 1].obs.Ek + p.m * p.g * fly[i + 1].obs.y;
      worstP = Math.max(worstP, Math.abs((Ep - Em) / (2 * dt) + K_AIR * fly[i].obs.v ** 2));
    }
    let mono = true;
    for (let i = 1; i < fly.length; i++) if (fly[i].obs.Ek + p.m * p.g * fly[i].obs.y > fly[i - 1].obs.Ek + p.m * p.g * fly[i - 1].obs.y + 1e-9) mono = false;
    line += `  drag-form residual ${ex(worst)}  |dE/dt + k v^2| ${ex(worstP)}  E monotone-decreasing ${mono}`;
  }
  if (p.companion === "fast") {
    const dy = Math.max(...F.map((f) => Math.abs(f.obs.yB - f.obs.y)));
    const dx = Math.max(...F.map((f) => Math.abs(f.obs.xB - 2 * f.obs.x)));
    line += `  fast: max|yB-y| ${ex(dy)} max|xB-2x| ${ex(dx)}`;
  }
  if (p.companion === "drop") {
    const dx = Math.max(...F.map((f) => Math.abs(f.obs.xB)));
    let worstB = 0;
    for (const f of F) {
      if (f.obs.yB === 0 && f.obs.t > 0) break;
      const s = analytic({ ...p, u: 0, theta: 0 }, f.obs.t);
      worstB = Math.max(worstB, Math.abs(f.obs.yB - s.y), Math.abs(f.obs.EkB - 0.5 * p.m * s.vy ** 2));
    }
    line += `  drop: max|xB| ${ex(dx)} B vs closed-form ${ex(worstB)}`;
  }
  console.log(line);
}
{
  const p = index.runs.find((r) => r.name === "random-0").params;
  const f = lastOf(load("random-0")).obs;
  const vt = p.m * p.g / K_AIR;
  console.log(`random-0 at t=${f.t.toFixed(3)}: vy = ${f.vy.toFixed(6)}, -m g/k = ${(-vt).toFixed(6)}, closed-form vy = ${analytic(p, f.t).vy.toFixed(6)}, vx = ${ex(f.vx)} (to 0)`);
}
for (const n of ["default", "scenario-a-at-top", "scenario-range-45"]) {
  const p = index.runs.find((r) => r.name === n).params;
  const F = load(n);
  const top = F.reduce((m, f) => (Math.abs(f.obs.vy) < Math.abs(m.obs.vy) ? f : m));
  console.log(n, "top t=", top.obs.t.toFixed(4), "Ek-0.5mvx^2 =", ex(top.obs.Ek - 0.5 * p.m * top.obs.vx ** 2), " H-y =", ex(top.obs.H - top.obs.y), " landing v-u =", ex(lastOf(F).obs.v - p.u), " tf/2 =", (lastOf(F).obs.tf / 2).toFixed(4));
}

// ---------- B. 第二實作：閉式解 vs 獨立 RK4（核對自己的代數） ----------
console.log("\n== B. closed-form vs RK4 (dt/10, linear drag)");
function rk4Run(p, h, tEnd) {
  const c = K_AIR / p.m, th = (p.theta * Math.PI) / 180;
  let s = [0, p.h, p.u * Math.cos(th), p.u * Math.sin(th)];
  const f = ([x, y, vx, vy]) => [vx, vy, -c * vx, -p.g - c * vy];
  const add = (a, b, k) => a.map((v, i) => v + k * b[i]);
  const n = Math.round(tEnd / h);
  for (let i = 0; i < n; i++) {
    const k1 = f(s), k2 = f(add(s, k1, h / 2)), k3 = f(add(s, k2, h / 2)), k4 = f(add(s, k3, h));
    s = s.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
  }
  return { x: s[0], y: s[1], vx: s[2], vy: s[3] };
}
for (const run of index.runs.filter((r) => r.params.air)) {
  const p = run.params;
  for (const T of [0.5, 1, 2]) {
    const a = analytic(p, T), r = rk4Run(p, dt / 10, T);
    console.log(run.name, "T=" + T, "closed-RK4:", ["x", "y", "vx", "vy"].map((k) => k + ":" + ex(a[k] - r[k])).join(" "));
  }
}

// ---------- C. 極限 / 對稱 ----------
console.log("\n== C. limits and symmetry");
const last = (p, n = frames) => lastOf(runFrames(p, dt, n)).obs;
const base = { u: 15, theta: 40, h: 0, g: 9.81, m: 1, air: false, companion: "none" };
{
  const A = runFrames({ ...base, m: 0.1 }, dt, frames), B = runFrames({ ...base, m: 1 }, dt, frames), C = runFrames({ ...base, m: 5 }, dt, frames);
  let dxy = 0, dEk = 0;
  for (let i = 0; i < frames; i++) {
    dxy = Math.max(dxy, Math.abs(A[i].obs.x - C[i].obs.x), Math.abs(A[i].obs.y - C[i].obs.y), Math.abs(A[i].t - C[i].t), Math.abs(B[i].obs.x - C[i].obs.x));
    dEk = Math.max(dEk, Math.abs(A[i].obs.Ek * 50 - C[i].obs.Ek), Math.abs(B[i].obs.Ek * 5 - C[i].obs.Ek));
  }
  console.log("no-drag m=0.1/1/5: max|dx,dy,dt| =", ex(dxy), " max|Ek*(m ratio) - Ek| =", ex(dEk), " tf:", lastOf(A).obs.tf, lastOf(C).obs.tf);
  const R = (m) => last({ ...base, air: true, m }).x;
  console.log("drag range vs m: m=0.1:", R(0.1).toFixed(3), " m=1:", R(1).toFixed(3), " m=5:", R(5).toFixed(3), " no-drag:", last(base).x.toFixed(3));
}
{
  for (const [m, k] of [[0.1, K_AIR], [0.1, 3], [1, 30]]) {
    const c = k / m, vt = m * 9.81 / k;
    const F = runFrames({ u: 1, theta: -30, h: 50, g: 9.81, m, k, air: true, companion: "none" }, dt, frames);
    const fl = F.filter((f) => f.obs.ay !== 0);
    const f = lastOf(fl).obs;
    console.log(`m=${m} k=${k} (c=${c}): at t=${f.t.toFixed(3)} v=${f.v.toFixed(6)} vy=${f.vy.toFixed(6)}  m g/k=${vt.toFixed(6)}  |v-vt|=${ex(Math.abs(f.v - vt))}  ay=${ex(f.ay)}  x=${f.x.toFixed(6)} (ux/c=${(Math.cos(-30 * Math.PI / 180) / c).toFixed(6)})  landed=${lastOf(F).obs.ay === 0}`);
  }
  const F = runFrames({ u: 50, theta: 90, h: 0, g: 9.81, m: 0.1, air: true, companion: "none" }, dt, frames);
  const top = F.reduce((a, f) => (f.obs.y > a.obs.y ? f : a));
  const vt = 0.1 * 9.81 / K_AIR, c = 3;
  const tUp = Math.log(1 + 50 / vt) / c, yTop = (50 + vt) / c * (1 - Math.exp(-c * tUp)) - vt * tUp;
  console.log(`u=50 theta=90 m=0.1: top t=${top.obs.t.toFixed(4)} (analytic ${tUp.toFixed(4)}) y=${top.obs.y.toFixed(4)} (analytic ${yTop.toFixed(4)}); landing t=${lastOf(F).obs.tf.toFixed(4)} v=${lastOf(F).obs.v.toFixed(4)} (vt ${vt.toFixed(4)}); max|x|=${ex(Math.max(...F.map((f) => Math.abs(f.obs.x))))}`);
}
{
  for (const k of [1e-2, 1e-4, 1e-6]) {
    const A = runFrames({ ...base, air: true, k }, dt, frames), B = runFrames(base, dt, frames);
    let d = 0;
    for (let i = 0; i < frames; i++) { if (A[i].obs.ay === 0 || B[i].obs.ay === 0) break; d = Math.max(d, Math.abs(A[i].obs.x - B[i].obs.x), Math.abs(A[i].obs.y - B[i].obs.y)); }
    console.log("k=" + k, "max|dx,dy| vs no-drag =", ex(d), " dtf =", ex(lastOf(A).obs.tf - lastOf(B).obs.tf));
  }
}
{
  const R = (th, air = false) => last({ ...base, theta: th, air }).x;
  console.log("no-drag R(20)-R(70) =", ex(R(20) - R(70)), " R(30)-R(60) =", ex(R(30) - R(60)), " R(44),R(45),R(46) =", R(44).toFixed(5), R(45).toFixed(5), R(46).toFixed(5));
  let best = null;
  for (let th = 20; th <= 60; th++) { const r = R(th, true); if (!best || r > best[1]) best = [th, r]; }
  console.log("drag (m=1,k=0.3): best angle", best[0] + " deg", "R =", best[1].toFixed(3), " R(45)=", R(45, true).toFixed(3), " R(30)-R(60) =", (R(30, true) - R(60, true)).toFixed(3));
  const F = runFrames({ ...base, air: true }, dt, frames);
  const top = F.reduce((a, f) => (f.obs.y > a.obs.y ? f : a));
  console.log("drag default: t_top =", top.obs.t.toFixed(4), " tf =", lastOf(F).obs.tf.toFixed(4), " tf - 2 t_top =", (lastOf(F).obs.tf - 2 * top.obs.t).toFixed(4), " landing v =", lastOf(F).obs.v.toFixed(3), " (u = 15)");
}
{
  console.log("theta=0,h=0:", JSON.stringify(last({ ...base, theta: 0 })));
  console.log("theta=-30,h=0,drop,air:", JSON.stringify(last({ ...base, theta: -30, air: true, companion: "drop" })));
  console.log("theta=40,h=0,drop frame 2:", JSON.stringify(runFrames({ ...base, companion: "drop" }, dt, 3)[2].obs));
  const F = runFrames({ ...base, theta: 30, h: 20, air: true, companion: "drop" }, dt, frames);
  const iB = F.findIndex((f) => f.obs.yB === 0 && f.t > 0);
  console.log("drop h=20 theta=30 air: B lands frame", iB, "t=", F[iB].t.toFixed(6), "(no-drag sqrt(2h/g)=", Math.sqrt(40 / 9.81).toFixed(6), ") yB stays 0:", F.slice(iB).every((f) => f.obs.yB === 0), " EkB frozen:", F.slice(iB).every((f) => f.obs.EkB === F[iB].obs.EkB), " final t=", lastOf(F).t.toFixed(6));
  const G = runFrames({ ...base, h: 10, air: true, companion: "fast" }, dt, frames);
  console.log("fast air: max|yB-y| =", ex(Math.max(...G.map((f) => Math.abs(f.obs.yB - f.obs.y)))), " max|xB-2x| =", ex(Math.max(...G.map((f) => Math.abs(f.obs.xB - 2 * f.obs.x)))));
}
{
  const t1 = last({ ...base, g: 1.6 }).tf, t2 = last(base).tf;
  console.log("tf(g=1.6)=", t1.toFixed(4), "(3.999 = not landed) tf(g=9.81)=", t2.toFixed(4), " analytic:", (2 * 15 * Math.sin(40 * Math.PI / 180) / 1.6).toFixed(4), (2 * 15 * Math.sin(40 * Math.PI / 180) / 9.81).toFixed(4));
}
