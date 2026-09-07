// 第 4 輪（0.2.2）：E 項複查（observe 讀數為 0 的幀不得有 velocity / acceleration 箭嘴）＋ 0.2.2 對 0.2.0（audit/extra-data-r2 同名運行）的 obs 與箭嘴差異
// ＋ meta 逐鍵值差異（預期只有 Jmax、以及 0.2.1 新增的 muTable / muCloth）＋ 與 e3-results.json（0.2.1）逐項比對。
// 用法：node e4-check.mjs → 印摘要，寫 e4-results.json
import fs from "node:fs";
const ROOT = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/";
const DATA = ROOT + "data/", EXTRA = ROOT + "audit/extra-data-r2/";
const load = f => JSON.parse(fs.readFileSync(f, "utf8"));
const idx = load(DATA + "index.json"), idxX = load(DATA + "index-extra.json");
const laneVel = (o, z) => (o.scene === 4 ? (z === 0 ? o.v : z === 1 ? o.vB : o.vC) : o.scene === 1 ? (z === 0 ? o.v : o.vB) : o.v);
const laneAcc = (o, z) => (o.scene === 1 ? (z === 0 ? o.a : o.aB) : o.a);
const E4 = {}; let totLive = 0, totV0 = 0, totA0 = 0, totBad = 0;
for (const r of [...idx.runs, ...idxX.runs]) {
  const run = load(DATA + r.name + ".json");
  const e = { live: 0, vZeroFrames: 0, vZeroWithArrow: 0, aZeroFrames: 0, aZeroWithArrow: 0, vNonZeroNoArrow: 0, aNonZeroNoArrow: 0, minVelArrowLen: Infinity, minAccArrowLen: Infinity, obsDiffVsR2: null, arrowsDiffVsR2: null, arrowsDiffEx: null, metaKeysNew: null, metaKeysGone: null, metaValueDiff: null, JmaxSet: null };
  const jm = new Set();
  for (const fr of run.frames) {
    if (fr.meta && fr.meta.done === 1) break;
    e.live++;
    if (fr.meta && "Jmax" in fr.meta) jm.add(fr.meta.Jmax);
    const o = fr.obs; const lanes = o.scene === 4 && run.params.trio ? [0, 1, 2] : o.scene === 1 && run.params.second ? [0, 1] : [0];
    for (const z of lanes) {
      const v = laneVel(o, z), a = laneAcc(o, z);
      const va = fr.arrows.filter(x => x.kind === "velocity" && x.origin[2] === z), aa = fr.arrows.filter(x => x.kind === "acceleration" && x.origin[2] === z);
      if (Math.abs(v) < 1e-9) { e.vZeroFrames++; if (va.length) { e.vZeroWithArrow++; e.exV ??= { t: fr.t, z, v, arrow: va[0].vector }; } } else if (va.length !== 1) e.vNonZeroNoArrow++;
      if (Math.abs(a) < 1e-9) { e.aZeroFrames++; if (aa.length) { e.aZeroWithArrow++; e.exA ??= { t: fr.t, z, a, arrow: aa[0].vector }; } } else if (aa.length !== 1) e.aNonZeroNoArrow++;
      for (const x of va) e.minVelArrowLen = Math.min(e.minVelArrowLen, Math.hypot(...x.vector));
      for (const x of aa) e.minAccArrowLen = Math.min(e.minAccArrowLen, Math.hypot(...x.vector));
    }
  }
  e.JmaxSet = [...jm];
  if (run.params.scene === "cloth") { const p = run.params; e.JmaxExpected = (p.mObj ?? 1) * Math.sqrt(2 * p.muCloth * p.g * p.L); }
  if (fs.existsSync(EXTRA + r.name + ".json")) {
    const run2 = load(EXTRA + r.name + ".json");
    const strip = a => a.map(x => ({ kind: x.kind, origin: x.origin, vector: x.vector, label: x.label, layer: x.layer }));
    e.obsDiffVsR2 = 0; e.arrowsDiffVsR2 = 0; e.arrowDiffTs = []; const mv = {};
    for (let i = 0; i < run.frames.length; i++) {
      const A = run.frames[i], B = run2.frames[i]; if (!B) { e.obsDiffVsR2++; continue; }
      if (JSON.stringify(A.obs) !== JSON.stringify(B.obs)) e.obsDiffVsR2++;
      if (JSON.stringify(strip(A.arrows)) !== JSON.stringify(strip(B.arrows))) {
        e.arrowsDiffVsR2++; if (e.arrowDiffTs.length < 3) e.arrowDiffTs.push(+A.t.toFixed(3));
        if (!e.arrowsDiffEx) e.arrowsDiffEx = { t: A.t, r4: A.arrows.map(x => x.kind + "@z" + x.origin[2] + ":" + x.vector[0]), r2: B.arrows.map(x => x.kind + "@z" + x.origin[2] + ":" + x.vector[0]) };
      }
      for (const k of Object.keys(A.meta)) { if (!(k in B.meta)) continue; if (JSON.stringify(A.meta[k]) !== JSON.stringify(B.meta[k])) { mv[k] ??= { frames: 0, ex: [A.t, A.meta[k], B.meta[k]] }; mv[k].frames++; } }
    }
    e.metaKeysNew = Object.keys(run.frames[0].meta).filter(k => !(k in run2.frames[0].meta));
    e.metaKeysGone = Object.keys(run2.frames[0].meta).filter(k => !(k in run.frames[0].meta));
    e.metaValueDiff = mv;
  }
  E4[r.name] = e; totLive += e.live; totV0 += e.vZeroFrames; totA0 += e.aZeroFrames; totBad += e.vZeroWithArrow + e.aZeroWithArrow + e.vNonZeroNoArrow + e.aNonZeroNoArrow;
}
fs.writeFileSync(ROOT + "audit/e4-results.json", JSON.stringify(E4, null, 1));
console.log("=== E 項：讀數 |v| < 1e-9 / |a| < 1e-9 的泳道幀 vs 箭嘴（data/ 25 個運行，0.2.2） ===");
for (const [n, e] of Object.entries(E4)) console.log(n.padEnd(28), `live=${e.live} v0幀=${e.vZeroFrames} 有v箭=${e.vZeroWithArrow} a0幀=${e.aZeroFrames} 有a箭=${e.aZeroWithArrow} v≠0缺箭=${e.vNonZeroNoArrow} a≠0缺箭=${e.aNonZeroNoArrow} 最短v箭=${e.minVelArrowLen === Infinity ? "—" : e.minVelArrowLen.toExponential(2)} 最短a箭=${e.minAccArrowLen === Infinity ? "—" : e.minAccArrowLen.toExponential(2)} | 對0.2.0: obs異=${e.obsDiffVsR2 ?? "無"} 箭異=${e.arrowsDiffVsR2 ?? "無"}${e.arrowDiffTs?.length ? "@" + JSON.stringify(e.arrowDiffTs) : ""} meta新=${JSON.stringify(e.metaKeysNew)} meta刪=${JSON.stringify(e.metaKeysGone)} meta值異=${JSON.stringify(e.metaValueDiff)} Jmax=${JSON.stringify(e.JmaxSet)}${e.JmaxExpected !== undefined ? " 預期=" + e.JmaxExpected : ""}`, e.exV ? "exV=" + JSON.stringify(e.exV) : "", e.exA ? "exA=" + JSON.stringify(e.exA) : "", e.arrowsDiffEx ? "\n    diffEx=" + JSON.stringify(e.arrowsDiffEx) : "");
console.log(`\n合計：有效泳道幀 ${totLive}（運行幀）；v=0 泳道幀 ${totV0}、a=0 泳道幀 ${totA0}；違規 ${totBad}`);
// 與 e3-results.json（0.2.1）逐項比對
const r3 = load(ROOT + "audit/e3-results.json");
console.log("\n=== 對 e3-results（0.2.1）：計數與箭嘴差異例是否相同 ===");
let allSame = true;
for (const [n, e] of Object.entries(E4)) {
  const b = r3[n]; if (!b) { console.log(n, "e3 無此運行"); allSame = false; continue; }
  const keys = ["live", "vZeroFrames", "vZeroWithArrow", "aZeroFrames", "aZeroWithArrow", "vNonZeroNoArrow", "aNonZeroNoArrow", "minVelArrowLen", "minAccArrowLen", "obsDiffVsR2", "arrowsDiffVsR2"];
  const diff = keys.filter(k => JSON.stringify(e[k]) !== JSON.stringify(b[k]));
  const exSame = JSON.stringify(e.arrowsDiffEx?.r4 ?? null) === JSON.stringify(b.arrowsDiffEx?.r3 ?? null) && JSON.stringify(e.arrowsDiffEx?.r2 ?? null) === JSON.stringify(b.arrowsDiffEx?.r2 ?? null);
  if (diff.length || !exSame) allSame = false;
  console.log(n.padEnd(28), diff.length ? "不同鍵=" + JSON.stringify(diff.map(k => [k, e[k], b[k]])) : "相同", exSame ? "" : "箭嘴差異例不同");
}
console.log("全部相同：", allSame);
