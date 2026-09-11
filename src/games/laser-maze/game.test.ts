import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { initialState, pieceMirror, piecePrism, rectEdges, semicircleEdges, snapRot, solutions, starsFor, trace, traceBeam, type Scene, type State } from "./game";

// 激光迷宮：光學與牛津 Book 3A 的定律一致；每關有解且預設不命中（控制項格點窮舉）。
const far = { kind: "spot" as const, c: [100, 100] as [number, number], r: 0.1 };
const empty = (over: Partial<Scene>): Scene => ({ lasers: [], glass: [], mirrors: [], blocks: [], target: far, ...over });
const dirDeg = (b: { points: [number, number][] }) => { const n = b.points.length; const [a, c] = [b.points[n - 2], b.points[n - 1]]; return (Math.atan2(c[1] - a[1], c[0] - a[0]) * 180) / Math.PI; };
const byId = (id: string) => LEVELS.find(l => l.id === id)!;

describe("反射定律", () => {
  it("45° 平面鏡把水平光轉 90°；入射角 = 反射角 = 45°", () => {
    const b = traceBeam(empty({ mirrors: [pieceMirror([5, 4], 135)] }), [1, 4], 0);
    expect(b.events[0].kind).toBe("reflect"); expect(b.events[0].i).toBeCloseTo(45, 6);
    expect(dirDeg(b)).toBeCloseTo(-90, 6);
  });
  it("鏡面轉 30°，光線轉 60°（反射角 = 入射角 = 60°）", () => {
    const b = traceBeam(empty({ mirrors: [pieceMirror([5, 4], 30)] }), [1, 4], 0);
    expect(b.events[0].i).toBeCloseTo(60, 6); expect(dirDeg(b)).toBeCloseTo(60, 6);
  });
});

describe("折射定律與臨界角", () => {
  const glass = { n: 1.5, edges: rectEdges(4, 0, 8, 8) };
  it("空氣 → 玻璃 30°：sin r = sin 30° / 1.5，r = 19.47°", () => {
    const b = traceBeam(empty({ glass: [glass] }), [1, 4 - Math.tan(Math.PI / 6) * 3], 30);
    expect(b.events[0].kind).toBe("refract"); expect(b.events[0].i).toBeCloseTo(30, 6); expect(b.events[0].r).toBeCloseTo((Math.asin(0.5 / 1.5) * 180) / Math.PI, 6);
  });
  it("平行玻璃磚：出射光與入射光平行", () => {
    const b = traceBeam(empty({ glass: [glass] }), [1, 2], 30);
    expect(b.events.length).toBe(2); expect(dirDeg(b)).toBeCloseTo(30, 6);
  });
  it("玻璃 → 空氣 45° > C = 41.8°：全內反射", () => {
    const semi = { n: 1.5, edges: semicircleEdges([6, 4], 2.5, 90) };
    const b = traceBeam(empty({ glass: [semi] }), [6 - 3.4 * Math.sin(Math.PI / 4), 4 - 3.4 * Math.cos(Math.PI / 4)], 45);
    expect(b.events[0].kind).toBe("refract"); expect(b.events[0].i).toBeCloseTo(0, 3);     // 沿半徑入弧面：不偏折
    expect(b.events[1].kind).toBe("tir"); expect(b.events[1].C).toBeCloseTo((Math.asin(1 / 1.5) * 180) / Math.PI, 6);
  });
  it("玻璃 → 空氣 28.1°：折射角 45°", () => {
    const semi = { n: 1.5, edges: semicircleEdges([6, 4], 2.5, 90) };
    const th = Math.asin(Math.SQRT1_2 / 1.5);
    const b = traceBeam(empty({ glass: [semi] }), [6 - 3.4 * Math.sin(th), 4 - 3.4 * Math.cos(th)], 90 - (th * 180) / Math.PI);
    expect(b.events[1].kind).toBe("refract"); expect(b.events[1].r).toBeCloseTo(45, 5);
  });
  it("直角稜鏡：垂直入射、斜面 45° 全內反射、轉 90°", () => {
    const b = traceBeam(empty({ glass: [piecePrism([6, 4], 0)] }), [1, 4], 0);
    expect(b.events.map(e => e.kind)).toEqual(["refract", "tir", "refract"]);
    expect(b.events[1].i).toBeCloseTo(45, 6); expect(dirDeg(b)).toBeCloseTo(-90, 6);
  });
  it("斜面向着光的直角稜鏡：兩次全內反射、倒轉 180°", () => {
    const b = traceBeam(empty({ glass: [piecePrism([6, 4], 135)] }), [1, 4.25], 0);
    expect(b.events.map(e => e.kind)).toEqual(["refract", "tir", "tir", "refract"]);
    expect(dirDeg(b)).toBeCloseTo(180, 6); expect(b.points.at(-1)![1]).toBeCloseTo(3.75, 6);   // 對稱地移到另一邊
  });
});

