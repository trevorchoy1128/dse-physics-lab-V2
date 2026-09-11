import type { PlanFn, Vec3, ArrowPlan, BodyPlan, LabelPlan, Layers } from "@/shell/types";
import { model, duration, blockForces, clothForces, passengerForces, busAt, shipAccel, clothAnalytic, passengerALimit, sceneCode, L_AB, M_PASSENGER, type S, type P } from "./model";

// 畫面的物理（純函數）。2D 側視：上方情景（方塊／桌布／巴士／太空），下方 s–t 與 v–t 線圖（以 trails 傳遞，點 = [t, y, 0]）。
// 箭嘴 vector 一律填物理量（SI），縮放係數在 scales 統一為 1；像素比例由 Scene 按 meta 的預測上界在重置時定好，運行中不變。
// 位置單位：米；z 分量用作「泳道」（第二個方塊在 lane 1）。老師決定：巴士只有地面視角，沒有任何虛擬力。

export const BLOCK = 0.12;        // 方塊邊長 / m
export const OBJ_W = 0.08, OBJ_H = 0.22;   // 桌布上的物件（樽）/ m
export const BUS_L = 18, BUS_H = 2.8;      // 巴士車廂（有頭有尾；預設參數急煞時乘客相對位移 −8.8 m 仍在車內；不模擬撞牆）/ m
export const PASS_W = 0.4, PASS_H = 1.7;   // 乘客 / m
export const SHIP_L = 1.0, SHIP_H = 0.5;   // 飛船 / m
export const HOLD = 3;                     // 預測軸範圍時假設施力／引擎維持的秒數

/** 預測上界：假設施力／引擎開 HOLD 秒後放手／關掉（情景 2、3 無此開關），用模型本身（閉式積分，粗步長亦精確）跑完整個時間窗，取各量的最大絕對值。重置時 Scene 用它定軸與箭嘴比例 */
export interface Extent { smax: number; vmax: number; amax: number; Fmax: number; FmaxH: number; FmaxV: number }
// 純函數的記憶：同一組參數只算一次（每幀 plan() 都會呼叫；CI 的慢 runner 上 50 組隨機參數 × 300 幀曾超過 5 s）
const extentCache = new Map<string, Extent>();
export function extent(p: P): Extent {
  const key = JSON.stringify(p);
  const hit = extentCache.get(key); if (hit) return hit;
  const e = extentUncached(p);
  if (extentCache.size > 200) extentCache.clear();
  extentCache.set(key, e);
  return e;
}
function extentUncached(p: P): Extent {
  // 情景 1、4：假設施力／引擎只開頭 HOLD 秒然後放手／關掉（學生通常很快放手；若一直按着，Scene 的軸只放大不縮小）
  const on: P = { ...p, push: "on", engine: "on" }, off: P = { ...p, push: "off", engine: "off" };
  const T = duration(on); const n = 300; const dt = T / n;
  let st: S = model.init(on); let smax = 0, vmax = 0, amax = 0, FmaxH = 0, FmaxV = 0; let q = on;
  const g = p.g;
  const consider = (s: number, v: number) => { smax = Math.max(smax, Math.abs(s)); vmax = Math.max(vmax, Math.abs(v)); };
  for (let i = 0; i <= n; i++) {
    const o = model.observe(st, q);
    if (q.scene === "table") { consider(st.a.s, st.a.v); if (q.second) consider(st.b.s, st.b.v); amax = Math.max(amax, Math.abs(o.a), q.second ? Math.abs(o.aB) : 0); }
    else if (q.scene === "cloth") { consider(st.a.s, st.a.v); vmax = Math.max(vmax, Math.abs(st.b.v)); amax = Math.max(amax, Math.abs(o.a)); }   // s 軸只看物件（布的位移可達十幾米，會把物件壓成一條線）；v 軸要容納布速
    else if (q.scene === "bus") { consider(o.sRel, st.a.v); consider(0, st.b.v); amax = Math.max(amax, Math.abs(o.a), Math.abs(o.aBusNow)); }
    else { consider(st.a.s, st.a.v); if (q.trio) { consider(st.b.s, st.b.v); consider(st.c.s, st.c.v); } amax = Math.max(amax, Math.abs(o.a)); }
    if (i < n) { if ((p.scene === "table" || p.scene === "space") && st.t >= HOLD) q = off; st = model.step(st, q, dt); }
  }
  // 水平力（施力、摩擦、淨力、扶手、引擎）與垂直力（重量、法向反作用力）各一個上界：Scene 各用一個像素比例（同一 kind 全場景一個係數）
  if (q.scene === "table") { FmaxV = Math.max(q.m, q.second ? q.mB : 0) * g; FmaxH = Math.max(q.F, q.f1, q.f2); }
  else if (q.scene === "cloth") { FmaxV = q.mObj * g; FmaxH = Math.max(q.fCloth, q.fTable); }
  else if (q.scene === "bus") { FmaxV = M_PASSENGER * g; FmaxH = Math.max(M_PASSENGER * q.aBus, q.fBus); }
  else { FmaxV = 0; FmaxH = q.Fe; }
  return { smax: Math.max(smax, 0.5), vmax: Math.max(vmax, 0.5), amax: Math.max(amax, 0.5), Fmax: Math.max(FmaxH, FmaxV, 0.1), FmaxH: Math.max(FmaxH, 0.1), FmaxV: Math.max(FmaxV, 0.1) };
}

