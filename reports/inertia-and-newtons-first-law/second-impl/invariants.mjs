// 第 8 輪新增：兩個規格沒列但物理上必然的檢查，對「主實作 data/<run>.json」與「第二實作 second-impl/<run>.json」
// 的 26 個運行逐幀同時施加（兩邊都要過，不是只查自己）。只用 observe 的鍵，不碰 src。
//
// 檢查 A「v_rel = 0 的幀，摩擦不得為滑動值」——§7「相對靜止：|F_需| ≤ f 則摩擦 = −F_需；否則開始滑動（摩擦 = f ≤ |F_需|）」
//   兩個分支都推出 |f| ≤ |F_需|，而且 a = 0 ⇔ f = −F_需。逐情景寫成：
//   情景 1：v = 0 ⇒ |f| ≤ F_app；a = 0 ⇒ f = −F_app；a ≠ 0 ⇒ F_app > |f|（正在起動，摩擦 = 上限）。
//   情景 2：v = 0 ⇒ f ≥ 0（桌面摩擦 −f桌 只在滑動時出現）；v = 0 且 phase ≥ 2 ⇒ f = 0、a = 0。
//   情景 3：v乘 = v車 ⇒ |f| ≤ |m a車|（m = 60 kg）且 sgn f = sgn a車（或 f = 0）；握扶手時 f + F扶 = m a車。
//   情景 4：無摩擦，不適用。
// 檢查 B「f布 = 0 ⇒ 物件 s ≡ 0、slide ≡ 0」——26 個運行沒有 f布 = 0，這裏只對第二實作另跑（見 checks.mjs）；
//   本檔對現有情景 2 運行改查等價的弱形式：抽出前 s ≤ ½(f布/m)t²（1 + 1e-9），且 slide = 0 直至 phase ≥ 2。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
const M_PASS = 60;
const EPS = 1e-9;
const runs = [];
for (const idxName of ["index.json", "index-extra.json"]) {
  const idx = JSON.parse(fs.readFileSync(path.join(dataDir, idxName), "utf8"));
  for (const r of idx.runs) runs.push({ ...r, dt: idx.dt });
}

const rows = [];
let allOk = true;
for (const side of [["主實作", dataDir], ["第二實作", here]]) {
  for (const r of runs) {
    const frames = JSON.parse(fs.readFileSync(path.join(side[1], r.name + ".json"), "utf8")).frames;
    const p = r.params;
    let nRest = 0, bad = [], nB = 0, badB = [];
    for (const fr of frames) {
      const o = fr.obs;
      if (o.scene === 1) {
        if (o.v === 0) {
          nRest++;
          const ok = Math.abs(o.f) <= o.Fapp + EPS && (o.a === 0 ? o.f === -o.Fapp : o.Fapp > Math.abs(o.f) - EPS);
          if (!ok) bad.push({ t: fr.t, v: o.v, f: o.f, Fapp: o.Fapp, a: o.a });
        }
        if (o.vB !== undefined && o.vB === 0) { nRest++; if (!(o.aB >= 0)) bad.push({ t: fr.t, vB: 0, aB: o.aB }); }
      } else if (o.scene === 2) {
        if (o.v === 0) {
          nRest++;
          const ok = o.f >= 0 && (o.phase < 2 || (o.f === 0 && o.a === 0));
          if (!ok) bad.push({ t: fr.t, v: 0, f: o.f, a: o.a, phase: o.phase });
        }
        nB++;
        const aC = p.fCloth / (p.mObj ?? 1);
        const okB = o.phase >= 2 ? true : (o.s <= 0.5 * aC * fr.t * fr.t * (1 + 1e-9) + EPS && o.slide === 0);
        if (!okB) badB.push({ t: fr.t, s: o.s, bound: 0.5 * aC * fr.t * fr.t, slide: o.slide, phase: o.phase });
      } else if (o.scene === 3) {
        if (o.v === o.vBus) {
          nRest++;
          const need = M_PASS * o.aBusNow;
          let ok = Math.abs(o.f) <= Math.abs(need) + EPS && (o.f === 0 || Math.sign(o.f) === Math.sign(need));
          if (p.handrail) ok = ok && Math.abs(o.f + o.Fhand - need) <= EPS;
          if (!ok) bad.push({ t: fr.t, v: o.v, vBus: o.vBus, f: o.f, need, Fhand: o.Fhand });
        }
      }
    }
    const ok = bad.length === 0 && badB.length === 0;
    if (!ok) allOk = false;
    rows.push({ side: side[0], run: r.name, scene: frames[0].obs.scene, nRest, nBad: bad.length, nB, nBadB: badB.length, ok, first: bad[0] ?? badB[0] ?? null });
  }
}
const lines = ["| 實作 | 運行 | 情景 | v_rel = 0 幀數 | 檢查 A 違規幀 | 抽出前幀數 | 檢查 B 違規幀 | 通過 |", "|---|---|---|---|---|---|---|---|"];
for (const w of rows) lines.push(`| ${w.side} | ${w.run} | ${w.scene} | ${w.nRest} | ${w.nBad} | ${w.scene === 2 ? w.nB : "—"} | ${w.scene === 2 ? w.nBadB : "—"} | ${w.ok ? "✓" : "✗ " + JSON.stringify(w.first)} |`);
fs.writeFileSync(path.join(here, "invariants-table.md"), lines.join("\n") + "\n");
console.log("invariants allOk =", allOk, " rows =", rows.length);
for (const w of rows.filter(w => !w.ok)) console.log("FAIL", w.side, w.run, JSON.stringify(w.first));
const tot = rows.reduce((a, w) => a + w.nRest, 0);
console.log("total v_rel = 0 frames checked (both sides):", tot);