describe("每關有解（控制項格點窮舉）", () => {
  it("兩部分：第一部分只用平面鏡，第二部分只用稜鏡或調角度", () => {
    for (const L of LEVELS) {
      if (L.part === 1) expect(Object.keys(L.inventory)).toEqual(["mirror"]);
      else expect(Object.keys(L.inventory).every(k => k === "prism")).toBe(true);
    }
    expect(LEVELS.filter(l => l.part === 1).length).toBeGreaterThan(0); expect(LEVELS.filter(l => l.part === 2).length).toBeGreaterThan(0);
  });
  for (const L of LEVELS) {
    it(`${L.id}：預設不命中，且至少一組控制值命中`, () => {
      expect(trace(L, initialState(L)).hit).toBe(false);
      expect(solutions(L).length).toBeGreaterThan(0);
    }, 30000);
  }
  it("fish：直線瞄準（θ = 41.6°）射不中，計算值 62° 命中", () => {
    const L = byId("fish");
    expect(trace(L, { theta: 42, placed: [] }).hit).toBe(false);
    expect(trace(L, { theta: 62, placed: [] }).hit).toBe(true);
  });
  it("tir：入射角小於臨界角時折射出去、不命中；55° 全內反射命中", () => {
    const L = byId("tir");
    const r = trace(L, { theta: 30, placed: [] });
    expect(r.hit).toBe(false); expect(r.beams[0].events[1].kind).toBe("refract");
    expect(trace(L, { theta: 55, placed: [] }).beams[0].events[1].kind).toBe("tir");
    expect(trace(L, { theta: 55, placed: [] }).hit).toBe(true);
  });
  it("fibre：70° 漏光（纖壁折射出去），61° 全內反射到末端；三星解存在", () => {
    const L = byId("fibre");
    const leak = trace(L, { theta: 70, placed: [] });
    expect(leak.hit).toBe(false); expect(leak.beams[0].events[1].kind).toBe("refract");
    expect(trace(L, { theta: 61, placed: [] }).hit).toBe(true);
    expect(trace(L, { theta: 62, placed: [] }).hit).toBe(false);
    expect(solutions(L).some(s => starsFor(L, { shots: 1, theta: s.theta }) === 3)).toBe(true);
  });
  it("corner：陷阱格位不命中", () => {
    const L = byId("corner");
    const st: State = { theta: 0, placed: [{ type: "mirror", rot: 135 }, null, null, { type: "mirror", rot: 135 }] };
    expect(trace(L, st).beams[0].outcome).toBe("block");
  });
  it("periscope：兩個稜鏡各全內反射一次，斜面平行；陷阱格位不命中", () => {
    const L = byId("periscope");
    const ok: State = { theta: 0, placed: [null, { type: "prism", rot: 0 }, { type: "prism", rot: 180 }, null] };
    const r = trace(L, ok); expect(r.hit).toBe(true); expect(r.beams[0].events.filter(e => e.kind === "tir").length).toBe(2);
    const trap: State = { theta: 0, placed: [{ type: "prism", rot: 0 }, null, null, { type: "prism", rot: 180 }] };
    expect(trace(L, trap).beams[0].outcome).toBe("block");
  });
  it("拖動旋轉吸附 5°，鏡以 180° 為週期、稜鏡以 360° 為週期", () => {
    expect(snapRot("mirror", 92)).toBe(90); expect(snapRot("mirror", 183)).toBe(5); expect(snapRot("mirror", -2)).toBe(0);
    expect(snapRot("prism", 357)).toBe(355); expect(snapRot("prism", 362)).toBe(0);
  });
  it("星數規則", () => {
    const L = LEVELS[0];
    expect(starsFor(L, { shots: 1, theta: 0 })).toBe(3);
    expect(starsFor(L, { shots: 3, theta: 0 })).toBe(2);
    expect(starsFor(L, { shots: 4, theta: 0 })).toBe(1);
  });
});
