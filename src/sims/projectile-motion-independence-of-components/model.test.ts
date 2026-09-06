import { describe, it, expect } from "vitest";
import { model, flightTime, range, maxHeight, trajectory, K_AIR, type P, type S } from "./model";

// 每個 it() 的名稱 = 規格「驗證條件」的中文原句；其後是解析解比較與守恆量。先寫測試，再寫 model。
const base: P = { u: 15, theta: 40, h: 0, g: 9.81, m: 1, air: false, companion: "none" };
const DT = 1e-3;

/** 跑到主球落地為止（或 T 秒），回傳逐步狀態 */
const run = (p: P, T = 60, dt = DT) => {
  let s: S = model.init(p);
  const trace: S[] = [s];
  for (let i = 0; i * dt < T; i++) { s = model.step(s, p, dt); trace.push(s); if (s.a.landed && (!s.b || s.b.landed)) break; }
  return trace;
};
const landed = (p: P) => { const tr = run(p); const s = tr[tr.length - 1]; expect(s.a.landed).toBe(true); return s; };

describe("拋體運動（S2）驗證條件", () => {
  it("空氣阻力關閉時，路徑必須嚴格對稱：上升時間等於下降時間，落地速率等於初速（同一水平面）", () => {
    for (const theta of [20, 40, 60, 80]) {
      const p = { ...base, theta };
      const tr = run(p);
      const end = tr[tr.length - 1];
      // 上升時間：vy 由正變負的時刻（解析：u sinθ / g）
      const tUp = tr.find(s => s.a.vy <= 0)!.t;
      const tDown = end.a.tLand - tUp;
      expect(Math.abs(tUp - tDown)).toBeLessThan(2 * DT);
      expect(Math.abs(Math.hypot(end.a.vx, end.a.vy) - p.u) / p.u).toBeLessThan(1e-6);
    }
  });

  it("θ = 45° 時射程最大；θ 與 90° − θ 的射程相同", () => {
    const R: Record<number, number> = {};
    for (let theta = 10; theta <= 80; theta += 5) R[theta] = landed({ ...base, theta }).a.x;
    const best = Object.entries(R).sort((a, b) => b[1] - a[1])[0][0];
    expect(Number(best)).toBe(45);
    for (const theta of [10, 20, 30, 40]) expect(Math.abs(R[theta] - R[90 - theta]) / R[theta]).toBeLessThan(1e-6);
  });

  it("v_x 在全程數值不變（可用數值輸出檢查，容許誤差 10⁻⁶）", () => {
    for (const p of [base, { ...base, h: 30, theta: -20 }, { ...base, g: 1.6, u: 50, theta: 70 }]) {
      const ux = p.u * Math.cos((p.theta * Math.PI) / 180);
      for (const s of run(p)) expect(Math.abs(model.observe(s, p).vx - ux)).toBeLessThan(1e-6);
    }
  });
});

