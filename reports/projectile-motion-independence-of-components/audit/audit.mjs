// 物理核數：拋體運動（Book 2 模擬器 2）獨立計算與逐幀比對
// 只用規格方程與自己的 RK4；不讀 model.ts / plan.ts。
// 用法：node audit.mjs  →  印出摘要並寫 results.json
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data");
const EXTRA = join(HERE, "extra-data");
const K_AIR = 0.01;            // manifest.beyondSpec：a = −k v|v|，k = 0.01 m⁻¹
const M = 1;                   // 動能質量 1 kg
const DEG = Math.PI / 180;
const TOL_AN = 1e-6;           // 解析解相對誤差
const TOL_NUM = 1e-4;          // 數值對數值
const TOL_VEC = 1e-9;          // 向量加法
const R_BALL = 0.35, Z_ACC = 0.45;

const fmt = (x) => (x === 0 ? "0" : Number.isFinite(x) ? x.toExponential(2) : String(x));

// ---------- 規格方程（解析解） ----------
function initial(p) {
  const th = p.theta * DEG;
  return { ux: p.u * Math.cos(th), uy: p.u * Math.sin(th) };
}
function tfAnalytic(uy, h, g) {
  // y = h + uy t − ½ g t² = 0 的正根；h = 0 且 uy ≤ 0 → 0
  const disc = uy * uy + 2 * g * h;
  const tf = (uy + Math.sqrt(disc)) / g;
  return tf > 0 ? tf : 0;
}
function stateAnalytic(ux, uy, h, g, t) {
  return { x: ux * t, y: h + uy * t - 0.5 * g * t * t, vx: ux, vy: uy - g * t, ax: 0, ay: -g };
}

// ---------- 自己的 RK4（空氣阻力） ----------
function accel(s, g, air) {
  if (!air) return [0, -g];
  const v = Math.hypot(s.vx, s.vy);
  return [-K_AIR * v * s.vx, -g - K_AIR * v * s.vy];
}
function rk4(s, g, air, h) {
  const f = (st) => { const a = accel(st, g, air); return [st.vx, st.vy, a[0], a[1]]; };
  const add = (st, k, c) => ({ x: st.x + c * k[0], y: st.y + c * k[1], vx: st.vx + c * k[2], vy: st.vy + c * k[3] });
  const k1 = f(s), k2 = f(add(s, k1, h / 2)), k3 = f(add(s, k2, h / 2)), k4 = f(add(s, k3, h));
  return { x: s.x + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y: s.y + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
           vx: s.vx + h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]), vy: s.vy + h / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]) };
}
// 積分一顆球到每個幀時刻；落地（y=0，向下）以二分法定到 1e-12 s，之後凍結
function integrateBall(init, g, air, times, subdt = 1e-4) {
  const out = []; let s = { ...init }; let t = 0; let landed = init.y <= 0 && init.vy <= 0 && init.y === 0; let tf = landed ? 0 : null;
  if (landed) { for (const _ of times) out.push({ ...s, t: 0 }); return { frames: out, tf: 0, landedState: s }; }
  let landedState = null;
  for (const T of times) {
    while (!landed && t < T - 1e-15) {
      const h = Math.min(subdt, T - t);
      const s2 = rk4(s, g, air, h);
      if (s2.y <= 0) {
        let lo = 0, hi = h, sl = s;
        for (let it = 0; it < 80; it++) { const mid = (lo + hi) / 2; const sm = rk4(s, g, air, mid); if (sm.y <= 0) { hi = mid; } else { lo = mid; sl = sm; } if (hi - lo < 1e-13) break; }
        const sf = rk4(s, g, air, hi); tf = t + hi; s = { ...sf, y: 0 }; t = tf; landed = true; landedState = s; break;
      }
      s = s2; t += h;
    }
    out.push({ ...s, t: landed ? tf : t });
  }
  return { frames: out, tf, landedState };
}

// ---------- 讀取運行 ----------
function loadRuns(dir) {
  const idx = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
  return idx.runs.map((r) => ({ ...r, ...JSON.parse(readFileSync(join(dir, r.name + ".json"), "utf8")) }));
}

class Err { constructor(name, scale = 1) { this.name = name; this.scale = scale; this.max = 0; this.at = null; this.maxRel = 0; }
  add(obs, exp, t) { const e = Math.abs(obs - exp); const rel = e / Math.max(Math.abs(exp), this.scale); if (!(Number.isFinite(e))) { this.max = NaN; this.at = t; return; } if (rel > this.maxRel) { this.maxRel = rel; this.max = e; this.at = t; } }
  row(tol) { return { q: this.name, absMax: this.max, relMax: this.maxRel, at: this.at, pass: Number.isFinite(this.maxRel) && this.maxRel <= tol }; } }

