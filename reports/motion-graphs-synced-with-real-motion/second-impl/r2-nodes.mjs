// random-2 專項：s 誤差在各節點附近的變化（判斷主實作是否為逐幀梯形／段內不分割）
import fs from "node:fs";
import { nodeDtOf, observe } from "./model.mjs";
const root = "C:/Users/trevor/dev/dse-physics-lab/reports/motion-graphs-synced-with-real-motion";
const R = JSON.parse(fs.readFileSync(root + "/data/random-2.json", "utf8"));
const p = R.params, A = R.frames, h = nodeDtOf(p.T), vt = p.vt;
console.log("T=", p.T, "nodeDt=", h, "10*nodeDt=", 10 * h, "10*nodeDt===T", 10 * h === p.T);
for (let k = 0; k <= 10; k++) {
  const tk = Math.min(k * h, p.T), i = Math.round(tk / 0.001);
  const lines = [];
  for (const j of [i - 2, i - 1, i, i + 1, i + 2]) {
    if (j < 0 || j >= A.length) continue;
    const f = A[j], m = observe(p, j / 1000);
    lines.push(`   j=${j} t=${f.t.toFixed(6)} a_main=${f.obs.a.toFixed(6)} a_mine=${m.obs.a.toFixed(6)} v_main=${f.obs.v.toFixed(9)} v_exp=${m.obs.v.toFixed(9)} dv=${(f.obs.v - m.obs.v).toExponential(2)} ds=${(f.obs.s - m.obs.s).toExponential(3)}`);
  }
  // 節點落在哪一幀之間；該幀若用梯形，誤差預估 = |Δa|·(θ(1−θ)·dt²/2)... 精確：折線在幀內折一次，梯形誤差 = Δa·dt²·θ·(1−θ)/2 ? 用數值算
  const aL = k >= 1 ? (vt[k] - vt[k - 1]) / h : 0, aR = k < 10 ? (vt[k + 1] - vt[k]) / h : 0;
  const j0 = Math.floor(tk / 0.001), theta = tk / 0.001 - j0; // 節點在幀 [j0, j0+1) 內位置
  // 梯形 vs 精確：幀內 v 折線，梯形面積 − 精確面積 = (aR−aL)·dt²·θ(1−θ)/2 ·(符號)
  const trapErr = (aR - aL) * 1e-6 * theta * (1 - theta) / 2;
  console.log(`node ${k}: t_k=${tk} 幀內位置 θ=${theta.toFixed(4)} aL=${aL.toFixed(4)} aR=${aR.toFixed(4)} 若逐幀梯形的預估跳變=${trapErr.toExponential(3)}`);
  console.log(lines.join("\n"));
}
// s 誤差隨時間：每 0.5 s 抽樣
let prev = 0; const jumps = [];
for (let j = 0; j < A.length && A[j].t < p.T; j++) { const e = A[j].obs.s - observe(p, j / 1000).obs.s; if (Math.abs(e - prev) > 1e-10) jumps.push({ t: A[j].t, from: prev, to: e }); prev = e; }
console.log("s 誤差跳變（|Δ|>1e-10）：", jumps.map(x => `t=${x.t.toFixed(4)} ${x.from.toExponential(2)}→${x.to.toExponential(2)}`).join("; "));
console.log("凍結幀：t=", A[13317].t, "a_main=", A[13317].obs.a, "a_mine=", observe(p, 13.317).obs.a, "v_main=", A[13317].obs.v, "s_main=", A[13317].obs.s, "s_mine=", observe(p, 13.317).obs.s);
