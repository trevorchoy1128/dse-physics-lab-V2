import type { Text } from "@/shell/types";

// 激光迷宮：遊戲邏輯（純 TypeScript，不碰畫布）。
// 光學跟牛津 Book 3A Ch1–2：反射定律、折射定律 n₁ sin θ₁ = n₂ sin θ₂、臨界角 sin C = 1/n。
// 棋盤 12 × 8 格，x 右 y 上，單位「格」。光線由激光出發，逐段找最近的界面：
//   平面鏡 → 反射；玻璃邊界 → 折射（sin θ₂ > 1 即全內反射）；障礙、探測器、棋盤邊界 → 結束。
// 理想化：只畫折射線或反射線，不畫界面的弱反射；空氣折射率當 1。
// 兩部分：第一部分平面鏡（放鏡、轉角），第二部分稜鏡與折射（放稜鏡、轉角；或調入射角）。

export type Vec = [number, number];
export type Edge = { kind: "seg"; a: Vec; b: Vec } | { kind: "arc"; c: Vec; r: number; a0: number; a1: number };   // arc：由 a0 逆時針到 a1（弧度）

export type PieceType = "mirror" | "prism";
export interface Placed { type: PieceType; rot: number }             // rot / °

export interface Glass { n: number; edges: Edge[]; name?: Text; label?: Text; labelAt?: Vec }   // 閉合區域（邊只可屬一個區域，區域不可重疊）；name：讀數用的介質名
export interface Mirror { a: Vec; b: Vec }
export interface Block { x0: number; x1: number; y0: number; y1: number }
export type Target = { kind: "spot"; c: Vec; r: number; fish?: boolean } | { kind: "strip"; a: Vec; b: Vec };

export interface AngleCtl {
  ref: number; sign: 1 | -1;         // 光線方向 = ref + sign × θ（°，x 軸為 0，逆時針為正）
  min: number; max: number; start: number;
  label: Text;                       // 例：「與法線夾角」
  pivot?: { c: Vec; r: number };     // 激光繞 c 轉、永遠指向 c（半圓玻璃塊關）：位置 = c − r·方向
}

export interface Level {
  id: string;
  part: 1 | 2;                       // 1 平面鏡；2 稜鏡與折射
  name: Text;
  brief: Text;                       // 關卡說明
  hint: Text;                        // 公式提示（按「提示」才看）
  note?: Text;                       // 本關的數值（n）
  lasers: { pos: Vec; dir: number }[];   // dir / °；有 angle 時第一支由 angle 決定
  angle?: AngleCtl;
  glass: Glass[];
  mirrors: Mirror[];
  blocks: Block[];
  target: Target;
  slots: Vec[];                      // 可放元件的格（中心座標）
  inventory: Partial<Record<PieceType, number>>;
  stars?: { kind: "band"; three: number; two: number };   // band：θ ≥ three 三星、≥ two 兩星（其餘關按發射次數）
  aimLine?: boolean;                 // 畫激光到目標的直線（叉魚關：直線瞄準會射不中）
  start?: Partial<State>;            // 進入關卡的預設（刻意不命中）
}

export interface State { theta: number; placed: (Placed | null)[] }

export const W = 12, H = 8;
export const ROT_STEP = 15;          // 按鈕一按的轉角
export const DRAG_STEP = 5;          // 拖動旋轉的吸附格
export const ROT_MOD: Record<PieceType, number> = { mirror: 180, prism: 360 };
export const DEFAULT_ROT: Record<PieceType, number> = { mirror: 90, prism: 90 };
const MIRROR_LEN = 1.0;
const PRISM_LOCAL: Vec[] = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]];   // 直角等腰稜鏡：直角在左下，斜面「\」

