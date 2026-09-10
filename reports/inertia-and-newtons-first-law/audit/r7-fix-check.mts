// 第 7 輪核數員 F1（f布 = 0 時靜止物件被向後移）與停止瞬間幀的修正核實
// 用法：npx tsx --tsconfig tsconfig.app.json reports/inertia-and-newtons-first-law/audit/r7-fix-check.mts
import { model } from "../../../src/sims/inertia-and-newtons-first-law/model";
import { defaults } from "../../../src/sims/inertia-and-newtons-first-law/controls";

const p = { ...defaults, scene: "cloth" as const, fCloth: 0 }; let s = model.init(p); let minS = 0, minSlide = 0;
for (let i = 0; i < 400; i++) { s = model.step(s, p, 0.005); const o = model.observe(s, p); minS = Math.min(minS, o.s); minSlide = Math.min(minSlide, o.slide); }
console.log("cloth f布 = 0：min s", minS, "min slide", minSlide, "phase", s.phase, "v", s.a.v);

let bad = 0, total = 0;
for (const f2 of [0.4, 0.05, 0.25]) for (const dt of [0.005, 0.001]) {
  const q = { ...defaults, scene: "table" as const, f2, push: "on" as const }; let t = model.init(q); let r = q;
  for (let i = 0; i < Math.round(12 / dt); i++) { if (t.a.s >= 0.75 && r.push === "on") r = { ...q, push: "off" }; t = model.step(t, r, dt); const o = model.observe(t, r); total++; if (o.v === 0 && r.push === "off" && (o.f !== 0 || o.a !== 0)) bad++; }
}
console.log("停止瞬間幀 v = 0 而 f ≠ 0 的幀數", bad, "/", total);
