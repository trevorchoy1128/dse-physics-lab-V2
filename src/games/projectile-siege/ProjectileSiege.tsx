import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas2D, SCENE, drawArrow2D, monoFont, nice, theme, tick, uiFont } from "@/components";
import { sig } from "@/shell/format";
import { useT } from "@/i18n/lang";
import { UNIT_COLORS } from "@/app/units";
import { TopBar } from "@/app/TopBar";
import { navigate } from "@/app/router";
import { LEVELS } from "./levels";
import { loadProgress, saveProgress, simulateShot, starsFor, THETA_STEP, U_MIN, U_STEP, type Level, type Progress, type ShotResult } from "./game";

// 拋體攻城：畫面與互動。物理全部在 game.ts；這裏只畫 path 與讀時間。

interface Fired { u: number; theta: number; result: ShotResult }
const BALL_R = 0.45;              // 畫面上的炮彈半徑 / m（命中以球心計）
const GHOSTS = 5;                 // 保留幾條上次的路徑

const STAR = (n: number) => "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n);

export default function ProjectileSiege() {
  const t = useT();
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [li, setLi] = useState(() => { const p = loadProgress(); const i = LEVELS.findIndex(l => !p[l.id]); return i < 0 ? 0 : i; });
  const L = LEVELS[li];
  const [u, setU] = useState(L.start.u);
  const [theta, setTheta] = useState(L.start.theta);
  const [shots, setShots] = useState<Fired[]>([]);       // 本關已發射（最新在最後）
  const [flying, setFlying] = useState<Fired | null>(null);
  const [tNow, setTNow] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [hitSides, setHitSides] = useState<{ low: boolean; high: boolean }>({ low: false, high: false });
  const raf = useRef(0);
  const shotsRef = useRef<Fired[]>([]);                 // rAF 回呼內讀最新值用（state 在閉包內會過時）
  const sidesRef = useRef({ low: false, high: false });

  const openLevel = useCallback((i: number) => {
    const nl = LEVELS[i];
    cancelAnimationFrame(raf.current);
    setLi(i); setU(nl.lock?.u ?? nl.start.u); setTheta(nl.lock?.theta ?? nl.start.theta);
    shotsRef.current = []; sidesRef.current = { low: false, high: false };
    setShots([]); setFlying(null); setTNow(0); setShowHint(false); setHitSides({ low: false, high: false });
  }, []);

  const uEff = L.lock?.u ?? u, thetaEff = L.lock?.theta ?? theta;
  const last = shots.at(-1);
  const done = !flying && !!last;
  const hit = done && last!.result.outcome === "hit";
  const hitCount = shots.filter(s => s.result.outcome === "hit").length;
  const stars = hit ? starsFor(L, { shots: shots.length, u: last!.u, theta: last!.theta, hitBothSides: hitSides.low && hitSides.high }) : 0;

  // 發射：算好整條路徑，再按真實時間播放（月球飛行太長時加速，畫面比例不變）
  const fire = useCallback(() => {
    if (flying) return;
    const result = simulateShot(L, uEff, thetaEff);
    const f: Fired = { u: uEff, theta: thetaEff, result };
    setFlying(f); setTNow(0);
    const rate = Math.max(1, result.tEnd / 4);
    const t0 = performance.now();
    const loop = () => {
      const tt = ((performance.now() - t0) / 1000) * rate;
      if (tt >= result.tEnd) {
        setTNow(result.tEnd); setFlying(null);
        shotsRef.current = [...shotsRef.current, f]; setShots(shotsRef.current);
        if (result.outcome === "hit") {
          const sd = sidesRef.current;
          sidesRef.current = { low: sd.low || thetaEff < 45, high: sd.high || thetaEff > 45 }; setHitSides(sidesRef.current);
          const st = starsFor(L, { shots: shotsRef.current.length, u: uEff, theta: thetaEff, hitBothSides: sidesRef.current.low && sidesRef.current.high });
          setProgress(p => { if ((p[L.id] ?? 0) >= st) return p; const np = { ...p, [L.id]: st }; saveProgress(np); return np; });   // 最佳星數
        }
        return;
      }
      setTNow(tt); raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }, [L, uEff, thetaEff, flying]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => {
    // Enter 只在滑桿 / 數字欄有焦點時發射；在按鈕上按 Enter 是按鈕自己的事（否則按關卡鍵會同時發射）
    const on = (e: KeyboardEvent) => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) { e.preventDefault(); fire(); } };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, [fire]);

  const draw = useMemo(() => makeDraw(L, shots, flying, tNow, thetaEff), [L, shots, flying, tNow, thetaEff]);   // Canvas2D 在 draw 改變時重畫

  const unitColor = UNIT_COLORS[L.g < 5 ? "e1" : "c2"];
  const g = L.g;
  const twinNeed = L.goal === "twin" && hit && !(hitSides.low && hitSides.high);

  return (
    <>
      <TopBar />
      <main className="wrap game" style={{ ["--unit" as string]: unitColor }}>
        <button type="button" className="back" onClick={() => navigate("#/games")}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d="M9 2 4 7l5 5" /></svg>{t({ zh: "返回遊戲", en: "Back to games" })}
        </button>
        <div className="game-head">
          <div>
            <div className="code">{t({ zh: "遊戲 · 拋體運動", en: "Game · Projectile motion" })}</div>
            <h2>{t({ zh: "拋體攻城", en: "Projectile Siege" })}</h2>
          </div>
          <div className="levels" role="tablist" aria-label={t({ zh: "關卡", en: "Levels" })}>
            {LEVELS.map((l, i) => (
              <button key={l.id} type="button" role="tab" aria-selected={i === li} className={progress[l.id] ? "done" : ""} onClick={() => openLevel(i)} title={t(l.name)}>
                <b>{i + 1}</b><span>{progress[l.id] ? STAR(progress[l.id]) : "☆☆☆"}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="game-main">
          <div className="game-stage" style={{ aspectRatio: `${L.world.xMax + 8} / ${L.world.yMax}` }}>
            <Canvas2D draw={draw} frame={0} />
            {done && (
              <div className={`shot-banner ${last!.result.outcome}`} aria-live="polite">
                {hit ? (
                  <>
                    <b>{t({ zh: "命中！", en: "Hit!" })} <span className="stars">{STAR(stars)}</span></b>
                    {twinNeed && <p>{t({ zh: `再用另一個角度（${last!.theta < 45 ? "大於" : "小於"} 45°）命中，才有三星。`, en: `Hit again with the other angle (${last!.theta < 45 ? "above" : "below"} 45°) for three stars.` })}</p>}
                    {L.goal === "economy" && stars < 3 && <p>{t({ zh: "命中了，但初速還可以再小。", en: "Hit, but a smaller speed would do." })}</p>}
                  </>
                ) : last!.result.outcome === "block" ? (
                  <b>{t({ zh: "撞到障礙", en: "Hit an obstacle" })}</b>
                ) : (
                  <b>{t({ zh: `落在 ${sig(last!.result.xEnd)} m，${last!.result.miss > 0 ? "太遠" : "太近"} ${sig(Math.abs(last!.result.miss))} m`, en: `Landed at ${sig(last!.result.xEnd)} m, ${last!.result.miss > 0 ? "too far" : "too short"} by ${sig(Math.abs(last!.result.miss))} m` })}</b>
                )}
              </div>
            )}
          </div>
          <aside className="panel game-panel">
            <div className="level-name"><span className="n">{li + 1} / {LEVELS.length}</span>{t(L.name)}</div>
            <p className="brief">{t(L.brief)}</p>
            <p className="g-note">{t({ zh: "本關", en: "This level:" })} <i>g</i> = {sig(g)} m s⁻²{L.h > 0 && <>，<i>h</i> = {sig(L.h)} m</>}{t({ zh: "，無空氣阻力，命中以球心計。", en: ", no air resistance, hit judged at the ball's centre." })}</p>

            <h2>{t({ zh: "發射參數", en: "Launch" })}</h2>
            <Slider symbol="u" label={t({ zh: "初速", en: "Initial speed" })} unit="m s⁻¹" min={U_MIN} max={L.uMax} step={U_STEP} value={uEff} locked={L.lock?.u !== undefined} disabled={!!flying} onChange={setU} lockedText={t({ zh: "本關固定", en: "Locked" })} />
            <Slider symbol="θ" label={t({ zh: "投射角", en: "Angle of projection" })} unit="°" min={0} max={90} step={THETA_STEP} value={thetaEff} locked={L.lock?.theta !== undefined} disabled={!!flying} onChange={setTheta} lockedText={t({ zh: "本關固定", en: "Locked" })} />
            <div className="fire-row">
              <button type="button" className="fire" onClick={fire} disabled={!!flying}>{flying ? t({ zh: "飛行中…", en: "In flight…" }) : t({ zh: "發射", en: "Fire" })}</button>
              <span className="shots-n">{t({ zh: "已發射", en: "Shots" })} <b>{shots.length}</b></span>
            </div>

            {last && (
              <>
                <h2>{t({ zh: "上一炮", en: "Last shot" })}</h2>
                <table className="readouts">
                  <tbody>
                    <tr><th><i>u</i>, <i>θ</i></th><td>{sig(last.u)} m s⁻¹, {tick(last.theta)}°</td></tr>
                    <tr><th>{t({ zh: "射程", en: "Range" })} <span><i>R</i></span></th><td>{sig(last.result.R)} m</td></tr>
                    <tr><th>{t({ zh: "飛行時間", en: "Time of flight" })}</th><td>{sig(last.result.T)} s</td></tr>
                    <tr><th>{t({ zh: "最高點", en: "Highest point" })} <span><i>H</i></span></th><td>{sig(last.result.H)} m</td></tr>
                    {last.result.outcome === "ground" && <tr><th>{t({ zh: "與目標相差", en: "Off by" })}</th><td>{last.result.miss > 0 ? "+" : "−"}{sig(Math.abs(last.result.miss))} m</td></tr>}
                  </tbody>
                </table>
              </>
            )}

            <h2>{t({ zh: "提示", en: "Hint" })}</h2>
            <button type="button" className="hint-btn" aria-expanded={showHint} onClick={() => setShowHint(v => !v)}>{showHint ? t({ zh: "收起提示", en: "Hide hint" }) : t({ zh: "看公式提示", en: "Show formula hint" })}</button>
            {showHint && (
              <div className="hint-box">
                <p>{t(L.hint)}</p>
                <p className="formulas"><i>R</i> = <i>u</i>² sin 2<i>θ</i> / <i>g</i> · <i>T</i> = 2<i>u</i> sin <i>θ</i> / <i>g</i> · <i>H</i> = <i>u</i>² sin²<i>θ</i> / 2<i>g</i></p>
                <p className="formulas"><i>x</i> = <i>u</i> cos <i>θ</i> · <i>t</i> · <i>y</i> = <i>h</i> + <i>u</i> sin <i>θ</i> · <i>t</i> − ½<i>gt</i>²</p>
              </div>
            )}

            {hit && (
              <div className="next-row">
                {li + 1 < LEVELS.length
                  ? <button type="button" className="next" onClick={() => openLevel(li + 1)}>{t({ zh: "下一關 →", en: "Next level →" })}</button>
                  : <p className="all-done">{t({ zh: "全部關卡完成！", en: "All levels complete!" })} {Object.values(progress).reduce((a, b) => a + b, 0)} / {LEVELS.length * 3} ★</p>}
                {(hitCount > 0) && <button type="button" className="retry" onClick={() => openLevel(li)}>{t({ zh: "重玩本關", en: "Replay level" })}</button>}
              </div>
            )}
            {!hit && shots.length > 0 && <button type="button" className="retry" onClick={() => openLevel(li)}>{t({ zh: "清除路徑", en: "Clear paths" })}</button>}
          </aside>
        </div>
      </main>
    </>
  );
}

function Slider({ symbol, label, unit, min, max, step, value, locked, disabled, onChange, lockedText }: { symbol: string; label: string; unit: string; min: number; max: number; step: number; value: number; locked: boolean; disabled: boolean; onChange: (v: number) => void; lockedText: string }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="control">
      <label><i>{symbol}</i> {label} <span className="u-unit">/ {unit}</span>{locked && <span className="lock"> 🔒 {lockedText}</span>}</label>
      {locked ? (
        <div className="locked-val mono">{step < 1 ? sig(value) : tick(value)} {unit}</div>
      ) : (
        <div className="slider-row">
          <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e => onChange(+e.target.value)} aria-label={label} />
          <input type="number" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e => { const v = +e.target.value; if (Number.isFinite(v)) onChange(clamp(v)); }} aria-label={label} />
        </div>
      )}
    </div>
  );
}

