import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { A_STEP, DT, MAX_CATCHUP, TOL, advance, durationOf, newRun, nextCorner, play, quantA, score, step, targetA, targetS, targetV, v0Of, type Level, type Run } from "./game";

// ---- 策略（模擬不同水平的學生）----
const perfect = (L: Level) => (t: number) => targetA(L, t);                  // 每個轉折點即時撥桿
const lazy = () => () => 0;                                                   // 放着不管
/** 反應慢 lag 秒，但懂得追回：按 lag 秒前看到的情況（目標斜率 + 自己與目標線的差距）撥桿 */
const catchUp = (L: Level, lag: number, k = 1.5) => (t: number, run: Run) => {
  const tSeen = Math.max(0, t - lag), vSeen = run.vs[Math.round(tSeen / DT)];
  return targetA(L, tSeen) + k * (targetV(L, tSeen) - vSeen);
};

describe("目標線：折線插值、斜率、線下面積", () => {
  const L = LEVELS.find(l => l.id === "start")!;   // (0,0)→(4,8)→(10,8)
  it("v 插值與斜率（右連續）", () => {
    expect(targetV(L, 0)).toBe(0); expect(targetV(L, 2)).toBe(4); expect(targetV(L, 4)).toBe(8); expect(targetV(L, 7)).toBe(8);
    expect(targetA(L, 0)).toBe(2); expect(targetA(L, 3.99)).toBe(2); expect(targetA(L, 4)).toBe(0); expect(targetA(L, 10)).toBe(0);
    expect(targetV(L, 99)).toBe(8);   // 超出時長取末值
  });
  it("線下面積：三角形 + 矩形", () => {
    expect(targetS(L, 4)).toBeCloseTo(16, 9);            // ½ × 4 × 8
    expect(targetS(L, 10)).toBeCloseTo(16 + 6 * 8, 9);
    expect(targetS(L, 2)).toBeCloseTo(0.5 * 2 * 4, 9);
  });
  it("去而復返：軸上與軸下面積抵消，總位移 0", () => {
    const R = LEVELS.find(l => l.id === "roundtrip")!;
    expect(targetS(R, 5)).toBeCloseTo(9 + 12, 9);
    expect(targetS(R, durationOf(R))).toBeCloseTo(0, 9);
  });
  it("油門桿格點：0.5 為一格，夾在 ±aMax，無 −0", () => {
    expect(quantA(0.74, L)).toBe(0.5); expect(quantA(0.76, L)).toBe(1); expect(quantA(9, L)).toBe(L.aMax); expect(quantA(-9, L)).toBe(-L.aMax);
    expect(Object.is(quantA(-0.1, L), -0)).toBe(false);
  });
});

describe("積分：恆加速度一步精確，完美策略完全貼線", () => {
  it("v = u + at，s = ut + ½at²（單步與多步）", () => {
    const L = LEVELS.find(l => l.id === "start")!;
    const run = newRun(L);
    for (let i = 0; i < 200; i++) step(L, run, 2);   // 2 s，a = 2
    expect(run.t).toBeCloseTo(2, 12); expect(run.v).toBeCloseTo(4, 9); expect(run.s).toBeCloseTo(0.5 * 2 * 4, 9);
  });
  it("到終點後不再走，回傳 true", () => {
    const L = LEVELS[0]; const run = play(L, lazy());
    expect(run.t).toBe(durationOf(L)); expect(step(L, run, 1)).toBe(true); expect(run.t).toBe(durationOf(L));
    expect(run.n).toBe(Math.round(durationOf(L) / DT)); expect(run.ts.length).toBe(run.n + 1);
  });
  for (const L of LEVELS) {
    it(`${L.id}：完美策略的 v 與 s 全程與目標一致（誤差 < 10⁻⁶）`, () => {
      const run = play(L, perfect(L));
      for (let k = 0; k < run.ts.length; k += 7) { expect(Math.abs(run.vs[k] - targetV(L, run.ts[k]))).toBeLessThan(1e-6); expect(Math.abs(run.ss[k] - targetS(L, run.ts[k]))).toBeLessThan(1e-6); }
      expect(score(L, run).gap).toBeCloseTo(0, 6);
    });
  }
});

