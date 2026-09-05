import { describe, it, expect } from "vitest";
import { createRunner } from "./runner";
import type { SimModel } from "./types";

type S = { t: number; x: number }; type P = { v: number };
const model: SimModel<S, P> = {
  init: () => ({ t: 0, x: 0 }),
  step: (s, p, dt) => ({ t: s.t + dt, x: s.x + p.v * dt }),
  observe: s => ({ x: s.x }),
  events: (a, b) => (a.x < 1 && b.x >= 1 ? [{ key: "cross", t: b.t, label: { zh: "過線", en: "cross" } }] : []),
};

describe("固定步長運行器", () => {
  it("推進 1 s 恰好 1000 步（dt = 1e-3），與幀時間無關", () => {
    const r = createRunner(model, { v: 2 });
    let total = 0;
    for (const frame of [0.016, 0.033, 0.2, 0.751]) total += r.advance(frame).steps;
    expect(total).toBe(1000);
    expect(r.t).toBeCloseTo(1, 9);
    expect(r.state.x).toBeCloseTo(2, 9);
  });
  it("餘數累積，不丟失時間", () => {
    const r = createRunner(model, { v: 1 });
    r.advance(0.0005); expect(r.t).toBe(0);
    r.advance(0.0005); expect(r.t).toBeCloseTo(0.001, 12);
  });
  it("事件在步進時回傳", () => {
    const r = createRunner(model, { v: 10 });
    const { events } = r.advance(0.2);
    expect(events.map(e => e.key)).toEqual(["cross"]);
  });
  it("重置回到初始狀態並可換參數", () => {
    const r = createRunner(model, { v: 1 });
    r.advance(0.5); r.reset({ v: 3 }); r.advance(0.1);
    expect(r.state.x).toBeCloseTo(0.3, 9);
  });
  it("seek 精確跳到任何時刻，不受每次推進的步數上限影響（學生試用者：時間拉桿卡在 2 s）", () => {
    const r = createRunner(model, { v: 1 }, 1e-3, 2000);
    r.seek(7.5); expect(r.t).toBeCloseTo(7.5, 9); expect(r.state.x).toBeCloseTo(7.5, 9);
    r.seek(0.25); expect(r.t).toBeCloseTo(0.25, 9);
    r.seek(0); expect(r.t).toBe(0);
  });
  it("長時間離開後不會追趕過久", () => {
    const r = createRunner(model, { v: 1 }, 1e-3, 2000);
    expect(r.advance(60).steps).toBe(2000);
  });
});