describe("拋體運動（S2）解析解與守恆量", () => {
  it("x = u cosθ t、y = h + u sinθ t − ½gt²、v_y = u sinθ − gt（相對誤差 ≤ 1e-6）", () => {
    for (const p of [base, { ...base, h: 25, theta: 10 }, { ...base, g: 3.7, theta: 65, u: 30 }]) {
      const th = (p.theta * Math.PI) / 180;
      for (const s of run(p)) {
        if (s.a.landed) break;
        const t = s.t;
        const x = p.u * Math.cos(th) * t, y = p.h + p.u * Math.sin(th) * t - 0.5 * p.g * t * t, vy = p.u * Math.sin(th) - p.g * t;
        expect(Math.abs(s.a.x - x)).toBeLessThan(1e-6 * Math.max(1, Math.abs(x)));
        expect(Math.abs(s.a.y - y)).toBeLessThan(1e-6 * Math.max(1, Math.abs(y)));
        expect(Math.abs(s.a.vy - vy)).toBeLessThan(1e-6 * Math.max(1, Math.abs(vy)));
      }
    }
  });

  it("飛行時間 t = 2u sinθ / g、射程 R = u² sin2θ / g、最高點 H = h + u² sin²θ / 2g（h = 0，相對誤差 ≤ 1e-6）", () => {
    for (const theta of [15, 40, 75]) {
      const p = { ...base, theta };
      const th = (theta * Math.PI) / 180;
      const s = landed(p);
      const tf = (2 * p.u * Math.sin(th)) / p.g, R = (p.u * p.u * Math.sin(2 * th)) / p.g, H = (p.u * p.u * Math.sin(th) ** 2) / (2 * p.g);
      expect(Math.abs(s.a.tLand - tf) / tf).toBeLessThan(1e-6);
      expect(Math.abs(s.a.x - R) / R).toBeLessThan(1e-6);
      expect(Math.abs(model.observe(s, p).H - H) / H).toBeLessThan(1e-6);
      // 輔助函數與模擬一致
      expect(Math.abs(flightTime(p, theta) - tf) / tf).toBeLessThan(1e-12);
      expect(Math.abs(range(p, theta) - R) / R).toBeLessThan(1e-12);
      expect(Math.abs(maxHeight(p, theta) - H) / H).toBeLessThan(1e-12);
    }
  });

  it("由高度 h 發射：落地時間 t = (u sinθ + √(u² sin²θ + 2gh)) / g，向下投射（θ < 0）亦成立", () => {
    for (const p of [{ ...base, h: 20 }, { ...base, h: 50, theta: -30 }, { ...base, h: 10, theta: 0 }]) {
      const th = (p.theta * Math.PI) / 180, uy = p.u * Math.sin(th);
      const tf = (uy + Math.sqrt(uy * uy + 2 * p.g * p.h)) / p.g;
      const s = landed(p);
      expect(Math.abs(s.a.tLand - tf) / tf).toBeLessThan(1e-6);
      expect(Math.abs(s.a.y)).toBeLessThan(1e-9);
      expect(Math.abs(flightTime(p, p.theta) - tf) / tf).toBeLessThan(1e-12);
    }
  });

  it("動能 = ½ m v²：質量滑桿改變動能，不改變路徑（無空氣阻力）", () => {
    const a = run(base), b = run({ ...base, m: 3 });
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i += 50) {
      expect(b[i].a.x).toBe(a[i].a.x); expect(b[i].a.y).toBe(a[i].a.y);
      expect(Math.abs(model.observe(b[i], { ...base, m: 3 }).Ek - 3 * model.observe(a[i], base).Ek)).toBeLessThan(1e-9);
    }
  });

  it("機械能守恆：½v² + gy 的漂移 ≤ 1e-6（無空氣阻力）", () => {
    for (const p of [base, { ...base, h: 40, theta: -10, g: 10 }]) {
      const th = (p.theta * Math.PI) / 180;
      const E0 = 0.5 * p.u * p.u + p.g * p.h;
      for (const s of run(p)) {
        if (s.a.landed) break;
        expect(Math.abs(0.5 * (s.a.vx ** 2 + s.a.vy ** 2) + p.g * s.a.y - E0)).toBeLessThan(1e-6 * Math.max(1, E0));
      }
      void th;
    }
  });

  it("最高點：v_y = 0 但 v_x = u cosθ，動能 = ½ m v_x²（不為零）", () => {
    const p = base; const th = (p.theta * Math.PI) / 180;
    const tr = run(p);
    const top = tr.reduce((a, b) => (b.a.y > a.a.y ? b : a));
    expect(Math.abs(top.a.vy)).toBeLessThan(p.g * DT);
    const obs = model.observe(top, p);
    expect(Math.abs(obs.vx - p.u * Math.cos(th))).toBeLessThan(1e-6);
    expect(obs.Ek).toBeGreaterThan(0.5 * p.m * (p.u * Math.cos(th)) ** 2 * (1 - 1e-4));
    expect(obs.Ek).toBeLessThan(0.5 * p.m * p.u * p.u);
  });

  it("加速度全程為 (0, −g)，最高點亦然（無空氣阻力）", () => {
    const p = base;
    for (const s of run(p)) { if (s.a.landed) break; const o = model.observe(s, p); expect(o.ax).toBe(0); expect(o.ay).toBe(-p.g); }
  });
});