const on = (layers: Layers, k: string) => layers[k] !== false;

export const plan: PlanFn<S, P> = (st, p, obs, layers) => {
  const arrows: ArrowPlan[] = [], bodies: BodyPlan[] = [], labels: LabelPlan[] = [];
  const netOnly = layers.netOnly === true;
  const g = p.g;
  const ext = extent(p);
  const meta: Record<string, number> = {
    scene: sceneCode(p.scene), t: st.t, T: duration(p), done: st.done ? 1 : 0,
    smax: ext.smax, vmax: ext.vmax, amax: ext.amax, Fmax: ext.Fmax, FmaxH: ext.FmaxH, FmaxV: ext.FmaxV,
    netOnly: netOnly ? 1 : 0, nForces: obs.nForces, nHoriz: obs.nHoriz, Fnet: obs.Fnet,
    // 至今出現過的最大 |s|、|v|（所有物體）：學生一直按着施力時軸只放大、不縮小
    sSeen: Math.max(...st.hist.map(h => Math.max(Math.abs(p.scene === "bus" ? h.s - h.s2 : h.s), p.scene === "table" && p.second ? Math.abs(h.s2) : 0, p.scene === "space" && p.trio ? Math.max(Math.abs(h.s2), Math.abs(h.s3)) : 0))),
    vSeen: Math.max(...st.hist.map(h => Math.max(Math.abs(h.v), (p.scene === "cloth" || p.scene === "bus" || (p.scene === "table" && p.second) || (p.scene === "space" && p.trio)) ? Math.abs(h.v2) : 0, p.scene === "space" && p.trio ? Math.abs(h.v3) : 0))),
    aSeen: Math.max(...st.hist.map(h => Math.max(Math.abs(h.a), Math.abs(h.a2)))),
  };
  // 力箭嘴：origin 在物體中心；layer 為圖層鍵；label 為符號（施力物 → 受力物的文字由 Scene 按語言配）
  const force = (kind: ArrowPlan["kind"], layer: string, origin: Vec3, vector: Vec3, label: string) => {
    if (!on(layers, layer)) return;
    if (netOnly && layer !== "net") return;
    if (Math.hypot(vector[0], vector[1]) === 0) return;
    arrows.push({ kind, origin, vector, label, layer });
  };
  const z = (x: number) => (Math.abs(x) < 1e-9 ? 0 : x);   // 與 observe 同一歸零門檻（核數員第 2 輪 E：1e-15 的速度不畫箭嘴）
  const motion = (origin: Vec3, v0: number, a0: number) => {
    const v = z(v0), a = z(a0);
    if (on(layers, "velocity") && v !== 0) arrows.push({ kind: "velocity", origin: [origin[0], origin[1] + 0.02, origin[2]], vector: [v, 0, 0], label: "v", layer: "velocity" });
    if (layers.acceleration === true && a !== 0) arrows.push({ kind: "acceleration", origin: [origin[0], origin[1] + 0.02, origin[2]], vector: [a, 0, 0], label: "a", layer: "acceleration" });
  };

  if (p.scene === "table") {
    meta.LAB = L_AB; meta.tRelease = Number.isNaN(st.tRelease) ? -1 : st.tRelease; meta.push = p.push === "on" ? 1 : 0; meta.lanes = p.second ? 2 : 1;
    meta.f1 = p.f1; meta.f2 = p.f2; meta.mA = p.m; meta.mB = p.mB;
    const draw = (key: string, b: { s: number; v: number }, m: number, lane: number, main: boolean) => {
      const c: Vec3 = [b.s, BLOCK / 2, lane];
      bodies.push({ key, shape: "box", position: [b.s, BLOCK / 2, lane], size: [BLOCK, BLOCK, BLOCK] });
      const f = blockForces(b, m, p);
      if (main || true) {
        force("weight", "weight", c, [0, -m * g, 0], "W");
        force("normal", "normal", c, [0, m * g, 0], "R");
        force("tension", "applied", c, [f.Fapp, 0, 0], "F");
        force("friction", "friction", c, [f.f, 0, 0], "f");
        force("net", "net", c, [f.Fnet, 0, 0], "ΣF");
      }
      motion(c, b.v, f.a);
    };
    draw("block", st.a, p.m, 0, true);
    if (p.second) draw("blockB", st.b, p.mB, 1, false);
    labels.push({ position: [st.a.s, -0.1, 0], symbol: "s", value: obs.s, unit: "m" });
  } else if (p.scene === "cloth") {
    const c: Vec3 = [st.a.s, OBJ_H / 2, 0]; const m = p.mObj; const fo = clothForces(st, p);
    bodies.push({ key: "object", shape: "box", position: c, size: [OBJ_W, OBJ_H, OBJ_W] });
    bodies.push({ key: "cloth", shape: "box", position: [st.b.s, 0, 0], size: [p.L + 1.2, 0.01, 0.5] });   // 尾邊在 position.x，向右延伸
    force("weight", "weight", c, [0, -m * g, 0], "W");
    force("normal", "normal", c, [0, m * g, 0], "R");
    force("friction", "friction", c, [fo.f, 0, 0], "f");
    force("net", "net", c, [fo.Fnet, 0, 0], "ΣF");
    motion(c, st.a.v, fo.a);
    const ana = clothAnalytic(p);
    meta.edge = st.b.s; meta.L = p.L; meta.vCloth = p.vCloth; meta.phase = st.phase; meta.stuck = st.phase === 1 ? 1 : 0; meta.fTable = p.fTable; meta.fCloth = p.fCloth;
    meta.J = Number.isFinite(obs.J) ? obs.J : 0; meta.Jmax = m * Math.max(0.05, Math.sqrt(2 * (p.fCloth / m) * p.L));   // 衝量條的尺不隨 v布 變（核數員第 3 輪 H）：滿格 = 臨界速度 √(2 f布 L / m) 的衝量；v布 5 → 10 時條長減半
    meta.dtPull = Number.isFinite(obs.dtPull) ? obs.dtPull : -1; meta.dv = Number.isFinite(obs.dv) ? obs.dv : 0;
    meta.tLeave = ana.stuck ? -1 : ana.tLeave; meta.sLeave = Number.isNaN(st.sLeave) ? -1 : st.sLeave;
    labels.push({ position: [st.a.s, -0.1, 0], symbol: "s", value: obs.s, unit: "m" });
    labels.push({ position: [st.a.s, OBJ_H + 0.3, 0], symbol: "J", value: obs.J, unit: "N s" });
  } else if (p.scene === "bus") {
    const bus = busAt(p, st.t); const fp = passengerForces(st, p); const m = M_PASSENGER;
    const c: Vec3 = [st.a.s, PASS_H / 2, 0];
    bodies.push({ key: "bus", shape: "box", position: [bus.s, BUS_H / 2, 0], size: [BUS_L, BUS_H, 2.5] });
    bodies.push({ key: "passenger", shape: "box", position: c, size: [PASS_W, PASS_H, PASS_W] });
    force("weight", "weight", c, [0, -m * g, 0], "W");
    force("normal", "normal", c, [0, m * g, 0], "R");
    force("friction", "friction", [c[0], 0.05, 0], [fp.f, 0, 0], "f");
    force("tension", "applied", [c[0], PASS_H * 0.75, 0], [fp.Fhand, 0, 0], "F");
    force("net", "net", c, [fp.Fnet, 0, 0], "ΣF");
    motion([c[0], PASS_H + 0.1, 0], st.a.v, fp.a);
    meta.sBus = bus.s; meta.vBus = bus.v; meta.aBus = bus.a; meta.busPhase = bus.phase; meta.handrail = p.handrail ? 1 : 0;
    meta.sRel = obs.sRel; meta.sliding = st.phase; meta.busL = BUS_L; meta.busH = BUS_H; meta.aLim = passengerALimit(p); meta.fBus = p.fBus;
    labels.push({ position: [st.a.s, -0.1, 0], symbol: "sRel", value: obs.sRel, unit: "m" });
  } else {
    const acc = shipAccel(p); const Fe = obs.Fe;
    const ships: [string, { s: number; v: number }, number][] = p.trio ? [["ship", st.a, 0], ["shipR", st.b, 1], ["shipL", st.c, 2]] : [["ship", st.a, 0]];
    for (const [key, b, lane] of ships) {
      const c: Vec3 = [b.s, SHIP_H / 2, lane];
      bodies.push({ key, shape: "box", position: c, size: [SHIP_L, SHIP_H, SHIP_H] });
      force("tension", "applied", c, [Fe, 0, 0], "F");
      force("net", "net", c, [Fe, 0, 0], "ΣF");
      motion(c, b.v, acc);
    }
    meta.engineOn = p.engine === "on" ? 1 : 0; meta.dir = p.dir === "forward" ? 1 : -1; meta.Fe = Fe; meta.trio = p.trio ? 1 : 0; meta.fuel = obs.fuel; meta.lanes = p.trio ? 3 : 1;
    labels.push({ position: [st.a.s, -0.1, 0], symbol: "s", value: obs.s, unit: "m" });
  }

  const H = st.hist;
  const trails: { key: string; points: Vec3[] }[] = [
    { key: "s-t", points: H.map(h => [h.t, p.scene === "bus" ? h.s - h.s2 : h.s, 0] as Vec3) },
    { key: "v-t", points: H.map(h => [h.t, h.v, 0] as Vec3) },
  ];
  trails.push({ key: "a-t", points: H.map(h => [h.t, h.a, 0] as Vec3) });   // a–t 圖（老師 2026-09-11 要求）
  if ((p.scene === "table" && p.second) || p.scene === "cloth" || p.scene === "bus" || (p.scene === "space" && p.trio)) { trails.push({ key: "v2-t", points: H.map(h => [h.t, h.v2, 0] as Vec3) }); trails.push({ key: "a2-t", points: H.map(h => [h.t, h.a2, 0] as Vec3) }); }
  if (p.scene === "space" && p.trio) trails.push({ key: "v3-t", points: H.map(h => [h.t, h.v3, 0] as Vec3) });
  if (p.scene === "table" && p.second) trails.push({ key: "s2-t", points: H.map(h => [h.t, h.s2, 0] as Vec3) });

  return {
    bodies, arrows, labels, trails,
    scales: { weight: 1, normal: 1, friction: 1, tension: 1, net: 1, velocity: 1, acceleration: 1 },
    meta,
  };
};