function auditRun(run, source) {
  const p = run.params, g = p.g, air = !!p.air, dt = run.dt;
  const { ux, uy } = initial(p);
  const fr = run.frames; const N = fr.length;
  const times = fr.map((_, i) => i * dt);
  const hasB = p.companion !== "none";
  const initA = { x: 0, y: p.h, vx: ux, vy: uy };
  const initB = p.companion === "drop" ? { x: 0, y: p.h, vx: 0, vy: 0 } : { x: 0, y: p.h, vx: 2 * ux, vy: uy };
  // 預期：解析（無阻力）或 RK4（阻力）
  let A, B = null;
  if (!air) {
    const tfA = tfAnalytic(uy, p.h, g);
    A = { tf: tfA, frames: times.map((t) => { const tt = Math.min(t, tfA); return { ...stateAnalytic(ux, uy, p.h, g, tt), t: tt }; }) };
    if (hasB) { const tfB = tfAnalytic(initB.vy, p.h, g); B = { tf: tfB, frames: times.map((t) => { const tt = Math.min(t, tfB); return { ...stateAnalytic(initB.vx, initB.vy, p.h, g, tt), t: tt }; }) }; }
  } else {
    A = integrateBall(initA, g, air, times); if (hasB) B = integrateBall(initB, g, air, times);
  }
  const tfAll = Math.max(A.tf ?? Infinity, B ? (B.tf ?? Infinity) : 0);
  const tol = air ? TOL_NUM : TOL_AN;
  const sV = p.u, sL = Math.max(p.h, p.u * p.u / g, 1), sA = g, sE = 0.5 * p.u * p.u + g * p.h;
  const E = {
    t: new Err("t", 1), x: new Err("x", sL), y: new Err("y", sL), vx: new Err("vx", sV), vy: new Err("vy", sV), v: new Err("v", sV),
    ax: new Err("ax", sA), ay: new Err("ay", sA), Ek: new Err("Ek", sE), H: new Err("H", sL), tf: new Err("tf", 1),
    xB: new Err("xB", sL), yB: new Err("yB", sL), EkB: new Err("EkB", sE),
  };
  const vec = { velA: 0, vxA: 0, vyA: 0, accA: 0, wA: 0, fricA: 0, fsum: 0, orgA: 0, orgAcc: 0, orgB: 0, velB: 0, vxB: 0, vyB: 0, labX: 0, labY: 0, labXpos: 0, labYpos: 0 };
  const issues = [];
  let accLenMin = Infinity, accLenMax = -Infinity, vxMin = Infinity, vxMax = -Infinity;
  let arrowsAfterLandA = 0, arrowsAfterLandB = 0, missingArrowsBeforeLand = 0, unexpectedKinds = new Set();
  const scales0 = JSON.stringify(fr[0].scales); let scaleChanges = 0; let kChanges = 0; const k0 = fr[0].meta.k;
  let nonFinite = 0;
  let Emin = Infinity, Emax = -Infinity, EmaxRise = 0, Eprev = null;
  let ayAfterLanding = null, axAfterLanding = null;
  let firstFrozen = null;
  const strobe = [];
  let topFrame = null;

  for (let i = 0; i < N; i++) {
    const f = fr[i], o = f.obs, t = i * dt;
    const eA = A.frames[i], eB = B ? B.frames[i] : null;
    const tExp = Math.min(t, tfAll === Infinity ? t : tfAll);
    const landedA = A.tf !== null && t >= A.tf - 1e-12;
    const landedB = B ? (B.tf !== null && t >= B.tf - 1e-12) : true;
    // 非有限數
    const scan = (v) => { if (typeof v === "number") { if (!Number.isFinite(v)) nonFinite++; } else if (Array.isArray(v)) v.forEach(scan); else if (v && typeof v === "object") Object.values(v).forEach(scan); };
    scan(o); scan(f.arrows); scan(f.scales); scan(f.meta); scan(f.labels);
    // 時間
    E.t.add(o.t, tExp, t); E.tf.add(o.tf, tExp, t);
    if (Math.abs(f.t - o.t) > 1e-12) issues.push(`frame ${i}: frame.t ≠ obs.t`);
    // 主球
    E.x.add(o.x, eA.x, t); E.y.add(o.y, eA.y, t); E.vx.add(o.vx, eA.vx, t); E.vy.add(o.vy, eA.vy, t);
    E.v.add(o.v, Math.hypot(eA.vx, eA.vy), t); E.Ek.add(o.Ek, 0.5 * M * (eA.vx ** 2 + eA.vy ** 2), t);
    E.H.add(o.H, p.h + p.u * p.u * Math.sin(p.theta * DEG) ** 2 / (2 * g), t);
    if (!landedA) { const aE = air ? accel(eA, g, air) : [0, -g]; E.ax.add(o.ax, aE[0], t); E.ay.add(o.ay, aE[1], t); if (!air) { vxMin = Math.min(vxMin, o.vx); vxMax = Math.max(vxMax, o.vx); } }
    else if (ayAfterLanding === null) { ayAfterLanding = o.ay; axAfterLanding = o.ax; firstFrozen = i; }
    if (eB) { E.xB.add(o.xB, eB.x, t); E.yB.add(o.yB, eB.y, t); E.EkB.add(o.EkB, 0.5 * M * (eB.vx ** 2 + eB.vy ** 2), t); }
    // 能量（無阻力應守恆；阻力應單調不增）
    const Etot = o.Ek + M * g * o.y; if (!landedA) { Emin = Math.min(Emin, Etot); Emax = Math.max(Emax, Etot); if (Eprev !== null) EmaxRise = Math.max(EmaxRise, Etot - Eprev); Eprev = Etot; }
    // 頻閃（每 0.1 s）
    if (!landedA && Math.abs(t / 0.1 - Math.round(t / 0.1)) < 1e-9) strobe.push({ t, x: o.x, y: o.y });
    // 最高點附近（vy 變號）
    if (topFrame === null && i > 0 && fr[i - 1].obs.vy > 0 && o.vy <= 0) topFrame = i;
    // 縮放與 k
    if (JSON.stringify(f.scales) !== scales0) scaleChanges++; if (f.meta.k !== k0) kChanges++;
    // 箭嘴
    const k = f.meta.k, zOff = f.meta.zOff;
    const arrA = f.arrows.filter((a) => a.origin[2] === 0 || a.origin[2] === Z_ACC);
    const arrB = f.arrows.filter((a) => a.origin[2] === -zOff);
    if (arrA.length + arrB.length !== f.arrows.length) issues.push(`frame ${i}: 箭嘴 z 座標不屬於任一球`);
    for (const a of f.arrows) if (!["velocity", "acceleration", "weight", "friction"].includes(a.kind)) unexpectedKinds.add(a.kind);
    if (landedA) { if (arrA.length) arrowsAfterLandA++; }
    else {
      const get = (layer) => arrA.find((a) => a.layer === layer);
      const vA = get("velocity"), vxA = get("vx"), vyA = get("vy"), aA = get("acceleration"), wA = get("weight"), fA = get("air");
      if (!vA || !vxA || !vyA || !aA || !wA || (air && !fA)) { missingArrowsBeforeLand++; }
      const d3 = (u, w) => Math.max(Math.abs(u[0] - w[0]), Math.abs(u[1] - w[1]), Math.abs(u[2] - w[2]));
      if (vA) { vec.velA = Math.max(vec.velA, d3(vA.vector, [o.vx, o.vy, 0])); vec.orgA = Math.max(vec.orgA, d3(vA.origin, [o.x * k, o.y * k + R_BALL, 0])); if (vA.kind !== "velocity") issues.push(`frame ${i}: v 箭嘴 kind=${vA.kind}`); }
      if (vxA) vec.vxA = Math.max(vec.vxA, d3(vxA.vector, [o.vx, 0, 0]));
      if (vyA) vec.vyA = Math.max(vec.vyA, d3(vyA.vector, [0, o.vy, 0]));
      if (aA) { vec.accA = Math.max(vec.accA, d3(aA.vector, [o.ax, o.ay, 0])); vec.orgAcc = Math.max(vec.orgAcc, d3(aA.origin, [o.x * k, o.y * k + R_BALL, Z_ACC])); const len = Math.hypot(...aA.vector); accLenMin = Math.min(accLenMin, len); accLenMax = Math.max(accLenMax, len); if (aA.kind !== "acceleration") issues.push(`frame ${i}: a 箭嘴 kind=${aA.kind}`); }
      if (wA) { vec.wA = Math.max(vec.wA, d3(wA.vector, [0, -M * g, 0])); if (wA.kind !== "weight") issues.push(`frame ${i}: W 箭嘴 kind=${wA.kind}`); }
      if (fA) { const v = Math.hypot(o.vx, o.vy); vec.fricA = Math.max(vec.fricA, d3(fA.vector, [-M * K_AIR * v * o.vx, -M * K_AIR * v * o.vy, 0])); if (fA.kind !== "friction") issues.push(`frame ${i}: 阻力箭嘴 kind=${fA.kind}`); }
      if (!air && fA) issues.push(`frame ${i}: 無阻力仍有阻力箭嘴`);
      // F = ma：力箭嘴之和 = m × 加速度箭嘴
      if (aA) { const forces = arrA.filter((a) => a.kind === "weight" || a.kind === "friction"); const sum = [0, 0, 0]; for (const q of forces) for (let j = 0; j < 3; j++) sum[j] += q.vector[j]; vec.fsum = Math.max(vec.fsum, d3(sum, aA.vector.map((c) => M * c))); }
      // 分量箭嘴之和 = 速度箭嘴
      if (vA && vxA && vyA) vec.vcomp = Math.max(vec.vcomp ?? 0, d3(vxA.vector.map((c, j) => c + vyA.vector[j]), vA.vector));
    }
    if (B) {
      if (landedB) { if (arrB.length) arrowsAfterLandB++; }
      else {
        const get = (layer) => arrB.find((a) => a.layer === layer);
        const vB = get("velocity"), vxB = get("vx"), vyB = get("vy");
        const d3 = (u, w) => Math.max(Math.abs(u[0] - w[0]), Math.abs(u[1] - w[1]), Math.abs(u[2] - w[2]));
        if (!vB || !vxB || !vyB) missingArrowsBeforeLand++;
        if (vB) { vec.velB = Math.max(vec.velB, d3(vB.vector, [eB.vx, eB.vy, 0])); vec.orgB = Math.max(vec.orgB, d3(vB.origin, [o.xB * k, o.yB * k + R_BALL, -zOff])); }
        if (vxB) vec.vxB = Math.max(vec.vxB, d3(vxB.vector, [eB.vx, 0, 0]));
        if (vyB) vec.vyB = Math.max(vec.vyB, d3(vyB.vector, [0, eB.vy, 0]));
        const extra = arrB.filter((a) => a.kind !== "velocity"); if (extra.length) issues.push(`frame ${i}: 第二顆球有非速度箭嘴 ${extra.map((a) => a.kind)}`);
      }
    } else if (arrB.length) issues.push(`frame ${i}: 無第二顆球卻有 z=−zOff 箭嘴`);
    // 標籤
    const lx = f.labels.find((l) => l.symbol === "x"), ly = f.labels.find((l) => l.symbol === "y");
    if (lx) { vec.labX = Math.max(vec.labX, Math.abs(lx.value - o.x)); vec.labXpos = Math.max(vec.labXpos, Math.abs(lx.position[0] - o.x * k)); }
    if (ly) { vec.labY = Math.max(vec.labY, Math.abs(ly.value - o.y)); vec.labYpos = Math.max(vec.labYpos, Math.abs(ly.position[1] - (o.y * k + R_BALL))); }
  }
  // 驗證條件相關量
  const last = fr[N - 1].obs;
  const tUpAn = uy > 0 ? uy / g : 0;
  // 由數據估最高點時刻：vy 變號幀線性內插
  let tUpData = null; if (topFrame !== null) { const a = fr[topFrame - 1].obs, b = fr[topFrame].obs; tUpData = a.t + (b.t - a.t) * a.vy / (a.vy - b.vy); }
  // 路徑對稱：y(t_up − τ) 與 y(t_up + τ)
  let symMax = 0; if (!air && p.h === 0 && uy > 0 && A.tf) { for (let i = 0; i < N; i++) { const t = i * dt; if (t > tUpAn) break; const j = Math.round((2 * tUpAn - t) / dt); if (j < N && j * dt <= A.tf) symMax = Math.max(symMax, Math.abs(fr[i].obs.y - fr[j].obs.y)); } }
  const strobeDx = strobe.slice(1).map((s, i) => s.x - strobe[i].x), strobeDy = strobe.slice(1).map((s, i) => s.y - strobe[i].y);
  const dxSpread = strobeDx.length ? Math.max(...strobeDx) - Math.min(...strobeDx) : null;
  const dyIncreasing = strobeDy.length > 1 ? strobeDy.slice(1).every((d, i) => d < strobeDy[i]) : null; // 向上為正：每格 Δy 遞減即向下間距遞增
  const rows = Object.values(E).map((e) => e.row(tol)).filter((r) => r.at !== null);
  return {
    name: run.name, source, params: p, frames: N, air, tol,
    expected: { ux, uy, tfA: A.tf, tfB: B ? B.tf : null, tfAll: tfAll === Infinity ? null : tfAll, tUp: tUpAn, R: !air && p.h === 0 ? p.u * p.u * Math.sin(2 * p.theta * DEG) / g : null, landingSpeed: !air && A.tf ? Math.hypot(A.frames[N - 1].vx, A.frames[N - 1].vy) : null },
    data: { tfLast: last.tf, tLast: last.t, xLast: last.x, yLast: last.y, vLast: last.v, vxLast: last.vx, vyLast: last.vy, tUpData, metaTf: fr[0].meta.tf, EkMin: fr[0].meta.EkMin, EkMax: fr[0].meta.EkMax, firstFrozenFrame: firstFrozen, ayAfterLanding, axAfterLanding, xBLast: last.xB, yBLast: last.yB },
    rows, vec, accLen: { min: accLenMin, max: accLenMax }, vxRange: { min: vxMin, max: vxMax, spread: vxMax - vxMin },
    symMax, strobe: { n: strobe.length, dxSpread, dyIncreasing, dx: strobeDx.slice(0, 5), dy: strobeDy.slice(0, 5) },
    energy: { min: Emin, max: Emax, drift: Emax - Emin, maxRise: EmaxRise },
    flags: { arrowsAfterLandA, arrowsAfterLandB, missingArrowsBeforeLand, scaleChanges, kChanges, nonFinite, unexpectedKinds: [...unexpectedKinds], k: k0, scales: fr[0].scales },
    issues: issues.slice(0, 20), issueCount: issues.length,
  };
}

