import { describe, it, expect } from "vitest";
import { model, vAt, type P, type S } from "./model";

// 每個 it() 名稱 = 規格「驗證條件」原句。先寫測試，後寫模型。
const DT = 1e-3;
const run = (p: P, T: number, dt = DT) => {
  let s: S = model.init(p); const trace: S[] = [s];
  for (let i = 0; i < Math.round(T / dt); i++) { s = model.step(s, p, dt); trace.push(s); }
  return trace;
};
const live = (u: number, a: number, T = 10): P => ({ mode: "live", u, a, T, vt: Array.from({ length: T + 1 }, () => 0) });
const draw = (vt: number[]): P => ({ mode: "draw", u: 0, a: 0, T: vt.length - 1, vt });

// 由歷史樣本用梯形法算 v–t 線下面積
const areaOf = (hist: { t: number; v: number }[]) => hist.slice(1).reduce((acc, h, i) => acc + 0.5 * (hist[i].v + h.v) * (h.t - hist[i].t), 0);

describe("運動線圖與真實運動同步（S7）", () => {
  it("v–t 圖的線下面積必須等於 s–t 圖上的位移變化（數值比對）", () => {
    for (const p of [live(2, 1.5), live(3, -2), draw([2, 1.6, 1.2, 0.8, 0.4, 0, -0.4, -0.8, -1.2, -1.6, -2]), draw([2, 2, 2, 2, 2, -2, -2, -2, -2, -2, -2])]) {
      const end = run(p, 10).at(-1)!;
      expect(Math.abs(areaOf(end.hist) - end.s)).toBeLessThan(1e-6);
    }
  });

  it("勻加速情況下三條運動方程互相一致", () => {
    const u = 2, a = 1.5, p = live(u, a);
    for (const s of run(p, 6)) {
      if (s.done) break;
      expect(Math.abs(s.v - (u + a * s.t))).toBeLessThan(1e-9);
      expect(Math.abs(s.s - (u * s.t + 0.5 * a * s.t * s.t))).toBeLessThan(1e-9);
      expect(Math.abs(s.v * s.v - (u * u + 2 * a * s.s))).toBeLessThan(1e-8);
    }
  });

  it("位移讀數與路程讀數在物體從未反向時必須相等，反向後必須不等", () => {
    const p = live(3, -2);          // t = 1.5 s 反向
    for (const s of run(p, 4)) {
      if (s.t < 1.5 - 1e-9) expect(Math.abs(s.dist - s.s)).toBeLessThan(1e-9);
      if (s.t > 1.6) { expect(s.dist).toBeGreaterThan(Math.abs(s.s) + 1e-3); }
    }
    const end = run(p, 4).at(-1)!;
    // 解析：反向前走 2.25 m，反向後 4 s 時 s = 3·4 − 4² = −4；路程 = 2.25 + 6.25 = 8.5
    expect(end.s).toBeCloseTo(-4, 6);
    expect(end.dist).toBeCloseTo(8.5, 6);
  });

  it("由圖生成運動：v(t) 等於 v–t 折線的插值，a 等於該段斜率", () => {
    const vt = [0, 1, 3, 3, 0, -2, -2, 1, 1, 0, 0];
    const p = draw(vt);
    for (const s of run(p, 10)) {
      if (s.done) break;
      expect(Math.abs(s.v - vAt(vt, s.t))).toBeLessThan(1e-9);
      const k = Math.min(vt.length - 2, Math.floor(s.t + 1e-9));
      const kInside = Math.abs(s.t - Math.round(s.t)) > 1e-6;   // 節點上斜率不唯一，跳過
      if (kInside) expect(Math.abs(model.observe(s, p).a - (vt[k + 1] - vt[k]))).toBeLessThan(1e-9);
    }
  });

  it("速度為零時加速度仍為設定值（豎直上拋：u = 3，a = −9.81）", () => {
    const p = live(3, -9.81, 5);
    const near = run(p, 1).filter(s => Math.abs(s.v) < 1e-2);
    expect(near.length).toBeGreaterThan(0);
    for (const s of near) expect(model.observe(s, p).a).toBeCloseTo(-9.81, 12);
  });

  it("反向事件只在 v 變號時發生一次", () => {
    const p = live(3, -2);
    let s = model.init(p), n = 0;
    for (let i = 0; i < 4000; i++) { const nx = model.step(s, p, DT); n += model.events!(s, nx, p).filter(e => e.key === "reverse").length; s = nx; }
    expect(n).toBe(1);
  });

  it("到達時間窗 T 後停止，t 不再前進", () => {
    const p = live(1, 0, 5);
    const end = run(p, 7).at(-1)!;
    expect(end.done).toBe(true);
    expect(end.t).toBeLessThanOrEqual(5 + 2 * DT);
    expect(end.s).toBeCloseTo(5, 6);
  });

  it("時間窗末端凍結後，a 讀數保持最後一段的值，與 v = u + aT 一致（核數員 F1）", () => {
    const p = live(3, -9.81, 5);
    const end = run(p, 6).at(-1)!;
    expect(end.done).toBe(true);
    expect(model.observe(end, p).a).toBeCloseTo(-9.81, 12);
    expect(end.v).toBeCloseTo(3 - 9.81 * 5, 6);
    const q = draw([2, 1.6, 1.2, 0.8, 0.4, 0, -0.4, -0.8, -1.2, -1.6, -2]);
    expect(model.observe(run(q, 11).at(-1)!, q).a).toBeCloseTo(-0.4, 9);
  });

  it("歷史樣本與讀數永無 NaN；凍結幀 t 恰等於 T（核數員 F7、第二實作者第 4 輪）", () => {
    for (const p of [draw([2, 1.6, 1.2, 0.8, 0.4, 0, -0.4, -0.8, -1.2, -1.6, -2]), live(3, -9.81, 5), draw([0, 1, 3, 3, 0, -2])]) {
      const end = run(p, p.T + 1, 1e-3).at(-1)!;
      expect(end.done).toBe(true);
      expect(end.t).toBe(p.T);
      for (const h of end.hist) for (const k of ["t", "s", "v", "a"] as const) expect(Number.isFinite(h[k])).toBe(true);
      const o = model.observe(end, p);
      for (const k of Object.keys(o)) expect(Number.isFinite(o[k])).toBe(true);
    }
    // dt 不整除 T：末步截斷，t 仍恰為 T
    const p = live(1, 0, 5); const end = run(p, 5.4, 0.0007).at(-1)!;
    expect(end.t).toBe(5); expect(end.s).toBeCloseTo(5, 9);
  });

  it("對稱往返後位移的捨入殘餘顯示為 0（核數員 F6）", () => {
    const p = draw([2, 1.6, 1.2, 0.8, 0.4, 0, -0.4, -0.8, -1.2, -1.6, -2]);   // 奇對稱，s(10) 解析值 0
    const end = run(p, 10.5).at(-1)!;
    const o = model.observe(end, p);
    expect(o.s).toBe(0); expect(o.area).toBe(0); expect(o.avgVel).toBe(0);
    expect(o.dist).toBeCloseTo(10, 9);
  });

  it("畫圖模式而時間窗落在節點上（T = 5）：凍結後 a 取 T⁻ 那一段的斜率（第二實作者建議）", () => {
    const vt = [0, 1, 3, 3, 0, -2, -2, 1, 1, 0, 0];
    const p: P = { mode: "draw", u: 0, a: 0, T: 5, vt };
    const end = run(p, 6).at(-1)!;
    expect(end.done).toBe(true);
    expect(end.v).toBeCloseTo(vt[5], 9);                       // 末節點值 −2
    expect(model.observe(end, p).a).toBeCloseTo(vt[5] - vt[4], 9);   // 段 4→5 的斜率 −2，而非段 5→6 的 0
  });
  it("0.6.0：T > 10 s 時控制點平均分佈於整個時間窗，v 線性插值、a = Δv / nodeDt", () => {
    const vt = [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0];
    const p: P = { mode: "draw", u: 0, a: 0, T: 20, vt };   // nodeDt = 2 s
    const r = run(p, 20.5);
    const at = (t: number) => r.find(x => Math.abs(x.t - t) < 5e-4)!;
    expect(at(1).v).toBeCloseTo(1, 9);                              // 0 → 2 之間的一半
    expect(model.observe(at(1), p).a).toBeCloseTo(1, 9);             // (2 − 0) / 2 s
    expect(at(2).v).toBeCloseTo(2, 9); expect(at(10).v).toBeCloseTo(2, 9);
    expect(model.observe(at(19), p).a).toBeCloseTo(-1, 9);           // 末段 2 → 0，斜率 −2 / 2 s
    expect(at(20).s).toBeCloseTo(2 + 2 * 16 + 2, 9);                 // 梯形：1 + 32 + 1 ... 精確 = 36 − 0：首尾段各 2，中間 16 s × 2
  });
  it("0.6.1：節點不在幀格點上（T = 13.3）時，跨節點的步仍精確等於閉式梯形和", () => {
    const vt = [0, 3, 3, -2, -2, 0, 4, 4, 1, 1, 0];
    const p: P = { mode: "draw", u: 0, a: 0, T: 13.3, vt };   // nodeDt = 1.33
    const dN = 1.33; const end = run(p, 13.4).at(-1)!;
    let s = 0; for (let k = 0; k < 10; k++) s += 0.5 * (vt[k] + vt[k + 1]) * dN;   // 每段閉式積分（段內 v 線性，無變號問題影響 s）
    expect(end.t).toBe(13.3); expect(end.s).toBeCloseTo(s, 10);
    // 節點貼齊：t = 3·1.33 = 3.99 的左右兩側 a 不同，節點幀本身取右段
    const at = (t: number) => r.find(x => Math.abs(x.t - t) < 5e-4)!; const r = run(p, 13.4);
    expect(model.observe(at(3.989), p).a).toBeCloseTo(-5 / dN, 9); expect(model.observe(at(3.991), p).a).toBeCloseTo(0, 9);   // 段 2→3 是 3 → −2，段 3→4 是 −2 → −2
  });
});
