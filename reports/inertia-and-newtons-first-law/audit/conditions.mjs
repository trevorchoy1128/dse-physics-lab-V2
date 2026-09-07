// 規格 §10 驗證條件 1–17 的逐條核數（用 extra-data 與 data 的導出幀，按規格方程自行計算）
import fs from "node:fs";
const ROOT = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/";
const E = ROOT + "audit/extra-data/", D = ROOT + "data/";
const L = (n, dir = E) => JSON.parse(fs.readFileSync(dir + n + ".json", "utf8"));
const live = run => { const o = []; for (const f of run.frames) { if (f.meta && f.meta.done === 1) break; o.push(f); } return o; };
const MP = 60, g = 9.81;
const relStd = xs => { const m = xs.reduce((a, b) => a + b) / xs.length; return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length) / Math.abs(m); };
const fmt = x => (typeof x === "number" ? (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(2) : +x.toPrecision(7)) : x);
const R = {};

// C1 無摩擦、無外力時速度恆定（模型在 T = 12 s 凍結，導出只能驗 12 s）
{
  const r = live(L("release-two-blocks")); const after = r.filter(f => f.t >= 0.5);
  const vA0 = after[0].obs.v, vB0 = after[0].obs.vB;
  const dA = Math.max(...after.map(f => Math.abs(f.obs.v - vA0) / vA0)), dB = Math.max(...after.map(f => Math.abs(f.obs.vB - vB0) / vB0));
  const sp = live(L("long-space")), lt = live(L("long-table"));
  R.c1 = { tableWindow: [after[0].t, after.at(-1).t], vA0, vB0, driftA: dA, driftB: dB, signFlips: after.filter(f => f.obs.v <= 0).length,
    longTable: lt.map(f => [f.t, f.obs.v]), longSpace: sp.map(f => [f.t, f.obs.v, f.obs.vB, f.obs.vC]) };
}
// C2 放手後淨力為零（μ = 0）
{
  const r = live(L("release-two-blocks")).filter(f => f.t >= 0.5);
  R.c2 = { frames: r.length, maxFnet: Math.max(...r.map(f => Math.abs(f.obs.Fnet))), maxA: Math.max(...r.map(f => Math.abs(f.obs.a))), maxAB: Math.max(...r.map(f => Math.abs(f.obs.aB))),
    maxNetArrow: Math.max(...r.map(f => Math.max(0, ...f.arrows.filter(a => a.kind === "net").map(a => Math.hypot(...a.vector))))) };
  const r2 = live(L("release-0.8")).filter(f => f.t >= 0.8 && f.obs.s < 0.75);
  R.c2.smoothAfterRelease = { frames: r2.length, tRange: [r2[0].t, r2.at(-1).t], maxFnet: Math.max(...r2.map(f => Math.abs(f.obs.Fnet))), maxA: Math.max(...r2.map(f => Math.abs(f.obs.a))) };
}
// C3 2024 Q3(b) 受力圖：放手後 applied = 0、weight 1、normal 1
{
  const cnt = (fr, k, z) => fr.arrows.filter(a => a.kind === k && a.origin[2] === z).length;
  const r = live(L("release-0.8")); const before = r.filter(f => f.t < 0.8), after = r.filter(f => f.t >= 0.8);
  R.c3 = { before: { frames: before.length, applied: [...new Set(before.map(f => cnt(f, "tension", 0)))], nForces: [...new Set(before.map(f => f.obs.nForces))] },
    after: { frames: after.length, applied: [...new Set(after.map(f => cnt(f, "tension", 0)))], weight: [...new Set(after.map(f => cnt(f, "weight", 0)))], normal: [...new Set(after.map(f => cnt(f, "normal", 0)))], nForcesSmooth: [...new Set(after.filter(f => f.obs.s < 0.75).map(f => f.obs.nForces))], nHorizSmooth: [...new Set(after.filter(f => f.obs.s < 0.75).map(f => f.obs.nHoriz))] },
    vAtRelease: { tBefore: before.at(-1).t, vBefore: before.at(-1).obs.v, tAfter: after[0].t, vAfter: after[0].obs.v, vAt1_02: after.find(f => Math.abs(f.t - 1.02) < 1e-6).obs.v } };
  const r2 = live(L("release-two-blocks")).filter(f => f.t >= 0.5);
  R.c3.twoBlocks = { applied0: [...new Set(r2.map(f => cnt(f, "tension", 0)))], applied1: [...new Set(r2.map(f => cnt(f, "tension", 1)))], weight1: [...new Set(r2.map(f => cnt(f, "weight", 1)))], normal1: [...new Set(r2.map(f => cnt(f, "normal", 1)))] };
}
// C4 靜止不等於無力
{
  const r = live(L("scenario-rest-not-no-force"));
  let magErr = 0, dotErr = 0, nW = new Set(), nN = new Set(), fnet = 0;
  for (const f of r) {
    const w = f.arrows.filter(a => a.kind === "weight"), n = f.arrows.filter(a => a.kind === "normal"); nW.add(w.length); nN.add(n.length);
    const W = Math.hypot(...w[0].vector), N = Math.hypot(...n[0].vector); magErr = Math.max(magErr, Math.abs(W - N) / W);
    const dot = w[0].vector.reduce((s, x, i) => s + x * n[0].vector[i], 0) / (W * N); dotErr = Math.max(dotErr, Math.abs(dot + 1));
    fnet = Math.max(fnet, Math.abs(f.obs.Fnet), ...f.arrows.filter(a => a.kind === "net").map(a => Math.hypot(...a.vector)));
  }
  R.c4 = { frames: r.length, weightArrows: [...nW], normalArrows: [...nN], magRelErr: magErr, dotPlus1: dotErr, maxFnet: fnet, W: r[0].obs.W, N: r[0].obs.N, nForces: [...new Set(r.map(f => f.obs.nForces))], v: [...new Set(r.map(f => f.obs.v))] };
}
// C5 靜止時外力不超過 μmg 則不動（μmg = 0.2 × 0.2 × 9.81 = 0.3924）
{
  R.c5 = {};
  for (const F of [0.3, 0.39, 0.3924, 0.3925, 0.4]) {
    const r = live(L("static-F" + F));
    R.c5["F=" + F] = { mumg: 0.2 * 0.2 * g, a: [...new Set(r.map(f => f.obs.a))].map(fmt), f: [...new Set(r.map(f => f.obs.f))].map(fmt), vEnd: r.at(-1).obs.v, sEnd: r.at(-1).obs.s, aExpected: F > 0.3924 ? (F - 0.3924) / 0.2 : 0 };
  }
}
// C6 施力等於摩擦則勻速
{
  const r = live(L("scenario-constant-v-zero-net")); const rough = r.filter(f => f.obs.s >= 0.75);
  const vs = rough.map(f => f.obs.v);
  R.c6 = { F: 1, mumg: 0.2 * 0.5 * 10, roughFrames: rough.length, tRange: [rough[0].t, rough.at(-1).t], maxFnet: Math.max(...rough.map(f => Math.abs(f.obs.Fnet))), vMin: Math.min(...vs), vMax: Math.max(...vs), vExpected: Math.sqrt(2 * 2 * 0.75), f: [...new Set(rough.map(f => f.obs.f))], Fapp: [...new Set(rough.map(f => f.obs.Fapp))] };
}
// C7 粗糙面上的減速與解析解比較
{
  R.c7 = {};
  for (const [n, mu] of [["release-1.5", 0.2], ["release-1.5-mu0.05", 0.05]]) {
    const r = live(L(n)); const after = r.filter(f => f.t >= 1.5); const v0 = after[0].obs.v, s0 = after[0].obs.s;
    const moving = after.filter(f => f.obs.v > 0);
    const aErr = Math.max(...moving.map(f => Math.abs(f.obs.a + mu * g) / (mu * g)));
    const stopped = after.filter(f => f.obs.v === 0);
    const d = stopped[0].obs.s - s0, dExp = v0 * v0 / (2 * mu * g);
    R.c7[n] = { mu, v0, s0, aErr, tStop: stopped[0].t, tStopExpected: 1.5 + v0 / (mu * g), slide: d, slideExpected: dExp, slideRelErr: Math.abs(d - dExp) / dExp, vMinAfter: Math.min(...after.map(f => f.obs.v)), frictionAfterStop: [...new Set(stopped.map(f => f.obs.f))], nForcesAfterStop: [...new Set(stopped.map(f => f.obs.nForces))] };
  }
}
// C8 慣性與質量
{
  const am = [], dv = [], ms = [];
  for (let i = 0; i < 20; i++) {
    const run = L("mass-" + i); const r = live(run); const m = run.params.m; ms.push(m);
    const push = r.filter(f => f.t < 1.0 - 1e-9), rel = r.filter(f => f.t >= 1.0);
    am.push(...[...new Set(push.map(f => f.obs.a))].map(a => a * m));
    dv.push(Math.max(...rel.map(f => Math.abs(f.obs.v - rel[0].obs.v))));
  }
  const tb = live(L("release-two-blocks")); const last = tb.filter(f => f.t < 0.5).at(-1);
  R.c8 = { masses: [ms[0], ms.at(-1)], aTimesM: { min: Math.min(...am), max: Math.max(...am), relStd: relStd(am) }, maxDvAfterRelease: Math.max(...dv), twoBlocks: { t: last.t, vA: last.obs.v, vB: last.obs.vB, ratio: last.obs.v / last.obs.vB, expected: 1 / 0.2 } };
}
// C9 桌布 Δv 隨抽出速率下降
{
  const rows = [];
  for (let i = 0; i < 20; i++) {
    const run = L("cloth-v-" + i); const r = live(run); const v = run.params.vCloth; const a = 0.15 * g, Lc = 0.4;
    const ex = (v - Math.sqrt(v * v - 2 * a * Lc)) / a * a; const dv = r.at(-1).obs.dv;
    rows.push({ v: +v.toFixed(4), dv, exact: ex, relErr: Math.abs(dv - ex) / ex, stuck: r.at(-1).obs.stuck });
  }
  let mono = true; for (let i = 1; i < rows.length; i++) if (!(rows[i].dv < rows[i - 1].dv)) mono = false;
  const s5 = live(L("scenario-cloth-impulse")).at(-1).obs;
  R.c9 = { rows, strictlyDecreasing: mono, maxRelErr: Math.max(...rows.map(r => r.relErr)), dv5: s5.dv, dv10: rows.at(-1).dv, J5: s5.J, J10: live(L("cloth-v-19")).at(-1).obs.J };
}
// C10 抽得太慢時物件跟着走
{
  const vc = Math.sqrt(2 * 0.15 * g * 0.4); const rows = [];
  for (let i = -5; i <= 5; i++) { if (i === 0) continue; const run = L("cloth-crit-" + i); const r = live(run); const o = r.at(-1).obs; rows.push({ i, vCloth: run.params.vCloth, stuck: o.stuck, phase: o.phase, vFinal: o.v, relErrVsCloth: Math.abs(o.v - run.params.vCloth) / run.params.vCloth, dtPull: o.dtPull, dv: o.dv, T: o.T }); }
  R.c10 = { vCrit: vc, rows };
}
// C11 Δv 與質量無關
{
  const dv = [], aMax = [], vMax = [], W = [];
  for (let i = 0; i < 20; i++) { const run = L("cloth-m-" + i); const r = live(run); dv.push(r.at(-1).obs.dv); aMax.push(Math.max(...r.filter(f => f.obs.phase <= 1).map(f => Math.abs(f.obs.a)))); vMax.push(Math.max(...r.map(f => f.obs.v))); W.push(r[0].obs.W / run.params.mObj); }
  R.c11 = { dvRelStd: relStd(dv), dvRange: [Math.min(...dv), Math.max(...dv)], maxAOnCloth: Math.max(...aMax), muClothG: 0.15 * g, maxAOnTable: 0.2 * g, vMax: Math.max(...vMax), vCloth: 5, WOverM: [...new Set(W.map(x => +x.toFixed(9)))] };
}
// C12 J = fΔt = mΔv
{
  R.c12 = {};
  for (const n of ["scenario-cloth-impulse", "cloth-v-19", "random-4", "cloth-m-19", "edge-cloth-fast"]) {
    const run = L(n); const r = live(run); const p = run.params; const m = p.mObj ?? 1; const f = p.muCloth * m * p.g;
    const leave = r.find(x => x.obs.phase >= 2); const o = leave.obs;
    R.c12[n] = { m, f, dtPull: o.dtPull, dv: o.dv, J: o.J, fDt: f * o.dtPull, mDv: m * o.dv, errJvsFdt: Math.abs(o.J - f * o.dtPull) / o.J, errJvsMdv: Math.abs(o.J - m * o.dv) / o.J };
  }
}
// C13 巴士不滑的條件
{
  R.c13 = {};
  for (const n of ["bus-mu0.31", "bus-mu0.4"]) { const run = L(n); const r = live(run); R.c13[n] = { muG: run.params.muBus * g, aBus: run.params.aBus, maxAbsSRel: Math.max(...r.map(f => Math.abs(f.obs.sRel))), maxFminusMa: Math.max(...r.map(f => Math.abs(f.obs.f - MP * f.obs.aBusNow))), nHoriz: [...new Set(r.map(f => f.obs.nHoriz))], Fhand: [...new Set(r.map(f => f.obs.Fhand))] }; }
  {
    const run = L("scenario-bus-brake"); const r = live(run); const muG = 0.2 * g;
    const sliding = r.filter(f => f.obs.sliding === 1), brake = r.filter(f => f.obs.busPhase === 2);
    const aOk = Math.max(...sliding.map(f => Math.abs(Math.abs(f.obs.a) - muG)));
    const relMin = Math.min(...brake.map(f => f.obs.v - f.obs.vBus));
    const stopSlide = []; for (let i = 1; i < r.length; i++) if (r[i - 1].obs.sliding === 1 && r[i].obs.sliding === 0) stopSlide.push({ t: r[i].t, v: r[i].obs.v, vBus: r[i].obs.vBus, sRel: r[i].obs.sRel });
    R.c13["scenario-bus-brake"] = { muG, aBus: 3, slidingFrames: sliding.length, maxAbsAminusMuG: aOk, minVminusVbusDuringBrake: relMin, slidingStops: stopSlide, tSlideStopExpected: [10 / muG, 4 + 10 / 3 + 10 / muG], nHoriz: [...new Set(r.map(f => f.obs.nHoriz))], nForces: [...new Set(r.map(f => f.obs.nForces))], sRelMin: Math.min(...r.map(f => f.obs.sRel)), sRelMinExpected: -(0.5 * 3 * (10 / 3) ** 2 + 10 * (10 / muG - 10 / 3) - 0.5 * muG * (10 / muG) ** 2), sRelFinal: r.at(-1).obs.sRel, brakeFrictionSign: [...new Set(brake.map(f => Math.sign(f.obs.f)))] };
  }
  { const run = L("bus-handrail"); const r = live(run); R.c13["bus-handrail"] = { maxAbsSRel: Math.max(...r.map(f => Math.abs(f.obs.sRel))), nHoriz: [...new Set(r.map(f => f.obs.nHoriz))], FhandValues: [...new Set(r.map(f => f.obs.Fhand))], fValues: [...new Set(r.map(f => f.obs.f))], check: [...new Set(r.map(f => +(f.obs.Fhand + f.obs.f - MP * f.obs.aBusNow).toFixed(9)))], tensionArrowsWhenA: [...new Set(r.filter(f => f.obs.aBusNow !== 0).map(f => f.arrows.filter(a => a.kind === "tension").length))] }; }
  { const run = L("scenario-bus-start"); const r = live(run); R.c13["scenario-bus-start"] = { mu: 0, vPassenger: [...new Set(r.map(f => f.obs.v))], sPassenger: [...new Set(r.map(f => f.obs.s))], frictionArrows: [...new Set(r.map(f => f.arrows.filter(a => a.kind === "friction").length))], sRelEnd: r.at(-1).obs.sRel, sBusEnd: r.at(-1).obs.sBus }; }
  { const run = L("bus-mu0.4"); const r = live(run); const start = r.filter(f => f.obs.busPhase === 0); R.c13["bus-mu0.4-start"] = { frictionSign: [...new Set(start.map(f => Math.sign(f.obs.f)))], a: [...new Set(start.map(f => f.obs.a))], sRel: [...new Set(start.map(f => f.obs.sRel))] }; }
}
// C14 沒有虛擬力：所有運行的 kind / label 全集
{
  const kinds = new Set(), labels = new Set(), layers = new Set(); let nHorizBusMax = 0;
  for (const f of fs.readdirSync(E)) { if (!f.endsWith(".json")) continue; const run = L(f.replace(".json", "")); for (const fr of live(run)) { for (const a of fr.arrows) { kinds.add(a.kind); labels.add(a.label); layers.add(a.layer); } if (run.params.scene === "bus" && !run.params.handrail) nHorizBusMax = Math.max(nHorizBusMax, fr.obs.nHoriz); } }
  R.c14 = { kinds: [...kinds], labels: [...labels], layers: [...layers], busNoHandrailMaxNHoriz: nHorizBusMax };
}
// C15 能量：相鄰兩幀（同一相位，f 與 Fapp 不變）ΔKE = (Fapp + f)Δs；無摩擦放手後 KE 漂移
{
  R.c15 = {};
  for (const n of ["default", "scenario-stop-is-friction", "release-1.5", "release-1.5-mu0.05", "scenario-constant-v-zero-net", "edge-table-max", "random-0"]) {
    const run = L(n); const r = live(run); const m = run.params.m; let worst = 0, checked = 0, keScale = 0;
    for (let i = 1; i < r.length; i++) { const a = r[i - 1].obs, b = r[i].obs; if (a.f !== b.f || a.Fapp !== b.Fapp || a.a !== b.a) continue; const dKE = 0.5 * m * (b.v * b.v - a.v * a.v), W = (a.Fapp + a.f) * (b.s - a.s); keScale = Math.max(keScale, 0.5 * m * a.v * a.v); worst = Math.max(worst, Math.abs(dKE - W)); checked++; }
    R.c15[n] = { pairsChecked: checked, maxAbsErr: worst, keScale, relErr: keScale ? worst / keScale : 0 };
  }
  { const r = live(L("release-two-blocks")).filter(f => f.t >= 0.5); const ke = r.map(f => 0.5 * 0.2 * f.obs.v ** 2 + 0.5 * 1 * f.obs.vB ** 2); R.c15.noFrictionKEdrift = Math.max(...ke.map(k => Math.abs(k - ke[0]) / ke[0])); }
  { const r = live(L("scenario-cloth-impulse")); const o = r.at(-1).obs; R.c15.cloth = { KEgained: 0.5 * o.dv ** 2, workByCloth: 1.4715 * (r.find(f => f.obs.phase >= 2).obs.s), slide: o.slide, slideExpected: o.dv ** 2 / (2 * 0.2 * g), workOnTable: 0.2 * g * o.slide }; }
  { const run = L("scenario-bus-brake"); const r = live(run); let worst = 0, scale = 0; for (let i = 1; i < r.length; i++) { const a = r[i - 1].obs, b = r[i].obs; if (a.f !== b.f) continue; worst = Math.max(worst, Math.abs(0.5 * MP * (b.v ** 2 - a.v ** 2) - a.f * (b.s - a.s))); scale = Math.max(scale, 0.5 * MP * a.v ** 2); } R.c15.bus = { maxAbsErr: worst, keScale: scale, relErr: worst / scale }; }
}
// C17 座標約定
{
  const r = live(L("scenario-heavy-not-farther"));
  const w = r[10].arrows.find(a => a.kind === "weight"), v = r[10].arrows.find(a => a.kind === "velocity"), lanes = [...new Set(r[10].arrows.map(a => a.origin[2]))];
  R.c17 = { weightDir: w.vector.map(Math.sign), velocityDirWhenMovingRight: v.vector.map(Math.sign), lanesZ: lanes, laneOfSecondBlock: r[10].arrows.find(a => a.kind === "weight" && a.origin[2] !== 0).origin[2] };
}
fs.writeFileSync(ROOT + "audit/conditions-results.json", JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, (k, v) => (typeof v === "number" ? fmt(v) : v), 1));