// ---- 畫面：世界座標（米）→ 像素，每關固定，播放中不變 ----
function makeDraw(L: Level, shots: Fired[], flying: Fired | null, tNow: number, thetaDeg: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const T = theme();
    const xMin = -8, xMax = L.world.xMax, yMax = L.world.yMax;
    const padL = 40, padB = 30, padT = 16, padR = 48;
    const sc = Math.min((w - padL - padR) / (xMax - xMin), (h - padT - padB) / yMax);
    const px = (x: number) => padL + (x - xMin) * sc, py = (y: number) => h - padB - y * sc;

    // 天空與地面
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, SCENE.skyTop); sky.addColorStop(1, SCENE.skyBottom);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = SCENE.cloud;
    for (const [cx, cy, r] of [[xMax * 0.2, yMax * 0.85, 2.2], [xMax * 0.55, yMax * 0.9, 2.8], [xMax * 0.85, yMax * 0.8, 2]] as const) {
      ctx.beginPath(); ctx.ellipse(px(cx), py(cy), r * sc * 1.6, r * sc * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = SCENE.ground; ctx.fillRect(0, py(0), w, h - py(0));
    ctx.strokeStyle = SCENE.leaf; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(w, py(0)); ctx.stroke();

    // 距離柱（每 nice(xMax/8) m）與高度尺
    const dx = nice(xMax / 8), dy = nice(yMax / 5);
    ctx.font = monoFont(11); ctx.fillStyle = T.ink2; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.strokeStyle = SCENE.post; ctx.lineWidth = 1;
    for (let x = 0; x <= xMax + 1e-9; x += dx) { ctx.beginPath(); ctx.moveTo(px(x), py(0)); ctx.lineTo(px(x), py(0) + 6); ctx.stroke(); ctx.fillText(tick(x), px(x), py(0) + 8); }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let y = dy; y <= yMax + 1e-9; y += dy) { ctx.strokeStyle = SCENE.muted; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(px(0), py(y)); ctx.lineTo(px(xMax), py(y)); ctx.stroke(); ctx.setLineDash([]); ctx.fillText(tick(y), px(0) - 6, py(y)); }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = T.ink3; ctx.font = monoFont(11); ctx.fillText("x / m", px(xMax) + 12, py(0) + 19); ctx.fillText("y / m", px(0) + 4, py(yMax) + 12);

    // 障礙（石牆）
    for (const b of L.blocks) {
      const X = px(b.x0), Y = py(b.y1), W = (b.x1 - b.x0) * sc, H = (b.y1 - b.y0) * sc;
      ctx.fillStyle = SCENE.post; ctx.fillRect(X, Y, W, H);
      ctx.strokeStyle = SCENE.hub; ctx.lineWidth = 1;
      for (let yy = b.y0 + 2; yy < b.y1; yy += 2) { ctx.beginPath(); ctx.moveTo(X, py(yy)); ctx.lineTo(X + W, py(yy)); ctx.stroke(); }
      ctx.strokeStyle = SCENE.wheel; ctx.lineWidth = 1.5; ctx.strokeRect(X, Y, W, H);
    }

    // 目標：靶（同心圓）與旗
    const tg = L.target, tr = tg.r * sc;
    ctx.beginPath(); ctx.arc(px(tg.x), py(tg.y), tr, 0, Math.PI * 2); ctx.fillStyle = SCENE.white; ctx.fill(); ctx.strokeStyle = SCENE.flag; ctx.lineWidth = Math.max(2, tr * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(px(tg.x), py(tg.y), tr * 0.35, 0, Math.PI * 2); ctx.fillStyle = SCENE.flag; ctx.fill();
    ctx.strokeStyle = SCENE.wheel; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px(tg.x), py(tg.y) - tr); ctx.lineTo(px(tg.x), py(tg.y) - tr - 3.5 * sc); ctx.stroke();
    ctx.fillStyle = SCENE.flag; ctx.beginPath(); ctx.moveTo(px(tg.x), py(tg.y) - tr - 3.5 * sc); ctx.lineTo(px(tg.x) + 2.4 * sc, py(tg.y) - tr - 2.8 * sc); ctx.lineTo(px(tg.x), py(tg.y) - tr - 2.1 * sc); ctx.closePath(); ctx.fill();
    if (tg.y > 0.5) { ctx.font = monoFont(11); ctx.fillStyle = T.ink2; ctx.textAlign = "center"; ctx.fillText(`(${tick(tg.x)}, ${tick(tg.y)}) m`, px(tg.x), py(tg.y) + tr + 14); }   // 地面靶由距離柱標示，不另加字（會與刻度重疊）

    // 上幾炮的路徑（灰虛線，落點標 u、θ）
    const ghosts = shots.slice(-GHOSTS);
    ctx.font = monoFont(11);
    ghosts.forEach((s, i) => {
      const a = 0.35 + (0.5 * (i + 1)) / ghosts.length;
      ctx.save(); ctx.globalAlpha = a;
      ctx.strokeStyle = s.result.outcome === "hit" ? SCENE.leaf : SCENE.ghost; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); s.result.path.forEach(([x, y], k) => { if (k) ctx.lineTo(px(x), py(y)); else ctx.moveTo(px(x), py(y)); }); ctx.stroke(); ctx.setLineDash([]);
      const [xe, ye] = s.result.path.at(-1)!;
      ctx.fillStyle = T.ink2; ctx.textAlign = xe > xMax * 0.85 ? "right" : "left";
      ctx.fillText(`${sig(s.u)}, ${tick(s.theta)}°`, px(xe) + (xe > xMax * 0.85 ? -6 : 6), py(ye) - 8);
      ctx.restore();
    });

    // 炮台與炮管（懸崖高度 h）
    const aim = (flying ? flying.theta : thetaDeg) * Math.PI / 180;
    const bx = px(0), by = py(L.h);
    ctx.strokeStyle = SCENE.wheel; ctx.lineWidth = Math.max(6, 0.9 * sc); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(aim) * 2.6 * sc, by - Math.sin(aim) * 2.6 * sc); ctx.stroke(); ctx.lineCap = "butt";
    ctx.fillStyle = SCENE.wheel; ctx.beginPath(); ctx.arc(bx, by, Math.max(7, 0.9 * sc), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SCENE.hub; ctx.beginPath(); ctx.arc(bx, by, Math.max(3, 0.35 * sc), 0, Math.PI * 2); ctx.fill();
    ctx.font = uiFont(12); ctx.fillStyle = T.ink2; ctx.textAlign = "center"; ctx.fillText(`θ = ${tick(flying ? flying.theta : thetaDeg)}°`, bx, by - Math.max(14, 1.4 * sc));

    // 飛行中的炮彈：路徑（實線琥珀）、球、速度箭嘴
    if (flying) {
      const r = flying.result, n = Math.min(r.path.length - 1, Math.floor(tNow / 0.02));
      ctx.strokeStyle = SCENE.objectA; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let k = 0; k <= n; k++) { const [x, y] = r.path[k]; if (k) ctx.lineTo(px(x), py(y)); else ctx.moveTo(px(x), py(y)); }
      const th = flying.theta * Math.PI / 180, vx = flying.u * Math.cos(th), vy = flying.u * Math.sin(th) - L.g * tNow;
      const x = vx * tNow, y = L.h + flying.u * Math.sin(th) * tNow - 0.5 * L.g * tNow * tNow;
      ctx.lineTo(px(x), py(y)); ctx.stroke();
      const k = Math.min(0.12 * sc, 3.5);   // 箭嘴比例：像素 / (m s⁻¹)，每關固定
      drawArrow2D(ctx, px(x), py(y), px(x) + vx * k, py(y) - vy * k, "velocity", "v");
      ball(ctx, px(x), py(y), Math.max(5, BALL_R * sc));
      ctx.font = monoFont(12); ctx.fillStyle = T.ink; ctx.textAlign = "right"; ctx.textBaseline = "top";
      ctx.fillText(`t = ${sig(tNow)} s   x = ${sig(x)} m   y = ${sig(Math.max(0, y))} m`, w - padR, padT);
      ctx.textBaseline = "alphabetic";
    } else if (shots.length) {
      // 靜止：球停在最後一炮的終點
      const s = shots.at(-1)!; const [xe, ye] = s.result.path.at(-1)!;
      ball(ctx, px(xe), py(ye), Math.max(5, BALL_R * sc));
      if (s.result.outcome === "hit") { ctx.strokeStyle = SCENE.leaf; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px(xe), py(ye), Math.max(10, tr + 4), 0, Math.PI * 2); ctx.stroke(); }
    } else {
      ball(ctx, bx, by, Math.max(5, BALL_R * sc));
      // 未發射：畫出目前參數的預測射程刻度？不畫——學生要自己算（遊戲重點）
    }
  };
}

function ball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = SCENE.objectA; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = SCENE.objectAEdge; ctx.lineWidth = 1.5; ctx.stroke();
}
