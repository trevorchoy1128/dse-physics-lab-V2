import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas2D, SCENE, monoFont, theme, tick, uiFont } from "@/components";
import { sig } from "@/shell/format";
import { useT } from "@/i18n/lang";
import type { Text } from "@/shell/types";
import { UNIT_COLORS } from "@/app/units";
import { TopBar } from "@/app/TopBar";
import { navigate } from "@/app/router";
import { LEVELS, PARTS } from "./levels";
import {
  DEFAULT_ROT, H, ROT_STEP, W, dirOf, initialState, loadProgress, normRot, remaining, saveProgress, sceneOf, snapRot, starsFor, trace,
  type Beam, type Level, type PieceType, type Progress, type RayEvent, type State, type TraceResult, type Vec,
} from "./game";

// 激光迷宮：畫面與互動。光學全部在 game.ts；這裏只畫棋盤、元件、光線，並把格位／角度交回 State。
// 棋盤 12 × 8 格，比例每關固定；元件按虛線格放入、在棋盤上拖動即旋轉（吸附 5°）；光線在按「發射」後沿路徑生長，完成才判定命中。

interface Fired { st: State; result: TraceResult }
const GHOSTS = 3;
const SPEED = 9;                  // 光線生長速度 / 格 s⁻¹
const STAR = (n: number) => "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n);
const LETTER = (i: number) => String.fromCharCode(65 + i);
const PIECE_NAME: Record<PieceType, Text> = { mirror: { zh: "平面鏡", en: "Plane mirror" }, prism: { zh: "直角稜鏡", en: "Right-angle prism" } };
const PIECE_GLYPH: Record<PieceType, string> = { mirror: "▬", prism: "◣" };
const SLOT_R = 0.62;              // 按棋盤時算作「按中格位」的距離 / 格