describe("拋體運動（S2）第二顆球與頻閃", () => {
  it("水平初速加倍的第二顆球：全程高度與主球相同，落地時刻相同，水平距離為兩倍", () => {
    for (const p of [{ ...base, companion: "fast" as const }, { ...base, theta: 0, h: 20, companion: "fast" as const }]) {
      const tr = run(p);
      for (const s of tr) { expect(s.b).toBeDefined(); expect(Math.abs(s.b!.y - s.a.y)).toBeLessThan(1e-9); }
      const end = tr[tr.length - 1];
      expect(Math.abs(end.b!.tLand - end.a.tLand)).toBeLessThan(1e-9);
      if (end.a.x > 0) expect(Math.abs(end.b!.x - 2 * end.a.x) / end.a.x).toBeLessThan(1e-6);
    }
  });

  it("同時自由下落的第二顆球（θ = 0）：全程高度與水平拋出的主球相同，落地時刻相同，x 保持為 0", () => {
    const p: P = { ...base, theta: 0, h: 20, companion: "drop" };
    const tr = run(p);
    for (const s of tr) { expect(Math.abs(s.b!.y - s.a.y)).toBeLessThan(1e-9); expect(s.b!.x).toBe(0); }
    const end = tr[tr.length - 1];
    expect(Math.abs(end.b!.tLand - end.a.tLand)).toBeLessThan(1e-9);
    expect(Math.abs(end.a.tLand - Math.sqrt((2 * p.h) / p.g))).toBeLessThan(1e-6);
  });

  it("頻閃影像每 0.1 s 一個：水平間距相等，垂直間距逐格增大（上升段減小、下降段增大）", () => {
    const p: P = { ...base, theta: 0, h: 30 };
    const s = landed(p);
    const pts = s.strobe;
    expect(pts.length).toBeGreaterThan(10);
    const dx = pts.slice(1).map((q, i) => q[0] - pts[i][0]);
    const dy = pts.slice(1).map((q, i) => pts[i][1] - q[1]);
    for (const d of dx) expect(Math.abs(d - dx[0])).toBeLessThan(1e-6);
    for (let i = 1; i < dy.length; i++) expect(dy[i]).toBeGreaterThan(dy[i - 1]);
    // 影像時刻為 0.1 s 的整數倍
    for (let i = 0; i < pts.length; i++) expect(Math.abs(pts[i][2] - 0.1 * i)).toBeLessThan(1e-6);
  });

  it("解析路徑 trajectory() 與模擬逐點一致（供各角度射程比較圖層）", () => {
    for (const theta of [15, 45, 75]) {
      const p = { ...base, theta };
      const pts = trajectory(p, theta, 50);
      const th = (theta * Math.PI) / 180;
      for (const [x, y] of pts) {
        const t = x / (p.u * Math.cos(th));
        expect(Math.abs(y - (p.h + p.u * Math.sin(th) * t - 0.5 * p.g * t * t))).toBeLessThan(1e-9);
      }
      expect(Math.abs(pts[pts.length - 1][1])).toBeLessThan(1e-9);
    }
  });
});

describe("拋體運動（S2）空氣阻力與邊界", () => {
  it("開啟空氣阻力（F = −kv）：v_x = u cosθ · e^(−kt/m)（相對誤差 ≤ 1e-6）；質量愈大受影響愈小", () => {
    const p: P = { ...base, u: 20, air: true };
    const ux = p.u * Math.cos((p.theta * Math.PI) / 180);
    for (const s of run(p)) { if (s.a.landed) break; expect(Math.abs(s.a.vx - ux * Math.exp((-K_AIR / p.m) * s.t))).toBeLessThan(1e-6 * ux); }
    const light = run({ ...p, m: 0.2 }), heavy = run({ ...p, m: 5 });
    expect(light[light.length - 1].a.x).toBeLessThan(heavy[heavy.length - 1].a.x);
    expect(Math.abs(heavy[heavy.length - 1].a.x - range(p, p.theta)) / range(p, p.theta)).toBeLessThan(0.1);
  });

  it("開啟空氣阻力：射程與最高點都小於無阻力值，v_x 單調減小，落地速率小於初速", () => {
    const p: P = { ...base, u: 30, air: true };
    const tr = run(p);
    const end = tr[tr.length - 1];
    expect(end.a.x).toBeLessThan(range(p, p.theta));
    expect(Math.max(...tr.map(s => s.a.y))).toBeLessThan(maxHeight(p, p.theta));
    for (let i = 1; i < tr.length; i++) if (!tr[i].a.landed) expect(tr[i].a.vx).toBeLessThan(tr[i - 1].a.vx);
    expect(Math.hypot(end.a.vx, end.a.vy)).toBeLessThan(p.u);
  });

  it("h = 0 且 θ ≤ 0：一開始已在地面，飛行時間 0，讀數無 NaN", () => {
    for (const theta of [0, -30]) {
      const p = { ...base, theta };
      const s = model.step(model.init(p), p, DT);
      expect(s.a.landed).toBe(true);
      expect(s.a.tLand).toBe(0);
      for (const v of Object.values(model.observe(s, p))) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("落地即停：最後一顆球落地後整個狀態凍結，t 停在落地時刻", () => {
    const p = base;
    let s = landed(p);
    const frozen = { ...s.a };
    expect(s.t).toBeCloseTo(frozen.tLand, 12);
    for (let i = 0; i < 100; i++) s = model.step(s, p, DT);
    expect(s.a).toEqual(frozen);
    expect(s.t).toBe(frozen.tLand);
  });
});
