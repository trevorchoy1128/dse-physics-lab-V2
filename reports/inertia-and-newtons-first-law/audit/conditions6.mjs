// 第 4 輪（0.2.2 重出的 data/）：與 conditions3.mjs 相同，只改輸入／輸出檔名。
import fs from "node:fs";
const ROOT = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/";
const E = ROOT + "audit/extra-data-r2/", D = ROOT + "data/";
const L = (n, dir = E) => JSON.parse(fs.readFileSync(dir + n + ".json", "utf8"));
const live = run => { const o = []; for (const f of run.frames) { if (f.meta && f.meta.done === 1) break; o.push(f); } return o; };
const MP = 60, g = 9.81;
const relStd = xs => { const m = xs.reduce((a, b) => a + b) / xs.length; return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length) / Math.abs(m); };
const fmt = x => (typeof x === "number" ? (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(2) : +x.toPrecision(7)) : x);
const cnt = (fr, k, z = 0) => fr.arrows.filter(a => a.kind === k && a.origin[2] === z).length;
const uniq = xs => [...new Set(xs)];
const R = {};

// C1 無摩擦、無外力時速度恆定（data/extra-release-smooth、extra-release-two-blocks；1000 s 取樣 long-*）
{
  const r = live(L("extra-release-smooth", D)).filter(f => f.t >= 0.5);
  const r2 = live(L("extra-release-two-blocks", D)).filter(f => f.t >= 0.5);
  const sp = live(L("long-space")), lt = live(L("long-table"));
  R.c1 = { smooth: { window: [r[0].t, r.at(-1).t], frames: r.length, v0: r[0].obs.v, vUnique: uniq(r.map(f => f.obs.v)), drift: Math.max(...r.map(f => Math.abs(f.obs.v - r[0].obs.v) / r[0].obs.v)) },
    twoBlocks: { frames: r2.length, vA: uniq(r2.map(f => f.obs.v)), vB: uniq(r2.map(f => f.obs.vB)) },
    longTable: lt.map(f => [f.t, f.obs.v]), longSpace: sp.map(f => [f.t, f.obs.v, f.obs.vB, f.obs.vC]) };
}
// C2 放手後淨力為零（μ = 0）：data/extra-release-smooth、extra-release-two-blocks
{
  R.c2 = {};
  for (const n of ["extra-release-smooth", "extra-release-two-blocks"]) {
    const r = live(L(n, D)).filter(f => f.t >= 0.5);
    R.c2[n] = { frames: r.length, tRange: [r[0].t, r.at(-1).t], maxFnet: Math.max(...r.map(f => Math.abs(f.obs.Fnet))), maxA: Math.max(...r.map(f => Math.abs(f.obs.a))), maxAB: Math.max(...r.map(f => Math.abs(f.obs.aB ?? 0))),
      netArrows: uniq(r.map(f => f.arrows.filter(a => a.kind === "net").length)), accArrows: uniq(r.map(f => f.arrows.filter(a => a.kind === "acceleration").length)) };
  }
}
// C3 2024 Q3(b)：放手後 applied（kind tension / layer applied）= 0、weight 1、normal 1
{
  R.c3 = {};
  for (const [n, tr] of [["extra-release-smooth", 0.5], ["extra-release-1s", 1.0]]) {
    const r = live(L(n, D)); const before = r.filter(f => f.t < tr - 1e-9), after = r.filter(f => f.t >= tr - 1e-9);
    R.c3[n] = { before: { frames: before.length, applied: uniq(before.map(f => cnt(f, "tension"))), appliedLayer: uniq(before.flatMap(f => f.arrows.filter(a => a.kind === "tension").map(a => a.layer))), nForces: uniq(before.map(f => f.obs.nForces)), nHoriz: uniq(before.map(f => f.obs.nHoriz)) },
      after: { frames: after.length, applied: uniq(after.map(f => cnt(f, "tension"))), weight: uniq(after.map(f => cnt(f, "weight"))), normal: uniq(after.map(f => cnt(f, "normal"))), nForces: uniq(after.map(f => f.obs.nForces)), nHoriz: uniq(after.map(f => f.obs.nHoriz)), Fapp: uniq(after.map(f => f.obs.Fapp)) },
      vAtRelease: { tBefore: before.at(-1).t, vBefore: before.at(-1).obs.v, tAfter: after[0].t, vAfter: after[0].obs.v, metaTRelease: after[0].meta.tRelease } };
  }
  const r2 = live(L("extra-release-two-blocks", D)).filter(f => f.t >= 0.5);
  R.c3.twoBlocks = { applied0: uniq(r2.map(f => cnt(f, "tension", 0))), applied1: uniq(r2.map(f => cnt(f, "tension", 1))), weight0: uniq(r2.map(f => cnt(f, "weight", 0))), weight1: uniq(r2.map(f => cnt(f, "weight", 1))), normal0: uniq(r2.map(f => cnt(f, "normal", 0))), normal1: uniq(r2.map(f => cnt(f, "normal", 1))) };
}
// C4 靜止不等於無力：data/scenario-rest-not-no-force
{
  const r = live(L("scenario-rest-not-no-force", D));
  let magErr = 0, dotErr = 0, nW = new Set(), nN = new Set(), fnet = 0;
  for (const f of r) {
    const w = f.arrows.filter(a => a.kind === "weight"), n = f.arrows.filter(a => a.kind === "normal"); nW.add(w.length); nN.add(n.length);
    const W = Math.hypot(...w[0].vector), N = Math.hypot(...n[0].vector); magErr = Math.max(magErr, Math.abs(W - N) / W);
    const dot = w[0].vector.reduce((s, x, i) => s + x * n[0].vector[i], 0) / (W * N); dotErr = Math.max(dotErr, Math.abs(dot + 1));
    fnet = Math.max(fnet, Math.abs(f.obs.Fnet), ...f.arrows.filter(a => a.kind === "net").map(a => Math.hypot(...a.vector)));
  }
  R.c4 = { frames: r.length, weightArrows: [...nW], normalArrows: [...nN], magRelErr: magErr, dotPlus1: dotErr, maxFnet: fnet, W: r[0].obs.W, N: r[0].obs.N, nForces: uniq(r.map(f => f.obs.nForces)), v: uniq(r.map(f => f.obs.v)), kinds: uniq(r.flatMap(f => f.arrows.map(a => a.kind))) };
}
// C5 靜止時外力不超過 μmg 則不動（μmg = 0.3924）
{
  R.c5 = {};
  for (const F of [0.3, 0.39, 0.3924, 0.3925, 0.4]) {
    const r = live(L("static-F" + F));
    R.c5["F=" + F] = { mumg: 0.2 * 0.2 * g, a: uniq(r.map(f => f.obs.a)).map(fmt), f: uniq(r.map(f => f.obs.f)).map(fmt), vEnd: r.at(-1).obs.v, sEnd: r.at(-1).obs.s, aExpected: F > 0.3924 ? (F - 0.3924) / 0.2 : 0 };
  }
}
// C6 施力等於摩擦則勻速
{
  const r = live(L("scenario-constant-v-zero-net", D)); const rough = r.filter(f => f.obs.s >= 0.75);
  const vs = rough.map(f => f.obs.v);
  R.c6 = { F: 1, mumg: 0.2 * 0.5 * 10, roughFrames: rough.length, tRange: [rough[0].t, rough.at(-1).t], maxFnet: Math.max(...rough.map(f => Math.abs(f.obs.Fnet))), vMin: Math.min(...vs), vMax: Math.max(...vs), vExpected: Math.sqrt(2 * 2 * 0.75), f: uniq(rough.map(f => f.obs.f)), Fapp: uniq(rough.map(f => f.obs.Fapp)), netArrows: uniq(rough.map(f => f.arrows.filter(a => a.kind === "net").length)),
    arrowsEqualOpposite: uniq(rough.map(f => { const t = f.arrows.find(a => a.kind === "tension"), fr = f.arrows.find(a => a.kind === "friction"); return t && fr ? t.vector[0] + fr.vector[0] : NaN; })) };
}
// C7 粗糙面上的減速與解析解比較：data/extra-release-1s（t = 1.0 s 放手，s = 0.75 已在粗糙段）、r2 release-1.5、release-1.5-mu0.05
{
  R.c7 = {};
  for (const [n, mu, tr, dir] of [["extra-release-1s", 0.2, 1.0, D], ["release-1.5", 0.2, 1.5, E], ["release-1.5-mu0.05", 0.05, 1.5, E]]) {
    const r = live(L(n, dir)); const after = r.filter(f => f.t >= tr - 1e-9); const v0 = after[0].obs.v, s0 = after[0].obs.s;
    const moving = after.filter(f => f.obs.v > 0);
    const aErr = Math.max(...moving.map(f => Math.abs(f.obs.a + mu * g) / (mu * g)));
    const stopped = after.filter(f => f.obs.v === 0);
    const d = stopped[0].obs.s - s0, dExp = v0 * v0 / (2 * mu * g);
    R.c7[n] = { mu, v0, s0, aErr, tStop: stopped[0].t, tStopExpected: tr + v0 / (mu * g), slide: d, slideExpected: dExp, slideRelErr: Math.abs(d - dExp) / dExp, vMinAfter: Math.min(...after.map(f => f.obs.v)), frictionAfterStop: uniq(stopped.map(f => f.obs.f)), frictionArrowsAfterStop: uniq(stopped.map(f => cnt(f, "friction"))), nForcesAfterStop: uniq(stopped.map(f => f.obs.nForces)) };
  }
}
// C8 慣性與質量
{
  const am = [], dv = [], ms = [];
  for (let i = 0; i < 20; i++) {
    const run = L("mass-" + i); const r = live(run); const m = run.params.m; ms.push(m);
    const push = r.filter(f => f.t < 1.0 - 1e-9), rel = r.filter(f => f.t >= 1.0 - 1e-9);
    am.push(...uniq(push.map(f => f.obs.a)).map(a => a * m));
    dv.push(Math.max(...rel.map(f => Math.abs(f.obs.v - rel[0].obs.v))));
  }
  const tb = live(L("extra-release-two-blocks", D)); const last = tb.filter(f => f.t < 0.5 - 1e-9).at(-1); const after = tb.filter(f => f.t >= 0.5 - 1e-9);
  R.c8 = { masses: [ms[0], ms.at(-1)], aTimesM: { min: Math.min(...am), max: Math.max(...am), relStd: relStd(am) }, maxDvAfterRelease: Math.max(...dv),
    twoBlocks: { t: last.t, vA: last.obs.v, vB: last.obs.vB, ratio: last.obs.v / last.obs.vB, expected: 1 / 0.2, aA: uniq(tb.filter(f => f.t < 0.5 - 1e-9).map(f => f.obs.a)), aB: uniq(tb.filter(f => f.t < 0.5 - 1e-9).map(f => f.obs.aB)), afterVA: uniq(after.map(f => f.obs.v)), afterVB: uniq(after.map(f => f.obs.vB)) } };
}
// C9 桌布 Δv 隨抽出速率下降
{
  const rows = [];
  for (let i = 0; i < 20; i++) {
    const run = L("cloth-v-" + i); const r = live(run); const v = run.params.vCloth; const a = 0.15 * g, Lc = 0.4;
    const ex = v - Math.sqrt(v * v - 2 * a * Lc); const dv = r.at(-1).obs.dv;
    rows.push({ v: +v.toFixed(4), dv, exact: ex, relErr: Math.abs(dv - ex) / ex, stuck: r.at(-1).obs.stuck });
  }
  let mono = true; for (let i = 1; i < rows.length; i++) if (!(rows[i].dv < rows[i - 1].dv)) mono = false;
  const s5 = live(L("scenario-cloth-impulse", D)).at(-1).obs;
  R.c9 = { rows, strictlyDecreasing: mono, maxRelErr: Math.max(...rows.map(r => r.relErr)), dv5: s5.dv, dv10: rows.at(-1).dv, J5: s5.J, J10: live(L("cloth-v-19")).at(-1).obs.J, dt5: s5.dtPull };
}
// C10 抽得太慢時物件跟着走：data/extra-cloth-stuck（1.0）、extra-cloth-critical-above（1.2）；r2 cloth-crit-±1…5
{
  const vc = Math.sqrt(2 * 0.15 * g * 0.4); const a = 0.15 * g; const rows = [];
  const one = (run, tag) => { const r = live(run); const o = r.at(-1).obs; const vC = run.params.vCloth;
    const catchT = vC / a; const exDv = vC * vC > 2 * a * 0.4 ? vC - Math.sqrt(vC * vC - 2 * a * 0.4) : NaN;
    const firstStuck = r.find(f => f.obs.stuck === 1);
    return { tag, vCloth: vC, stuck: o.stuck, phase: o.phase, vFinal: o.v, relErrVsCloth: Math.abs(o.v - vC) / vC, dtPull: o.dtPull, dtPullExpected: o.stuck ? catchT : exDv / a, dv: o.dv, dvExpected: o.stuck ? vC : exDv, J: o.J, JExpected: o.stuck ? 1 * vC : exDv, T: o.T,
      tFirstStuck: firstStuck ? firstStuck.t : null, vMax: Math.max(...r.map(f => f.obs.v)), fAfterStuck: firstStuck ? uniq(r.filter(f => f.obs.stuck === 1).map(f => f.obs.f)) : null, dtPullUnique: firstStuck ? uniq(r.filter(f => f.obs.stuck === 1).map(f => f.obs.dtPull)) : null, sMinusSCloth: firstStuck ? Math.max(...r.filter(f => f.obs.stuck === 1).map(f => Math.abs((f.obs.s - f.obs.sCloth) - (firstStuck.obs.s - firstStuck.obs.sCloth)))) : null }; };
  rows.push(one(L("extra-cloth-stuck", D), "data/extra-cloth-stuck"), one(L("extra-cloth-critical-above", D), "data/extra-cloth-critical-above"));
  for (let i = -5; i <= 5; i++) { if (i === 0) continue; rows.push(one(L("cloth-crit-" + i), "r2/cloth-crit-" + i)); }
  R.c10 = { vCrit: vc, rows };
}
// C11 Δv 與質量無關
{
  const dv = [], aMax = [], vMax = [], W = [];
  for (let i = 0; i < 20; i++) { const run = L("cloth-m-" + i); const r = live(run); dv.push(r.at(-1).obs.dv); aMax.push(Math.max(...r.filter(f => f.obs.phase <= 1).map(f => Math.abs(f.obs.a)))); vMax.push(Math.max(...r.map(f => f.obs.v))); W.push(r[0].obs.W / run.params.mObj); }
  R.c11 = { dvRelStd: relStd(dv), dvRange: [Math.min(...dv), Math.max(...dv)], maxAOnCloth: Math.max(...aMax), muClothG: 0.15 * g, maxAOnTable: 0.2 * g, vMax: Math.max(...vMax), vCloth: 5, WOverM: uniq(W.map(x => +x.toFixed(9))) };
}
// C12 J = fΔt = mΔv（含卡住分支：J = m v布 = f·tStuck）
{
  R.c12 = {};
  for (const [n, dir] of [["scenario-cloth-impulse", D], ["extra-cloth-critical-above", D], ["extra-cloth-stuck", D], ["random-4", D], ["cloth-v-19", E], ["cloth-m-19", E], ["edge-cloth-fast", E]]) {
    const run = L(n, dir); const r = live(run); const p = run.params; const m = p.mObj ?? 1; const f = p.muCloth * m * p.g;
    const o = r.at(-1).obs;
    R.c12[n] = { m, f, stuck: o.stuck, dtPull: o.dtPull, dv: o.dv, J: o.J, fDt: f * o.dtPull, mDv: m * o.dv, errJvsFdt: Math.abs(o.J - f * o.dtPull) / o.J, errJvsMdv: Math.abs(o.J - m * o.dv) / o.J };
  }
}
// C13 巴士不滑的條件
{
  R.c13 = {};
  for (const n of ["bus-mu0.31", "bus-mu0.4"]) { const run = L(n); const r = live(run); R.c13[n] = { muG: run.params.muBus * g, aBus: run.params.aBus, maxAbsSRel: Math.max(...r.map(f => Math.abs(f.obs.sRel))), maxFminusMa: Math.max(...r.map(f => Math.abs(f.obs.f - MP * f.obs.aBusNow))), nHoriz: uniq(r.map(f => f.obs.nHoriz)), Fhand: uniq(r.map(f => f.obs.Fhand)), sliding: uniq(r.map(f => f.obs.sliding)) }; }
  {
    const run = L("scenario-bus-brake", D); const r = live(run); const muG = 0.2 * g;
    const sliding = r.filter(f => f.obs.sliding === 1), brake = r.filter(f => f.obs.busPhase === 2);
    const aOk = Math.max(...sliding.map(f => Math.abs(Math.abs(f.obs.a) - muG)));
    const relMin = Math.min(...brake.map(f => f.obs.v - f.obs.vBus));
    const stopSlide = []; for (let i = 1; i < r.length; i++) if (r[i - 1].obs.sliding === 1 && r[i].obs.sliding === 0) stopSlide.push({ t: r[i].t, v: r[i].obs.v, vBus: r[i].obs.vBus, sRel: r[i].obs.sRel });
    const fwdArrowsBrake = brake.filter(f => f.arrows.some(a => ["friction", "tension", "net"].includes(a.kind) && a.vector[0] > 0)).length;
    R.c13["scenario-bus-brake"] = { muG, aBus: 3, slidingFrames: sliding.length, slidingAtT0: r[0].obs.sliding, maxAbsAminusMuG: aOk, minVminusVbusDuringBrake: relMin, slidingStops: stopSlide, tSlideStopExpected: [10 / muG, 4 + 10 / 3 + 10 / muG], nHoriz: uniq(r.map(f => f.obs.nHoriz)), nForces: uniq(r.map(f => f.obs.nForces)), sRelMin: Math.min(...r.map(f => f.obs.sRel)), sRelMinExpected: -(0.5 * 3 * (10 / 3) ** 2 + 10 * (10 / muG - 10 / 3) - 0.5 * muG * (10 / muG) ** 2), sRelFinal: r.at(-1).obs.sRel, brakeFrictionSign: uniq(brake.map(f => Math.sign(f.obs.f))), brakeFramesWithForwardHorizontalArrow: fwdArrowsBrake, kindsOnPassenger: uniq(r.flatMap(f => f.arrows.map(a => a.kind))) };
  }
  { const run = L("extra-bus-handrail", D); const r = live(run); const cap = 0.2 * MP * g;
    R.c13["extra-bus-handrail"] = { cap, maxAbsSRel: Math.max(...r.map(f => Math.abs(f.obs.sRel))), maxAbsVminusVbus: Math.max(...r.map(f => Math.abs(f.obs.v - f.obs.vBus))), nHoriz: uniq(r.map(f => f.obs.nHoriz)), FhandValues: uniq(r.map(f => f.obs.Fhand)), fValues: uniq(r.map(f => f.obs.f)), sumCheck: uniq(r.map(f => +(f.obs.Fhand + f.obs.f - MP * f.obs.aBusNow).toFixed(9))), fWithinCap: r.every(f => Math.abs(f.obs.f) <= cap + 1e-9), fAtCapWhenAccel: uniq(r.filter(f => f.obs.aBusNow !== 0).map(f => Math.abs(f.obs.f))), tensionArrowsWhenA: uniq(r.filter(f => f.obs.aBusNow !== 0).map(f => f.arrows.filter(a => a.kind === "tension").length)), tensionArrowsCruise: uniq(r.filter(f => f.obs.aBusNow === 0).map(f => f.arrows.filter(a => a.kind === "tension").length)), tensionLabel: uniq(r.flatMap(f => f.arrows.filter(a => a.kind === "tension").map(a => a.label + "/" + a.layer))), sliding: uniq(r.map(f => f.obs.sliding)), aEqualsBus: Math.max(...r.map(f => Math.abs(f.obs.a - f.obs.aBusNow))) }; }
  { const run = L("extra-bus-mu0", D); const r = live(run); R.c13["extra-bus-mu0"] = { mu: 0, vPassenger: uniq(r.map(f => f.obs.v)), sPassenger: uniq(r.map(f => f.obs.s)), frictionArrows: uniq(r.map(f => f.arrows.filter(a => a.kind === "friction").length)), horizArrows: uniq(r.map(f => f.arrows.filter(a => ["friction", "tension", "net"].includes(a.kind)).length)), nHoriz: uniq(r.map(f => f.obs.nHoriz)), sRelEnd: r.at(-1).obs.sRel, sBusEnd: r.at(-1).obs.sBus, sBusExpected: 3 * (10 / 3) ** 2 + 40 }; }
  { const run = L("bus-mu0.4"); const r = live(run); const start = r.filter(f => f.obs.busPhase === 0); R.c13["bus-mu0.4-start"] = { frictionSign: uniq(start.map(f => Math.sign(f.obs.f))), a: uniq(start.map(f => f.obs.a)), sRel: uniq(start.map(f => f.obs.sRel)) }; }
  { const run = L("scenario-bus-brake", D); const r = live(run); R.c13.slidingFlag = { first: r.slice(0, 3).map(f => [f.t, f.obs.sliding, f.obs.a]), atCatchStart: r.filter(f => f.t > 5.05 && f.t < 5.15).map(f => [f.t, f.obs.sliding, +(f.obs.v - f.obs.vBus).toFixed(6)]) }; }
}
// C14 沒有虛擬力：data/ 25 個 + r2 111 個運行的 kind / label / layer 全集
{
  const kinds = new Set(), labels = new Set(), layers = new Set(); let nHorizBusMax = 0, nRuns = 0, nFrames = 0;
  const scan = (dir, names) => { for (const n of names) { const run = L(n, dir); nRuns++; for (const fr of live(run)) { nFrames++; for (const a of fr.arrows) { kinds.add(a.kind); labels.add(a.label); layers.add(a.layer); } if (run.params.scene === "bus" && !run.params.handrail) nHorizBusMax = Math.max(nHorizBusMax, fr.obs.nHoriz); } } };
  scan(D, [...L("index", D).runs, ...L("index-extra", D).runs].map(r => r.name));
  scan(E, fs.readdirSync(E).filter(f => f.endsWith(".json")).map(f => f.replace(".json", "")));
  R.c14 = { runs: nRuns, liveFrames: nFrames, kinds: [...kinds], labels: [...labels], layers: [...layers], busNoHandrailMaxNHoriz: nHorizBusMax };
}
// C15 能量
{
  R.c15 = {};
  for (const [n, dir] of [["default", D], ["scenario-stop-is-friction", D], ["extra-release-1s", D], ["release-1.5", E], ["release-1.5-mu0.05", E], ["scenario-constant-v-zero-net", D], ["edge-table-max", E], ["random-0", D]]) {
    const run = L(n, dir); const r = live(run); const m = run.params.m; let worst = 0, checked = 0, keScale = 0;
    for (let i = 1; i < r.length; i++) { const a = r[i - 1].obs, b = r[i].obs; if (a.f !== b.f || a.Fapp !== b.Fapp || a.a !== b.a) continue; const dKE = 0.5 * m * (b.v * b.v - a.v * a.v), W = (a.Fapp + a.f) * (b.s - a.s); keScale = Math.max(keScale, 0.5 * m * a.v * a.v); worst = Math.max(worst, Math.abs(dKE - W)); checked++; }
    R.c15[n] = { pairsChecked: checked, maxAbsErr: worst, keScale, relErr: keScale ? worst / keScale : 0 };
  }
  { const r = live(L("extra-release-two-blocks", D)).filter(f => f.t >= 0.5); const ke = r.map(f => 0.5 * 0.2 * f.obs.v ** 2 + 0.5 * 1 * f.obs.vB ** 2); R.c15.noFrictionKEdrift = Math.max(...ke.map(k => Math.abs(k - ke[0]) / ke[0])); }
  { const r = live(L("scenario-cloth-impulse", D)); const o = r.at(-1).obs; const lv = r.find(f => f.obs.phase >= 2).obs; R.c15.cloth = { KEgained: 0.5 * o.dv ** 2, workByCloth: 0.15 * g * lv.s, slide: o.slide, slideExpected: o.dv ** 2 / (2 * 0.2 * g), workOnTable: 0.2 * g * o.slide }; }
  { const run = L("scenario-bus-brake", D); const r = live(run); let worst = 0, scale = 0; for (let i = 1; i < r.length; i++) { const a = r[i - 1].obs, b = r[i].obs; if (a.f !== b.f) continue; worst = Math.max(worst, Math.abs(0.5 * MP * (b.v ** 2 - a.v ** 2) - a.f * (b.s - a.s))); scale = Math.max(scale, 0.5 * MP * a.v ** 2); } R.c15.bus = { maxAbsErr: worst, keScale: scale, relErr: worst / scale }; }
}
// C16 由 independent2 的 arrows 結果匯總
{
  const ind = JSON.parse(fs.readFileSync(ROOT + "audit/independent-results-r6.json", "utf8"));
  const agg = { runs: 0, netSumErr: 0, aVsFnet: 0, weightErr: 0, normalErr: 0, frictionErr: 0, appliedErr: 0, velErr: 0, accErr: 0, presence: 0, frictionDir: 0, scaleBad: 0, badKind: 0, pseudo: 0, offAxis: 0, laneBad: 0, appliedWhileZero: 0, worstRun: {} };
  for (const [n, r] of Object.entries(ind.arrows)) { agg.runs++; for (const k of ["netSumErr", "aVsFnet", "weightErr", "normalErr", "frictionErr", "appliedErr", "velErr", "accErr"]) if (r[k] > agg[k]) { agg[k] = r[k]; agg.worstRun[k] = n; } agg.presence += r.presence.length; agg.frictionDir += r.frictionDir; agg.scaleBad += r.scaleBad; agg.badKind += r.badKind; agg.pseudo += r.pseudoLabel; agg.offAxis += r.offAxis; agg.laneBad += r.laneBad; agg.appliedWhileZero += r.appliedCount.off; if (r.presence.length) agg.worstRun["presence:" + n] = r.presence[0]; }
  R.c16 = agg;
}
// C17 座標約定
{
  const r = live(L("scenario-heavy-not-farther", D));
  const w = r[10].arrows.find(a => a.kind === "weight"), v = r[10].arrows.find(a => a.kind === "velocity"), lanes = uniq(r[10].arrows.map(a => a.origin[2]));
  const bus = live(L("scenario-bus-brake", D)); const brk = bus.find(f => f.obs.busPhase === 2); const fr = brk.arrows.find(a => a.kind === "friction");
  R.c17 = { weightDir: w.vector.map(Math.sign), velocityDirWhenMovingRight: v.vector.map(Math.sign), lanesZ: lanes, laneOfSecondBlock: r[10].arrows.find(a => a.kind === "weight" && a.origin[2] !== 0).origin[2], busBrakeFrictionDir: fr.vector.map(Math.sign) };
}
fs.writeFileSync(ROOT + "audit/conditions-results-r6.json", JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, (k, v) => (typeof v === "number" ? fmt(v) : v), 1));
