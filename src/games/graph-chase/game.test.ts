import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { A_STEP, DT, TOL, durationOf, newRun, play, quantA, score, step, targetA, targetS, targetV, v0Of, type Level, type Run } from "./game";

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