// ---- 向量 ----
const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1];
const norm = (a: Vec): Vec => { const l = Math.hypot(a[0], a[1]); return [a[0] / l, a[1] / l]; };
const rot = (v: Vec, d: number): Vec => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
export const dirOf = (d: number): Vec => [Math.cos(rad(d)), Math.sin(rad(d))];
export const reflect = (d: Vec, n: Vec): Vec => sub(d, mul(n, 2 * dot(d, n)));

// ---- 元件幾何 ----
export const rectEdges = (x0: number, y0: number, x1: number, y1: number): Edge[] => [
  { kind: "seg", a: [x0, y0], b: [x1, y0] }, { kind: "seg", a: [x1, y0], b: [x1, y1] }, { kind: "seg", a: [x1, y1], b: [x0, y1] }, { kind: "seg", a: [x0, y1], b: [x0, y0] },
];
/** 半圓玻璃塊：平面在 c，法線方向 flatNormal（°）指向平面外側，圓弧在另一邊 */
export const semicircleEdges = (c: Vec, r: number, flatNormal: number): Edge[] => {
  const a = add(c, mul(dirOf(flatNormal + 90), r)), b = add(c, mul(dirOf(flatNormal - 90), r));
  return [{ kind: "seg", a, b }, { kind: "arc", c, r, a0: rad(flatNormal + 90), a1: rad(flatNormal + 270) }];   // 弧由 a 逆時針到 b，經過 flatNormal + 180 一側
};
export const polyEdges = (pts: Vec[]): Edge[] => pts.map((p, i) => ({ kind: "seg", a: p, b: pts[(i + 1) % pts.length] }));

export function pieceMirror(c: Vec, rotDeg: number): Mirror { const h = mul(dirOf(rotDeg), MIRROR_LEN / 2); return { a: sub(c, h), b: add(c, h) }; }
export function piecePrism(c: Vec, rotDeg: number, n = 1.5): Glass { return { n, name: { zh: "稜鏡", en: "prism" }, edges: polyEdges(PRISM_LOCAL.map(p => add(c, rot(p, rotDeg)))) }; }
export const prismVertices = (c: Vec, rotDeg: number): Vec[] => PRISM_LOCAL.map(p => add(c, rot(p, rotDeg)));

// ---- 由關卡 + 狀態組成場景 ----
export interface Scene { lasers: { pos: Vec; dir: number }[]; glass: Glass[]; mirrors: Mirror[]; blocks: Block[]; target: Target }
export function laserOf(L: Level, theta: number): { pos: Vec; dir: number } {
  const a = L.angle; if (!a) return L.lasers[0];
  const dir = a.ref + a.sign * theta;
  const pos = a.pivot ? sub(a.pivot.c, mul(dirOf(dir), a.pivot.r)) : L.lasers[0].pos;
  return { pos, dir };
}
export function sceneOf(L: Level, st: State): Scene {
  const lasers = L.lasers.map((l, i) => (i === 0 && L.angle ? laserOf(L, st.theta) : l));
  const glass = [...L.glass], mirrors = [...L.mirrors];
  L.slots.forEach((c, i) => {
    const p = st.placed[i]; if (!p) return;
    if (p.type === "mirror") mirrors.push(pieceMirror(c, p.rot));
    else glass.push(piecePrism(c, p.rot));
  });
  return { lasers, glass, mirrors, blocks: L.blocks, target: L.target };
}

// ---- 光線追蹤 ----
type HitKind = "mirror" | "glass" | "block" | "target" | "bound";
interface Hit { t: number; kind: HitKind; n: Vec; glass?: Glass }
const EPS = 1e-7;