export default function LaserMaze() {
  const t = useT();
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [li, setLi] = useState(() => { const p = loadProgress(); const i = LEVELS.findIndex(l => !p[l.id]); return i < 0 ? 0 : i; });
  const L = LEVELS[li];
  const [st, setStRaw] = useState<State>(() => initialState(L));
  const [sel, setSel] = useState<number | null>(null);
  const [shots, setShots] = useState<Fired[]>([]);
  const [current, setCurrent] = useState<Fired | null>(null);     // 最後一炮（狀態未改動時顯示）
  const [firing, setFiring] = useState<Fired | null>(null);
  const [len, setLen] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const raf = useRef(0);
  const shotsRef = useRef<Fired[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ slot: number; type: PieceType; rot0: number; a0: number } | null>(null);   // 拖動旋轉中的元件

  const setSt = useCallback((f: (s: State) => State) => { setStRaw(f); setCurrent(null); }, []);

  const openLevel = useCallback((i: number) => {
    cancelAnimationFrame(raf.current);
    const nl = LEVELS[i];
    setLi(i); setStRaw(initialState(nl)); setSel(null); dragRef.current = null;
    shotsRef.current = [];
    setShots([]); setCurrent(null); setFiring(null); setLen(0); setShowHint(false);
  }, []);

  // 發射：算好整條光路，再沿路徑生長；完成才記錄結果與星數
  const fire = useCallback(() => {
    if (firing) return;
    const result = trace(L, st);
    const f: Fired = { st: { theta: st.theta, placed: st.placed.map(p => (p ? { ...p } : null)) }, result };
    setFiring(f); setCurrent(null); setLen(0);
    const total = result.length, dur = Math.max(0.5, total / SPEED);
    const t0 = performance.now();
    const loop = () => {
      const k = (performance.now() - t0) / 1000 / dur;
      if (k >= 1) {
        setLen(total); setFiring(null); setCurrent(f);
        shotsRef.current = [...shotsRef.current, f]; setShots(shotsRef.current);
        if (result.hit) {
          const stars = starsFor(L, { shots: shotsRef.current.length, theta: f.st.theta });
          setProgress(p => { if ((p[L.id] ?? 0) >= stars) return p; const np = { ...p, [L.id]: stars }; saveProgress(np); return np; });   // 最佳星數
        }
        return;
      }
      setLen(k * total); raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }, [L, st, firing]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => {
    // Enter 只在滑桿 / 數字欄有焦點時發射；在按鈕上按 Enter 是按鈕自己的事
    const on = (e: KeyboardEvent) => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) { e.preventDefault(); fire(); } };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, [fire]);

  // 格位：空格且有剩餘元件即放入（每關只有一種元件），有元件則選取
  const types = (Object.keys(L.inventory) as PieceType[]).filter(k => (L.inventory[k] ?? 0) > 0);
  const tapSlot = useCallback((i: number) => {
    setSel(i);
    setSt(s => {
      if (s.placed[i]) return s;
      const type = types.find(k => remaining(L, s, k) > 0); if (!type) return s;
      const placed = [...s.placed]; placed[i] = { type, rot: DEFAULT_ROT[type] }; return { ...s, placed };
    });
  }, [L, types, setSt]);
  const rotate = (i: number, d: number) => setSt(s => { const p = s.placed[i]; if (!p) return s; const placed = [...s.placed]; placed[i] = { ...p, rot: normRot(p.type, p.rot + d) }; return { ...s, placed }; });
  const remove = (i: number) => setSt(s => { const placed = [...s.placed]; placed[i] = null; return { ...s, placed }; });
  const place = (i: number, type: PieceType) => setSt(s => { const placed = [...s.placed]; placed[i] = { type, rot: DEFAULT_ROT[type] }; return { ...s, placed }; });

  // 棋盤指標：按空格 → 放入；按已放的元件並拖動 → 旋轉（元件跟着手指轉，吸附 5°）
  const worldOf = (e: React.PointerEvent<HTMLDivElement>): Vec => {
    const r = stageRef.current!.getBoundingClientRect(); const lay = layout(r.width, r.height);
    return [(e.clientX - r.left - lay.ox) / lay.sc, (r.height - (e.clientY - r.top) - lay.oy) / lay.sc];
  };
  const nearestSlot = ([x, y]: Vec) => { let best = -1, bd = SLOT_R; L.slots.forEach(([sx, sy], i) => { const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = i; } }); return best; };
  const angleAt = ([x, y]: Vec, i: number) => (Math.atan2(y - L.slots[i][1], x - L.slots[i][0]) * 180) / Math.PI;
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (firing || !L.slots.length) return;
    const w = worldOf(e), i = nearestSlot(w); if (i < 0) return;
    const p = st.placed[i];
    if (p) { setSel(i); dragRef.current = { slot: i, type: p.type, rot0: p.rot, a0: angleAt(w, i) }; e.currentTarget.setPointerCapture(e.pointerId); }
    else tapSlot(i);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current; if (!d) return;
    const rot = snapRot(d.type, d.rot0 + angleAt(worldOf(e), d.slot) - d.a0);
    setSt(s => { const p = s.placed[d.slot]; if (!p || p.rot === rot) return s; const placed = [...s.placed]; placed[d.slot] = { ...p, rot }; return { ...s, placed }; });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const shown = firing ?? current;                      // 畫面上正在畫的一炮
  const done = !firing && !!current;
  const hit = done && current!.result.hit;
  const stars = hit ? starsFor(L, { shots: shots.length, theta: current!.st.theta }) : 0;

  const draw = useMemo(() => makeDraw(L, st, sel, shown, firing ? len : Infinity, shots.filter(s => s !== current).slice(-GHOSTS), done, t), [L, st, sel, shown, firing, len, shots, current, done, t]);   // Canvas2D 在 draw 改變時重畫

  const unitColor = UNIT_COLORS["c3"];
  const ev0 = current?.result.beams[0].events ?? [];
  const missMsg = (): string => {
    const b0 = current!.result.beams[0];
    if (b0.outcome === "block") return t({ zh: "撞到障礙", en: "Blocked" });
    const leak = b0.events.find(e => e.kind === "refract" && e.n1 > e.n2);
    if (leak && L.id === "fibre") return t({ zh: `光在纖壁漏出了：纖壁入射角 ${sig(leak.i)}° 小於臨界角 ${sig(leak.C!)}°`, en: `Light leaked through the wall: angle ${sig(leak.i)}° at the wall is below C = ${sig(leak.C!)}°` });
    if (leak && L.id === "tir") return t({ zh: `入射角 ${sig(leak.i)}° 小於臨界角 ${sig(leak.C!)}°，光折射出去了`, en: `Angle of incidence ${sig(leak.i)}° is below C = ${sig(leak.C!)}°: the ray refracted out` });
    return t({ zh: "射失了，光線離開棋盤", en: "Missed: the ray left the board" });
  };

  return (
    <>
      <TopBar />
      <main className="wrap game" style={{ ["--unit" as string]: unitColor }}>
        <button type="button" className="back" onClick={() => navigate("#/games")}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d="M9 2 4 7l5 5" /></svg>{t({ zh: "返回遊戲", en: "Back to games" })}
        </button>
        <div className="game-head">
          <div>
            <div className="code">{t({ zh: "遊戲 · 光的反射與折射", en: "Game · Reflection and refraction" })}</div>
            <h2>{t({ zh: "激光迷宮", en: "Laser Maze" })}</h2>
          </div>
          <div className="level-groups">
            {PARTS.map(P => (
              <div className="level-group" key={P.part}>
                <div className="lg-name">{t(P.name)}</div>
                <div className="levels" role="tablist" aria-label={t(P.name)}>
                  {LEVELS.map((l, i) => l.part === P.part && (
                    <button key={l.id} type="button" role="tab" aria-selected={i === li} className={progress[l.id] ? "done" : ""} onClick={() => openLevel(i)} title={t(l.name)}>
                      <b>{i + 1}</b><span>{progress[l.id] ? STAR(progress[l.id]) : "☆☆☆"}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="game-main">
          <div className="game-stage" ref={stageRef} style={{ aspectRatio: `${W} / ${H}`, cursor: L.slots.length ? "pointer" : "default", touchAction: "none" }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <Canvas2D draw={draw} frame={0} />
            {done && (
              <div className={`shot-banner ${hit ? "hit" : "block"}`} aria-live="polite">
                {hit ? (
                  <>
                    <b>{t({ zh: "命中！", en: "Hit!" })} <span className="stars">{STAR(stars)}</span></b>
                    {L.stars?.kind === "band" && stars < 3 && <p>{t({ zh: "命中了，但入射角還可以再大。", en: "Hit, but a larger angle would still work." })}</p>}
                  </>
                ) : <b>{missMsg()}</b>}
              </div>
            )}
          </div>
          <aside className="panel game-panel">
            <div className="level-name"><span className="n">{li + 1} / {LEVELS.length}</span>{t(L.name)}</div>
            <p className="brief">{t(L.brief)}</p>
            <p className="g-note">{L.note ? t(L.note) + " " : ""}{t({ zh: "理想化：只畫折射線或反射線，不畫界面的弱反射。", en: "Idealised: only the refracted or reflected ray is drawn, never the weak surface reflection." })}</p>

            {L.angle && (
              <>
                <h2>{t({ zh: "激光方向", en: "Laser direction" })}</h2>
                <Slider symbol="θ" label={t(L.angle.label)} unit="°" min={L.angle.min} max={L.angle.max} step={1} value={st.theta} disabled={!!firing} onChange={v => setSt(s => ({ ...s, theta: v }))} />
              </>
            )}

            {L.slots.length > 0 && (
              <>
                <h2>{t({ zh: "光學元件", en: "Optical pieces" })}</h2>
                <p className="inv">{types.map(k => <span key={k}>{t(PIECE_NAME[k])} <b>{remaining(L, st, k)} / {L.inventory[k]}</b></span>)}</p>
                <p className="stage-tip">{t({ zh: "按棋盤上的虛線格放入元件；拖動元件即可旋轉（或用下面的按鈕，每按 15°）。", en: "Tap a dashed slot on the board to place a piece; drag the piece to turn it (or use the buttons below, 15° a press)." })}</p>
                <div className="slot-row" role="group" aria-label={t({ zh: "格位", en: "Slots" })}>
                  {L.slots.map((_, i) => { const p = st.placed[i]; return (
                    <button key={i} type="button" className={`slot-btn${p ? " has" : ""}`} aria-pressed={sel === i} disabled={!!firing} onClick={() => tapSlot(i)} aria-label={`${t({ zh: "格位", en: "Slot" })} ${LETTER(i)}`}>
                      <b>{LETTER(i)}</b><span className="pc">{p ? `${PIECE_GLYPH[p.type]} ${tick(p.rot)}°` : "·"}</span>
                    </button>); })}
                </div>
                {sel !== null && (st.placed[sel] ? (
                  <div className="rot-row">
                    <button type="button" className="lever-btn" disabled={!!firing} onClick={() => rotate(sel, -ROT_STEP)} aria-label={t({ zh: "順時針轉 15°", en: "Turn 15° clockwise" })}>↻</button>
                    <div className="lever-val pos"><i>{LETTER(sel)}</i>&nbsp;{t(PIECE_NAME[st.placed[sel]!.type])}&nbsp;<span className="mono">{tick(st.placed[sel]!.rot)}°</span></div>
                    <button type="button" className="lever-btn" disabled={!!firing} onClick={() => rotate(sel, ROT_STEP)} aria-label={t({ zh: "逆時針轉 15°", en: "Turn 15° anticlockwise" })}>↺</button>
                    <button type="button" className="retry" disabled={!!firing} onClick={() => remove(sel)}>{t({ zh: "移除", en: "Remove" })}</button>
                  </div>
                ) : (
                  <div className="place-row">
                    {types.map(k => <button key={k} type="button" className="place" disabled={!!firing || remaining(L, st, k) <= 0} onClick={() => place(sel, k)}>{t({ zh: `放入${PIECE_NAME[k].zh}`, en: `Place ${PIECE_NAME[k].en.toLowerCase()}` })}</button>)}
                    {types.every(k => remaining(L, st, k) <= 0) && <p className="key-hint">{t({ zh: "元件已用完：先在另一格移除。", en: "No pieces left: remove one from another slot first." })}</p>}
                  </div>
                ))}
              </>
            )}

            <div className="fire-row">
              <button type="button" className="fire" onClick={fire} disabled={!!firing}>{firing ? t({ zh: "發射中…", en: "Firing…" }) : t({ zh: "發射", en: "Fire" })}</button>
              <span className="shots-n">{t({ zh: "已發射", en: "Shots" })} <b>{shots.length}</b></span>
            </div>

            {current && ev0.length > 0 && (
              <>
                <h2>{t({ zh: "光路", en: "Light path" })}</h2>
                <table className="readouts">
                  <tbody>
                    {ev0.slice(0, 6).map((e, k) => <tr key={k}><th>{k + 1}</th><td>{describe(e, t)}</td></tr>)}
                    {ev0.length > 6 && <tr><th>…</th><td>{t({ zh: `共 ${ev0.length} 次`, en: `${ev0.length} in total` })}</td></tr>}
                  </tbody>
                </table>
              </>
            )}

            <h2>{t({ zh: "提示", en: "Hint" })}</h2>
            <button type="button" className="hint-btn" aria-expanded={showHint} onClick={() => setShowHint(v => !v)}>{showHint ? t({ zh: "收起提示", en: "Hide hint" }) : t({ zh: "看公式提示", en: "Show formula hint" })}</button>
            {showHint && (
              <div className="hint-box">
                <p>{t(L.hint)}</p>
                <p className="formulas">{t({ zh: "反射：", en: "Reflection: " })}<i>i</i> = <i>r</i> · {t({ zh: "折射：", en: "Refraction: " })}<i>n</i>₁ sin <i>θ</i>₁ = <i>n</i>₂ sin <i>θ</i>₂ · sin <i>C</i> = 1 / <i>n</i></p>
              </div>
            )}

            {hit && (
              <div className="next-row">
                {li + 1 < LEVELS.length
                  ? <button type="button" className="next" onClick={() => openLevel(li + 1)}>{t({ zh: "下一關 →", en: "Next level →" })}</button>
                  : <p className="all-done">{t({ zh: "全部關卡完成！", en: "All levels complete!" })} {Object.values(progress).reduce((a, b) => a + b, 0)} / {LEVELS.length * 3} ★</p>}
                <button type="button" className="retry" onClick={() => openLevel(li)}>{t({ zh: "重玩本關", en: "Replay level" })}</button>
              </div>
            )}
            {!hit && shots.length > 0 && <button type="button" className="retry" onClick={() => openLevel(li)}>{t({ zh: "重置本關", en: "Reset level" })}</button>}
          </aside>
        </div>
      </main>
    </>
  );
}

const ang = (v: number) => sig(Math.abs(v) < 5e-3 ? 0 : v);   // 垂直入射的浮點殘差（10⁻⁶°）顯示為 0
function describe(e: RayEvent, t: (x: Text) => string): React.ReactNode {
  const med = (n: number, g?: { name?: Text }) => (n === 1 ? t({ zh: "空氣", en: "air" }) : g?.name ? t(g.name) : `n = ${sig(n)}`);
  if (e.kind === "reflect") return <>{t({ zh: "平面鏡反射", en: "Reflection at the mirror" })}：<i>i</i> = {ang(e.i)}°，<i>r</i> = {ang(e.i)}°</>;
  if (e.kind === "tir") return <>{t({ zh: "全內反射", en: "Total internal reflection" })}：<i>i</i> = {ang(e.i)}° &gt; <i>C</i> = {ang(e.C!)}°</>;
  return <>{med(e.n1, e.glass)} → {med(e.n2, e.glass)}：<i>i</i> = {ang(e.i)}°，<i>r</i> = {ang(e.r!)}°{e.C !== undefined && <> (&lt; <i>C</i> = {ang(e.C)}°)</>}</>;
}

function Slider({ symbol, label, unit, min, max, step, value, disabled, onChange }: { symbol: string; label: string; unit: string; min: number; max: number; step: number; value: number; disabled: boolean; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="control">
      <label><i>{symbol}</i> {label} <span className="u-unit">/ {unit}</span></label>
      <div className="slider-row">
        <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e => onChange(+e.target.value)} aria-label={label} />
        <input type="number" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e => { const v = +e.target.value; if (Number.isFinite(v)) onChange(clamp(v)); }} aria-label={label} />
      </div>
    </div>
  );
}

// ---- 畫面：棋盤座標（格）→ 像素，每關固定 ----
const PAD = 8;
function layout(w: number, h: number) {
  const sc = Math.min((w - 2 * PAD) / W, (h - 2 * PAD) / H);
  return { sc, ox: (w - W * sc) / 2, oy: (h - H * sc) / 2 };
}

function makeDraw(L: Level, st: State, sel: number | null, shown: Fired | null, lenLimit: number, ghosts: Fired[], done: boolean, t: (x: Text) => string) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const T = theme();
    const { sc, ox, oy } = layout(w, h);
    const px = (x: number) => ox + x * sc, py = (y: number) => h - oy - y * sc;
    const P = (v: Vec): [number, number] => [px(v[0]), py(v[1])];
    const scene = sceneOf(L, st);

    // 棋盤：淡藍底、格線
    const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, SCENE.skyTop); bg.addColorStop(1, SCENE.skyBottom);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = T.line; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x++) { ctx.beginPath(); ctx.moveTo(px(x), py(0)); ctx.lineTo(px(x), py(H)); ctx.stroke(); }
    for (let y = 0; y <= H; y++) { ctx.beginPath(); ctx.moveTo(px(0), py(y)); ctx.lineTo(px(W), py(y)); ctx.stroke(); }
    ctx.strokeStyle = T.ink3; ctx.lineWidth = 1.5; ctx.strokeRect(px(0), py(H), W * sc, H * sc);

    // 玻璃／水（固定的與放置的稜鏡）
    for (const g of scene.glass) {
      ctx.beginPath();
      g.edges.forEach((e, k) => {
        if (e.kind === "seg") { if (k === 0) ctx.moveTo(...P(e.a)); ctx.lineTo(...P(e.b)); }
        else { const n = 40, span = ((e.a1 - e.a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI; for (let j = 0; j <= n; j++) { const a = e.a0 + (span * j) / n; const q: Vec = [e.c[0] + e.r * Math.cos(a), e.c[1] + e.r * Math.sin(a)]; if (k === 0 && j === 0) ctx.moveTo(...P(q)); else ctx.lineTo(...P(q)); } }
      });
      ctx.closePath();
      ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = SCENE.objectB; ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.75; ctx.strokeStyle = SCENE.objectBEdge; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      if (g.label && g.labelAt) { ctx.font = uiFont(12); ctx.fillStyle = T.ink2; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(t(g.label), px(g.labelAt[0]), py(g.labelAt[1])); }
    }

    // 障礙（磚牆）
    for (const b of scene.blocks) {
      const X = px(b.x0), Y = py(b.y1), BW = (b.x1 - b.x0) * sc, BH = (b.y1 - b.y0) * sc;
      ctx.fillStyle = SCENE.post; ctx.fillRect(X, Y, BW, BH);
      ctx.strokeStyle = SCENE.hub; ctx.lineWidth = 1;
      for (let yy = b.y0 + 0.5; yy < b.y1; yy += 0.5) { ctx.beginPath(); ctx.moveTo(X, py(yy)); ctx.lineTo(X + BW, py(yy)); ctx.stroke(); }
      ctx.strokeStyle = SCENE.wheel; ctx.lineWidth = 1.5; ctx.strokeRect(X, Y, BW, BH);
    }

    // 格位（虛線方格 + 字母）；選中的畫實線，有元件的另加旋轉提示圈
    L.slots.forEach(([x, y], i) => {
      const s = 0.84 * sc;
      ctx.save();
      if (sel === i) { ctx.strokeStyle = T.unit; ctx.lineWidth = 2.5; } else { ctx.strokeStyle = SCENE.muted; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); }
      ctx.strokeRect(px(x) - s / 2, py(y) - s / 2, s, s); ctx.restore();
      ctx.font = monoFont(11, "700"); ctx.fillStyle = sel === i ? T.unit : T.ink3; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(LETTER(i), px(x) - s / 2 + 3, py(y) - s / 2 + 2);
      if (sel === i && st.placed[i]) { ctx.save(); ctx.globalAlpha = 0.45; ctx.setLineDash([3, 4]); ctx.strokeStyle = T.unit; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px(x), py(y), 0.62 * sc, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    });

    // 探測器：圓點或探測條；命中時亮起
    const lit = done && shown?.result.hit;
    const tg = scene.target;
    if (tg.kind === "spot") {
      const [cx, cy] = P(tg.c), r = tg.r * sc;
      if (tg.fish) fish(ctx, cx, cy, sc);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (tg.fish) { ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = lit ? SCENE.leaf : SCENE.post; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
      else { ctx.fillStyle = lit ? SCENE.leaf : SCENE.white; ctx.fill(); ctx.strokeStyle = SCENE.wheel; ctx.lineWidth = Math.max(2, r * 0.35); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2); ctx.fillStyle = lit ? SCENE.white : SCENE.wheel; ctx.fill(); }
      if (lit) { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = SCENE.leaf; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    } else {
      ctx.strokeStyle = SCENE.wheel; ctx.lineWidth = Math.max(6, 0.14 * sc); ctx.lineCap = "butt";
      ctx.beginPath(); ctx.moveTo(...P(tg.a)); ctx.lineTo(...P(tg.b)); ctx.stroke();
      ctx.strokeStyle = lit ? SCENE.leaf : SCENE.hub; ctx.lineWidth = Math.max(2, 0.06 * sc); ctx.beginPath(); ctx.moveTo(...P(tg.a)); ctx.lineTo(...P(tg.b)); ctx.stroke();
    }
    ctx.font = uiFont(11); ctx.fillStyle = T.ink2; ctx.textAlign = "center"; ctx.textBaseline = "top";
    const tl: Vec = tg.kind === "spot" ? [tg.c[0], tg.c[1] - tg.r - 0.1] : [(tg.a[0] + tg.b[0]) / 2, Math.min(tg.a[1], tg.b[1]) - 0.1];
    ctx.fillText(t({ zh: "探測器", en: "detector" }), px(tl[0]), py(tl[1]));

    // 平面鏡（放置的稜鏡已在 glass 畫出）
    for (const m of scene.mirrors) {
      ctx.lineCap = "butt";
      ctx.strokeStyle = SCENE.wheel; ctx.lineWidth = Math.max(6, 0.12 * sc); ctx.beginPath(); ctx.moveTo(...P(m.a)); ctx.lineTo(...P(m.b)); ctx.stroke();
      ctx.strokeStyle = SCENE.hub; ctx.lineWidth = Math.max(2, 0.04 * sc); ctx.beginPath(); ctx.moveTo(...P(m.a)); ctx.lineTo(...P(m.b)); ctx.stroke();
    }

    // 激光器
    const lasers = scene.lasers;
    lasers.forEach(ls => {
      const d = dirOf(ls.dir), [x, y] = P(ls.pos);
      const bodyL = 0.7 * sc, bodyW = 0.28 * sc;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.atan2(d[1], d[0]));
      ctx.fillStyle = SCENE.wheel; ctx.fillRect(-bodyL, -bodyW / 2, bodyL, bodyW);
      ctx.fillStyle = SCENE.hub; ctx.fillRect(-bodyL + 3, -bodyW / 2 + 3, bodyL * 0.45, bodyW - 6);
      ctx.fillStyle = SCENE.flag; ctx.beginPath(); ctx.arc(0, 0, Math.max(3, 0.07 * sc), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // 未發射（調角度的關）：虛線由激光畫到第一個有角度的界面，並在入射介質一側畫入射角弧——學生調 θ 時看到的就是課本的入射角
    if (!shown && L.angle) {
      const b = trace(L, st).beams[0];
      let k = b.events.findIndex(e => e.i > 0.5); if (k < 0) k = b.events.length ? 0 : -1;
      if (k >= 0) {
        ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = SCENE.flag; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
        ctx.beginPath(); for (let j = 0; j <= k + 1; j++) { const q = P(b.points[j]); if (j) ctx.lineTo(...q); else ctx.moveTo(...q); } ctx.stroke(); ctx.restore();
        drawAngles(ctx, b, k, sc, P, T, t, true);
      }
    }

    // 叉魚關：直線瞄準參考
    if (L.aimLine && tg.kind === "spot") {
      ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = SCENE.ghost; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(...P(lasers[0].pos)); ctx.lineTo(...P(tg.c)); ctx.stroke(); ctx.restore();
      ctx.font = uiFont(11); ctx.fillStyle = T.ink3; ctx.textAlign = "left"; ctx.textBaseline = "top";
      const m: Vec = [(lasers[0].pos[0] + tg.c[0]) / 2 + 0.15, (lasers[0].pos[1] + tg.c[1]) / 2];
      ctx.fillText(t({ zh: "直線方向", en: "straight line" }), px(m[0]), py(m[1]));
    }

    // 上幾炮的光路（灰虛線）
    for (const g of ghosts) {
      ctx.save(); ctx.globalAlpha = 0.55; ctx.setLineDash([5, 5]); ctx.strokeStyle = g.result.hit ? SCENE.leaf : SCENE.ghost; ctx.lineWidth = 1.5;
      for (const b of g.result.beams) { ctx.beginPath(); b.points.forEach((q, k) => (k ? ctx.lineTo(...P(q)) : ctx.moveTo(...P(q)))); ctx.stroke(); }
      ctx.restore();
    }

    // 本炮光線：沿路徑生長到 lenLimit
    if (shown) {
      for (const b of shown.result.beams) {
        const pts: [number, number][] = []; let acc = 0;
        for (let k = 0; k < b.points.length; k++) {
          if (k === 0) { pts.push(P(b.points[0])); continue; }
          const a = b.points[k - 1], c = b.points[k], segL = Math.hypot(c[0] - a[0], c[1] - a[1]);
          if (acc + segL <= lenLimit) { pts.push(P(c)); acc += segL; }
          else { const f = Math.max(0, (lenLimit - acc) / segL); pts.push(P([a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f])); break; }
        }
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.save(); ctx.globalAlpha = 0.22; ctx.strokeStyle = SCENE.flag; ctx.lineWidth = 9; ctx.beginPath(); pts.forEach((q, k) => (k ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.stroke(); ctx.restore();
        ctx.strokeStyle = SCENE.flag; ctx.lineWidth = 2.5; ctx.beginPath(); pts.forEach((q, k) => (k ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.stroke();
        ctx.lineCap = "butt"; ctx.lineJoin = "miter";
      }
      // 完成後：頭三個界面畫法線、入射角弧與折射角（或反射角）弧；其餘只畫法線
      if (done) shown.result.beams[0].events.slice(0, 8).forEach((_, k) => drawAngles(ctx, shown.result.beams[0], k, sc, P, T, t, false, k < 3));
    }
    ctx.textBaseline = "alphabetic";
  };
}

// 界面 k 的法線（虛線）、入射角弧 i（入射介質一側，法線與入射線之間）、出射弧 r（反射：同側；折射：另一側）。live = 未發射，只畫 i 並標 θ
function drawAngles(ctx: CanvasRenderingContext2D, b: Beam, k: number, sc: number, P: (v: Vec) => [number, number], T: ReturnType<typeof theme>, t: (x: Text) => string, live: boolean, withArcs = true) {
  const e = b.events[k], n = e.n, [x, y] = P(e.p);
  const pIn = b.points[k], pOut = b.points[k + 2];
  const din: Vec = [e.p[0] - pIn[0], e.p[1] - pIn[1]];
  ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = T.ink3; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - n[0] * 0.9 * sc, y + n[1] * 0.9 * sc); ctx.lineTo(x + n[0] * 0.9 * sc, y - n[1] * 0.9 * sc); ctx.stroke(); ctx.restore();
  if (live || k === 0) { ctx.font = uiFont(11); ctx.fillStyle = T.ink3; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t({ zh: "法線", en: "normal" }), x + n[0] * 1.08 * sc, y - n[1] * 1.08 * sc); }
  if (!withArcs || e.i < 0.5) return;
  const back: Vec = [-din[0], -din[1]];
  const labI = live ? `θ = ${tick(+e.i.toFixed(1))}°` : e.kind === "tir" ? `i = ${tick(+e.i.toFixed(1))}° > C` : `i = ${tick(+e.i.toFixed(1))}°`;
  arcBetween(ctx, x, y, n, back, 0.45 * sc, T.unit, labI, sc);
  if (live || !pOut) return;
  const dout: Vec = [pOut[0] - e.p[0], pOut[1] - e.p[1]];
  const nOut: Vec = e.kind === "refract" ? [-n[0], -n[1]] : n;
  arcBetween(ctx, x, y, nOut, dout, 0.68 * sc, T.unit, `r = ${tick(+(e.r ?? e.i).toFixed(1))}°`, sc);   // 出射弧大一圈，標籤才不會與 i 重疊
}
/** 由方向 u1 到 u2 的短弧（世界座標方向，畫布 y 反轉），標籤放在弧中央外側 */
function arcBetween(ctx: CanvasRenderingContext2D, x: number, y: number, u1: Vec, u2: Vec, R: number, color: string, label: string, sc: number) {
  const A1 = Math.atan2(u1[1], u1[0]); let dA = Math.atan2(u2[1], u2[0]) - A1; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
  if (Math.abs(dA) < 0.005) return;
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, R, -A1, -(A1 + dA), dA > 0); ctx.stroke();
  const Am = A1 + dA / 2, lr = R + 0.38 * sc;
  ctx.font = uiFont(12, "700"); ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, x + Math.cos(Am) * lr, y - Math.sin(Am) * lr);
}

function fish(ctx: CanvasRenderingContext2D, cx: number, cy: number, sc: number) {
  const rx = 0.36 * sc, ry = 0.2 * sc;
  ctx.fillStyle = SCENE.objectA; ctx.strokeStyle = SCENE.objectAEdge; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + rx * 0.9, cy); ctx.lineTo(cx + rx * 1.5, cy - ry * 0.9); ctx.lineTo(cx + rx * 1.5, cy + ry * 0.9); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = SCENE.wheel; ctx.beginPath(); ctx.arc(cx - rx * 0.5, cy - ry * 0.2, Math.max(1.5, 0.035 * sc), 0, Math.PI * 2); ctx.fill();
}