const results = [];
for (const r of loadRuns(DATA)) results.push(auditRun(r, "data"));
if (existsSync(join(EXTRA, "index.json"))) for (const r of loadRuns(EXTRA)) results.push(auditRun(r, "extra"));
writeFileSync(join(HERE, "results.json"), JSON.stringify(results, null, 1));

// ---------- 摘要 ----------
for (const r of results) {
  const bad = r.rows.filter((x) => !x.pass);
  console.log(`\n## ${r.name} [${r.source}] air=${r.air} u=${r.params.u} θ=${r.params.theta} h=${r.params.h} g=${r.params.g} comp=${r.params.companion}`);
  console.log(`  tf 預期 A=${r.expected.tfA} B=${r.expected.tfB} | 數據 tf=${r.data.tfLast} meta.tf=${r.data.metaTf} (meta−tf=${r.data.metaTf - r.data.tfLast})`);
  console.log(`  逐幀最大相對誤差: ${r.rows.map((x) => `${x.q}=${fmt(x.relMax)}@${x.at?.toFixed(3)}${x.pass ? "" : "✗"}`).join(" ")}`);
  console.log(`  向量最大差: ${Object.entries(r.vec).map(([k, v]) => `${k}=${fmt(v)}`).join(" ")}`);
  console.log(`  |a|箭嘴 ${r.accLen.min}..${r.accLen.max} | vx 全程變化 ${fmt(r.vxRange.spread)} | 對稱 max|Δy|=${fmt(r.symMax)} | 落地速率 ${r.data.vLast} (預期 ${r.expected.landingSpeed}) | t_up 數據 ${r.data.tUpData} 預期 ${r.expected.tUp}`);
  console.log(`  頻閃 n=${r.strobe.n} Δx 極差=${fmt(r.strobe.dxSpread)} Δy 遞減=${r.strobe.dyIncreasing} | 能量漂移=${fmt(r.energy.drift)} 最大上升=${fmt(r.energy.maxRise)} | 落地後 ax,ay=${r.data.axAfterLanding},${r.data.ayAfterLanding} 首凍結幀=${r.data.firstFrozenFrame}`);
  console.log(`  旗標: ${JSON.stringify(r.flags)} | issues=${r.issueCount} ${r.issues.slice(0, 3).join("; ")}`);
  if (bad.length) console.log(`  ✗ 未通過: ${bad.map((x) => x.q).join(",")}`);
}