function hitSeg(p: Vec, d: Vec, a: Vec, b: Vec): { t: number; n: Vec } | null {
  const e = sub(b, a), den = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(den) < 1e-12) return null;                       // 平行（包括沿着鏡面掠過）
  const ap = sub(a, p);
  const t = (ap[0] * e[1] - ap[1] * e[0]) / den, s = (ap[0] * d[1] - ap[1] * d[0]) / den;
  if (t <= EPS || s < -1e-9 || s > 1 + 1e-9) return null;
  let n: Vec = norm([-e[1], e[0]]); if (dot(n, d) > 0) n = mul(n, -1);   // 法線指向入射一側
  return { t, n };
}
function hitCircle(p: Vec, d: Vec, c: Vec, r: number, a0?: number, a1?: number): { t: number; n: Vec } | null {
  const f = sub(p, c), b = dot(f, d), cc = dot(f, f) - r * r, disc = b * b - cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  for (const t of [-b - s, -b + s]) {
    if (t <= EPS) continue;
    const q = add(p, mul(d, t));
    if (a0 !== undefined && a1 !== undefined) {
      const ang = Math.atan2(q[1] - c[1], q[0] - c[0]); const span = ((a1 - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const rel = ((ang - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      if (rel > span + 1e-9) continue;
    }
    let n: Vec = norm(sub(q, c)); if (dot(n, d) > 0) n = mul(n, -1);
    return { t, n };
  }
  return null;
}
const hitEdge = (p: Vec, d: Vec, e: Edge) => (e.kind === "seg" ? hitSeg(p, d, e.a, e.b) : hitCircle(p, d, e.c, e.r, e.a0, e.a1));

export type EventKind = "reflect" | "refract" | "tir";
export interface RayEvent { kind: EventKind; p: Vec; n: Vec; i: number; r?: number; C?: number; n1: number; n2: number; glass?: Glass }   // 角度 / °；n 為入射一側的法線
export type Outcome = "hit" | "out" | "block";
export interface Beam { points: Vec[]; events: RayEvent[]; outcome: Outcome; length: number }
export interface TraceResult { beams: Beam[]; hit: boolean; length: number }

const MAX_SEG = 80;
export function traceBeam(sc: Scene, pos: Vec, dirDeg: number): Beam {
  let p = pos, d = dirOf(dirDeg), inside: Glass | null = null, n1 = 1;
  const points: Vec[] = [p], events: RayEvent[] = [];
  let outcome: Outcome = "out", length = 0;
  for (let k = 0; k < MAX_SEG; k++) {
    let best: Hit | null = null;
    const consider = (h: { t: number; n: Vec } | null, kind: HitKind, extra?: Partial<Hit>) => { if (h && (!best || h.t < best.t)) best = { t: h.t, kind, n: h.n, ...extra }; };
    for (const e of rectEdges(0, 0, W, H)) consider(hitEdge(p, d, e), "bound");
    for (const b of sc.blocks) for (const e of rectEdges(b.x0, b.y0, b.x1, b.y1)) consider(hitEdge(p, d, e), "block");
    if (sc.target.kind === "spot") consider(hitCircle(p, d, sc.target.c, sc.target.r), "target");
    else consider(hitSeg(p, d, sc.target.a, sc.target.b), "target");
    for (const m of sc.mirrors) consider(hitSeg(p, d, m.a, m.b), "mirror");
    for (const g of sc.glass) for (const e of g.edges) consider(hitEdge(p, d, e), "glass", { glass: g });
    if (!best) break;                                             // 理論上不會（棋盤邊界永遠在）
    const h: Hit = best;
    const q = add(p, mul(d, h.t)); points.push(q); length += h.t;
    const cos1 = Math.min(1, -dot(d, h.n)), i = deg(Math.acos(cos1));
    if (h.kind === "bound") { outcome = "out"; break; }
    if (h.kind === "block") { outcome = "block"; break; }
    if (h.kind === "target") { outcome = "hit"; break; }
    if (h.kind === "mirror") { d = reflect(d, h.n); events.push({ kind: "reflect", p: q, n: h.n, i, r: i, n1, n2: n1 }); }
    else {
      const g = h.glass!, leaving: boolean = inside === g, n2 = leaving ? 1 : g.n;
      const sin1 = Math.sqrt(Math.max(0, 1 - cos1 * cos1)), ratio = n1 / n2, sin2 = ratio * sin1;
      if (sin2 > 1) { d = reflect(d, h.n); events.push({ kind: "tir", p: q, n: h.n, i, C: deg(Math.asin(1 / n1)), n1, n2, glass: g }); }
      else {
        const cos2 = Math.sqrt(1 - sin2 * sin2);
        d = norm(add(mul(d, ratio), mul(h.n, ratio * cos1 - cos2)));
        events.push({ kind: "refract", p: q, n: h.n, i, r: deg(Math.asin(sin2)), C: n1 > n2 ? deg(Math.asin(n2 / n1)) : undefined, n1, n2, glass: g });
        inside = leaving ? null : g; n1 = n2;
      }
    }
    p = q;
  }
  return { points, events, outcome, length };
}

export function trace(L: Level, st: State): TraceResult {
  const sc = sceneOf(L, st);
  const beams = sc.lasers.map(l => traceBeam(sc, l.pos, l.dir));
  return { beams, hit: beams.every(b => b.outcome === "hit"), length: Math.max(...beams.map(b => b.length)) };
}

// ---- 狀態 ----
export const initialState = (L: Level): State => ({ theta: L.angle?.start ?? 0, placed: L.slots.map(() => null), ...L.start });
export const remaining = (L: Level, st: State, type: PieceType) => (L.inventory[type] ?? 0) - st.placed.filter(p => p?.type === type).length;
export const normRot = (type: PieceType, r: number) => ((r % ROT_MOD[type]) + ROT_MOD[type]) % ROT_MOD[type];
/** 拖動旋轉：吸附到 DRAG_STEP 的格 */
export const snapRot = (type: PieceType, r: number) => normRot(type, Math.round(r / DRAG_STEP) * DRAG_STEP);

/** 命中時的星數（1–3） */
export function starsFor(L: Level, ctx: { shots: number; theta: number }): number {
  if (L.stars?.kind === "band") return ctx.theta >= L.stars.three ? 3 : ctx.theta >= L.stars.two ? 2 : 1;
  return ctx.shots <= 1 ? 3 : ctx.shots <= 3 ? 2 : 1;
}

/** 控制項格點上的全部解（測試用）：角度 1° 一格、元件 15° 一格、每個格位窮舉 */
export function solutions(L: Level): State[] {
  const thetas = L.angle ? Array.from({ length: L.angle.max - L.angle.min + 1 }, (_, i) => L.angle!.min + i) : [0];
  const types = (Object.keys(L.inventory) as PieceType[]).filter(t => (L.inventory[t] ?? 0) > 0);
  const pieces: PieceType[] = types.flatMap(t => Array(L.inventory[t]!).fill(t));
  const out: State[] = [];
  const placements: (Placed | null)[][] = [];
  const rec = (k: number, cur: (Placed | null)[], from: number) => {
    if (k === pieces.length) { placements.push([...cur]); return; }
    const type = pieces[k];
    for (let s = from; s < L.slots.length; s++) {           // 同類元件不分先後：後一件只放在前一件之後的格，避免重複
      if (cur[s]) continue;
      for (let r = 0; r < ROT_MOD[type]; r += ROT_STEP) { cur[s] = { type, rot: r }; rec(k + 1, cur, pieces[k + 1] === type ? s + 1 : 0); }
      cur[s] = null;
    }
  };
  rec(0, L.slots.map(() => null), 0);
  for (const theta of thetas) for (const placed of placements) { const st = { theta, placed }; if (trace(L, st).hit) out.push({ theta, placed: placed.map(p => (p ? { ...p } : null)) }); }
  return out;
}

// ---- 進度（localStorage，私隱模式失敗也不影響遊戲）----
const KEY = "dsepl-game-laser-maze";
export type Progress = Record<string, number>;   // levelId → 最佳星數
export const loadProgress = (): Progress => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };
export const saveProgress = (p: Progress) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* 私隱模式 */ } };