describe("追上真實時間（畫面的 rAF 迴圈用）", () => {
  const L = LEVELS.find(l => l.id === "start")!;
  it("幀率低（1 fps）也追上牆鐘：2.5 s 後 v = 5", () => {
    const run = newRun(L);
    for (const w of [1, 2, 2.5]) { const r = advance(L, run, w, 2); expect(r.done).toBe(false); expect(r.skipped).toBe(0); expect(run.t).toBeCloseTo(w, 9); }
    expect(run.v).toBeCloseTo(5, 9);
    advance(L, run, 2.5 + 0.016, 2); expect(run.t).toBeCloseTo(2.52, 9);   // 60 fps 一幀走 1–2 步
  });
  it("相隔超過 MAX_CATCHUP（分頁曾被隱藏）：只走一步並回報略過的秒數", () => {
    const run = newRun(L); advance(L, run, 1, 0);
    const r = advance(L, run, 1 + MAX_CATCHUP + 30, 0);
    expect(run.t).toBeCloseTo(1.01, 9); expect(r.skipped).toBeCloseTo(MAX_CATCHUP + 30 - DT, 9); expect(r.done).toBe(false);
  });
  it("轉折點自動暫停：走到 stopAt 就停，回報 stopped；再給下一個 stopAt 才繼續", () => {
    const run = newRun(L);   // 轉折點 t = 4
    expect(nextCorner(L, 0)).toBe(4); expect(nextCorner(L, 4)).toBe(null); expect(nextCorner(L, 3.99)).toBe(4);
    let r = advance(L, run, 1, 2, 4); expect(r.stopped).toBe(false); expect(run.t).toBeCloseTo(1, 9);
    for (const w of [2, 3, 4.3]) r = advance(L, run, w, 2, 4);
    expect(r.stopped).toBe(true); expect(r.done).toBe(false); expect(run.t).toBeCloseTo(4, 9); expect(run.v).toBeCloseTo(8, 9);
    r = advance(L, run, 5, 0, 4); expect(run.t).toBeCloseTo(4, 9); expect(r.stopped).toBe(true);    // 未按繼續：不動
    r = advance(L, run, 5, 0, nextCorner(L, run.t) ?? undefined); expect(run.t).toBeCloseTo(5, 9); expect(r.stopped).toBe(false);
  });
  it("每關的轉折點都在 nextCorner 序列內，逐個停下再走可到終點", () => {
    for (const Lv of LEVELS) {
      const run = newRun(Lv); let w = 0, done = false, stops = 0;
      while (!done) { w += 0.5; const r = advance(Lv, run, w, targetA(Lv, run.t), nextCorner(Lv, run.t) ?? undefined); done = r.done; if (r.stopped) { stops++; w = run.t; } expect(w).toBeLessThan(200); }
      expect(stops).toBe(Lv.points.length - 2); expect(score(Lv, run).stars).toBe(3);
    }
  });
  it("走到終點回報 done，之後不再走", () => {
    const run = newRun(L); let w = 0, done = false;
    while (!done) { w += 1; done = advance(L, run, w, 0).done; expect(w).toBeLessThan(12); }
    expect(w).toBe(10); expect(run.t).toBe(10);
    expect(advance(L, run, 11, 0).done).toBe(true); expect(run.t).toBe(10);
  });
});

describe("每關有解，且不是放着就過", () => {
  for (const L of LEVELS) {
    const T = durationOf(L);
    it(`${L.id}：目標線合法（t 由 0 遞增、每段斜率是 ${A_STEP} 的倍數且 ≤ aMax、v 在軸範圍內）`, () => {
      expect(L.points[0][0]).toBe(0); expect(T).toBeGreaterThan(0);
      for (let i = 1; i < L.points.length; i++) expect(L.points[i][0]).toBeGreaterThan(L.points[i - 1][0]);
      for (let i = 0; i < L.points.length - 1; i++) {
        const a = (L.points[i + 1][1] - L.points[i][1]) / (L.points[i + 1][0] - L.points[i][0]);
        expect(Math.abs(a / A_STEP - Math.round(a / A_STEP))).toBeLessThan(1e-9);
        expect(Math.abs(a)).toBeLessThanOrEqual(L.aMax);
        expect(Math.abs(L.points[i][0] / DT - Math.round(L.points[i][0] / DT))).toBeLessThan(1e-9);   // 轉折點落在步長格點上
      }
      for (const [, v] of L.points) { expect(v).toBeLessThanOrEqual(L.vMax); expect(v).toBeGreaterThanOrEqual(L.vMin); }
      expect(v0Of(L)).toBe(L.points[0][1]);
    });
    it(`${L.id}：完美策略三星；反應慢 0.3 s 但懂得追回也三星；慢 0.5 s 至少兩星`, () => {
      expect(score(L, play(L, perfect(L))).stars).toBe(3);
      expect(score(L, play(L, catchUp(L, 0.3))).stars).toBe(3);
      expect(score(L, play(L, catchUp(L, 0.5))).stars).toBeGreaterThanOrEqual(2);
    });
    if (L.id !== "cruise") {
      it(`${L.id}：放着不管（a = 0）過不了關`, () => { expect(score(L, play(L, lazy())).stars).toBe(0); });
    }
  }
  it("cruise（反差關）：放着不管正是答案；以為要踩油門（a = 1）就出帶", () => {
    const L = LEVELS.find(l => l.id === "cruise")!;
    expect(score(L, play(L, lazy())).stars).toBe(3);
    const r = score(L, play(L, () => 1));
    expect(r.stars).toBe(0); expect(r.maxErr).toBeGreaterThan(TOL);
  });
  it("星數門檻：帶內比例 0.9 / 0.7 / 0.5", () => {
    const L = LEVELS.find(l => l.id === "start")!;
    // 只在最後一段出帶：貼線到 t₁，之後 a = 4 衝出去
    const fracAfter = (t1: number) => score(L, play(L, t => (t < t1 ? targetA(L, t) : 4))).fraction;
    expect(fracAfter(9.5)).toBeGreaterThan(0.9); expect(score(L, play(L, t => (t < 9.5 ? targetA(L, t) : 4))).stars).toBe(3);
    expect(fracAfter(7.5)).toBeLessThan(0.9); expect(fracAfter(7.5)).toBeGreaterThan(0.7);
  });
});
