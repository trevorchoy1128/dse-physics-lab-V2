import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas2D, SCENE, SERIES, drawArrow2D, drawPane, monoFont, nice, theme, tick, uiFont, px as paneX, py as paneY, type Pane } from "@/components";
import { sig } from "@/shell/format";
import { useT } from "@/i18n/lang";
import { UNIT_COLORS } from "@/app/units";
import { TopBar } from "@/app/TopBar";
import { navigate } from "@/app/router";
import { LEVELS } from "./levels";
import { A_STEP, DT, STAR_MIN, TOL, durationOf, loadProgress, newRun, quantA, saveProgress, score, step, targetA, targetS, targetV, type Level, type Progress, type Run, type Score } from "./game";

// v–t 圖追車：畫面與互動。物理與評分全部在 game.ts；這裏只畫路面、兩架車與 v–t 圖，並把油門桿的 a 交給 step()。
// 上半是路面（鏡頭跟隨學生車，背景在世界座標），下半是 v–t 圖（軸範圍每關固定）。

type Phase = "ready" | "running" | "done";
const STAR = (n: number) => "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n);
const CAR_LEN = 4.2;                 // 車長 / m
const MAX_LAG = 0.5;                 // 分頁被隱藏後回來，最多補算這麼多秒，其餘視作暫停

export default function GraphChase() {
  const t = useT();
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [li, setLi] = useState(() => { const p = loadProgress(); const i = LEVELS.findIndex(l => !p[l.id]); return i < 0 ? 0 : i; });
  const L = LEVELS[li];
  const [phase, setPhase] = useState<Phase>("ready");
  const [a, setA] = useState(0);
  const [frame, setFrame] = useState(0);
  const [result, setResult] = useState<Score | null>(null);
  const [showHint, setShowHint] = useState(false);
  const aRef = useRef(0);                              // rAF 回呼內讀最新值用
  const phaseRef = useRef<Phase>("ready");
  const runRef = useRef<Run>(newRun(L));
  const raf = useRef(0);

  const setLever = useCallback((v: number) => { const q = quantA(v, L); aRef.current = q; setA(q); }, [L]);

  const openLevel = useCallback((i: number) => {
    cancelAnimationFrame(raf.current);
    runRef.current = newRun(LEVELS[i]); aRef.current = 0; phaseRef.current = "ready";
    setLi(i); setA(0); setPhase("ready"); setResult(null); setShowHint(false); setFrame(f => f + 1);
  }, []);

  // 開始：按真實時間逐步積分（步長固定 DT），油門桿的 a 每步讀一次
  const start = useCallback(() => {
    if (phaseRef.current === "running") return;
    cancelAnimationFrame(raf.current);
    runRef.current = newRun(L); phaseRef.current = "running";
    setResult(null); setPhase("running"); setFrame(f => f + 1);
    let t0 = performance.now();
    const loop = () => {
      const run = runRef.current;
      let target = (performance.now() - t0) / 1000;
      if (target - run.t > MAX_LAG) { t0 += (target - run.t - DT) * 1000; target = run.t + DT; }   // 分頁曾被隱藏：當作暫停，不一次補算整關
      let fin = false;
      while (run.t < target && !fin) fin = step(L, run, aRef.current);
      setFrame(f => f + 1);
      if (fin) {
        const sc = score(L, run); phaseRef.current = "done"; setResult(sc); setPhase("done");
        if (sc.stars > 0) setProgress(p => { if ((p[L.id] ?? 0) >= sc.stars) return p; const np = { ...p, [L.id]: sc.stars }; saveProgress(np); return np; });   // 最佳星數
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }, [L]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => {
    // 鍵盤：↑ ↓ 撥油門桿（一按一格，不吃長按重複），0 歸零，Enter 開始／再試。按鈕上的 Enter 是按鈕自己的事。
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== "range") return;
      if (e.key === "ArrowUp") { e.preventDefault(); if (!e.repeat) setLever(aRef.current + A_STEP); }
      else if (e.key === "ArrowDown") { e.preventDefault(); if (!e.repeat) setLever(aRef.current - A_STEP); }
      else if (e.key === "0") setLever(0);
      else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); start(); }
    };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, [setLever, start]);

  const labels = useMemo(() => ({
    title: t({ zh: "v–t 圖（速度—時間）", en: "v–t graph (velocity–time)" }), you: t({ zh: "你", en: "You" }), target: t({ zh: "目標車", en: "Target" }),
    band: t({ zh: `容差 ±${sig(TOL, 1)} m s⁻¹`, en: `tolerance ±${sig(TOL, 1)} m s⁻¹` }), yLabel: "v / m s⁻¹",
  }), [t]);
  const draw = useMemo(() => makeDraw(L, runRef, phase, labels), [L, phase, labels]);   // 每幀由 frame 觸發重畫

  const run = runRef.current;
  const unitColor = UNIT_COLORS.c2;
  const gap = run.s - targetS(L, run.t);
  const T = durationOf(L);

  return (
    <>
      <TopBar />
      <main className="wrap game" style={{ ["--unit" as string]: unitColor }}>
        <button type="button" className="back" onClick={() => navigate("#/games")}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d="M9 2 4 7l5 5" /></svg>{t({ zh: "返回遊戲", en: "Back to games" })}
        </button>
        <div className="game-head">
          <div>
            <div className="code">{t({ zh: "遊戲 · 運動圖線", en: "Game · Motion graphs" })}</div>
            <h2>{t({ zh: "v–t 圖追車", en: "Graph Chase" })}</h2>
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
          <div className="game-stage" style={{ aspectRatio: "16 / 11" }}>
            <Canvas2D draw={draw} frame={frame} />
            {phase === "ready" && (
              <div className="shot-banner ready" aria-live="polite">
                <b>{t({ zh: "三步", en: "Three steps" })}</b>
                <p>{t({ zh: "① 看清楚藍色目標線的每段斜率　② 按「開始」　③ 用 ↑ ↓ 撥油門桿，令綠線貼住目標線", en: "① Read the slope of each blue target segment　② Press Start　③ Use ↑ ↓ on the lever to keep the green line on the target" })}</p>
              </div>
            )}
            {phase === "done" && result && (
              <div className={`shot-banner ${result.stars ? "hit" : "block"}`} aria-live="polite">
                <b>{result.stars ? t({ zh: "追到了！", en: "Caught up!" }) : t({ zh: "跟丟了", en: "Lost it" })} <span className="stars">{STAR(result.stars)}</span></b>
                <p>{t({ zh: `貼線時間 ${tick(Math.round(result.fraction * 100))}%，最大偏差 ${sig(result.maxErr)} m s⁻¹，終點${gap >= 0 ? "領先" : "落後"}目標車 ${sig(Math.abs(gap))} m。`, en: `On the line ${tick(Math.round(result.fraction * 100))}% of the time, largest gap ${sig(result.maxErr)} m s⁻¹, finished ${sig(Math.abs(gap))} m ${gap >= 0 ? "ahead of" : "behind"} the target car.` })}</p>
                {result.stars < 3 && <p>{t({ zh: "綠線與目標線平行即是斜率相同：斜率就是 a。轉折點要及時撥桿；落後了就短暫用更大的 a 追回。", en: "Parallel lines have the same slope, and the slope is a. Move the lever promptly at each corner; if you fall behind, briefly use a larger a to catch up." })}</p>}
              </div>
            )}
          </div>
          <aside className="panel game-panel">
            <div className="level-name"><span className="n">{li + 1} / {LEVELS.length}</span>{t(L.name)}</div>
            <p className="brief">{t(L.brief)}</p>
            <p className="g-note">{t({ zh: `油門桿設定加速度 a，v–t 圖的斜率就是 a。綠線在陰影帶內（±${sig(TOL, 1)} m s⁻¹）的時間 ≥ ${tick(STAR_MIN[2] * 100)}% 三星、≥ ${tick(STAR_MIN[1] * 100)}% 兩星、≥ ${tick(STAR_MIN[0] * 100)}% 一星。無摩擦。`, en: `The lever sets the acceleration a; the slope of the v–t graph is a. Green line inside the shaded band (±${sig(TOL, 1)} m s⁻¹) for ≥ ${tick(STAR_MIN[2] * 100)}% of the time: three stars; ≥ ${tick(STAR_MIN[1] * 100)}%: two; ≥ ${tick(STAR_MIN[0] * 100)}%: one. No friction.` })}</p>

            <h2>{t({ zh: "油門桿", en: "Throttle lever" })}</h2>
            <div className="control lever">
              <label><i>a</i> {t({ zh: "加速度", en: "Acceleration" })} <span className="u-unit">/ m s⁻²</span></label>
              <div className="lever-row">
                <button type="button" className="lever-btn" onMouseDown={e => e.preventDefault()} onClick={() => setLever(a - A_STEP)} disabled={a <= -L.aMax} aria-label={t({ zh: "減少 a", en: "Decrease a" })}>−</button>
                <div className={`lever-val mono ${a > 0 ? "pos" : a < 0 ? "neg" : ""}`} aria-live="off">{a > 0 ? "+" : ""}{sig(a, 2)}</div>
                <button type="button" className="lever-btn" onMouseDown={e => e.preventDefault()} onClick={() => setLever(a + A_STEP)} disabled={a >= L.aMax} aria-label={t({ zh: "增加 a", en: "Increase a" })}>+</button>
              </div>
              <input type="range" className="lever-slider" min={-L.aMax} max={L.aMax} step={A_STEP} value={a} onChange={e => setLever(+e.target.value)} aria-label={t({ zh: "加速度 a", en: "Acceleration a" })} />
              <p className="key-hint">{t({ zh: "鍵盤：↑ ↓ 撥一格，0 歸零，Enter 開始", en: "Keys: ↑ ↓ one notch, 0 to zero, Enter to start" })}</p>
            </div>
            <div className="fire-row">
              <button type="button" className="fire" onClick={start} disabled={phase === "running"}>
                {phase === "running" ? t({ zh: `行駛中… ${sig(run.t)} s`, en: `Driving… ${sig(run.t)} s` }) : phase === "done" ? t({ zh: "再試一次", en: "Try again" }) : t({ zh: "開始", en: "Start" })}
              </button>
              <span className="shots-n">{t({ zh: "時長", en: "Duration" })} <b>{tick(T)} s</b></span>
            </div>

            <h2>{t({ zh: "讀數", en: "Readouts" })}</h2>
            <table className="readouts">
              <tbody>
                <tr><th>{t({ zh: "時間", en: "Time" })} <span><i>t</i></span></th><td>{sig(run.t)} s</td></tr>
                <tr><th>{t({ zh: "你的速度", en: "Your velocity" })} <span><i>v</i></span></th><td>{sig(run.v)} m s⁻¹</td></tr>
                <tr><th>{t({ zh: "目標速度", en: "Target velocity" })}</th><td>{sig(targetV(L, run.t))} m s⁻¹</td></tr>
                <tr><th>{t({ zh: "目標線斜率", en: "Target slope" })}</th><td>{sig(targetA(L, run.t))} m s⁻²</td></tr>
                <tr><th>{t({ zh: "你的位移", en: "Your displacement" })} <span><i>s</i></span></th><td>{sig(run.s)} m</td></tr>
                <tr><th>{t({ zh: "與目標車距離", en: "Gap to target car" })}</th><td>{gap > 0 ? "+" : gap < 0 ? "−" : ""}{sig(Math.abs(gap))} m</td></tr>
              </tbody>
            </table>

            <h2>{t({ zh: "提示", en: "Hint" })}</h2>
            <button type="button" className="hint-btn" aria-expanded={showHint} onClick={() => setShowHint(v => !v)}>{showHint ? t({ zh: "收起提示", en: "Hide hint" }) : t({ zh: "看物理提示", en: "Show physics hint" })}</button>
            {showHint && (
              <div className="hint-box">
                <p>{t(L.hint)}</p>
                <p className="formulas"><i>a</i> = Δ<i>v</i> / Δ<i>t</i>{t({ zh: "（v–t 圖的斜率）", en: " (slope of v–t graph)" })} · <i>s</i> = {t({ zh: "線下面積", en: "area under the line" })}</p>
                <p className="formulas"><i>v</i> = <i>u</i> + <i>at</i> · <i>s</i> = <i>ut</i> + ½<i>at</i>²</p>
              </div>
            )}

            {phase === "done" && result && result.stars > 0 && (
              <div className="next-row">
                {li + 1 < LEVELS.length
                  ? <button type="button" className="next" onClick={() => openLevel(li + 1)}>{t({ zh: "下一關 →", en: "Next level →" })}</button>
                  : <p className="all-done">{t({ zh: "全部關卡完成！", en: "All levels complete!" })} {Object.values(progress).reduce((x, y) => x + y, 0)} / {LEVELS.length * 3} ★</p>}
                {result.stars < 3 && <button type="button" className="retry" onClick={start}>{t({ zh: "再追一次", en: "Chase again" })}</button>}
              </div>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

interface Labels { title: string; you: string; target: string; band: string; yLabel: string }

// ---- 畫面：路面（世界座標，鏡頭跟隨學生車）＋ v–t 圖（軸範圍每關固定）----
function makeDraw(L: Level, runRef: { current: Run }, phase: Phase, lb: Labels) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const T = theme(); const run = runRef.current; const dur = durationOf(L);
    const roadH = Math.round(h * 0.36);
    drawRoad(ctx, w, roadH, L, run, T, lb);
    // v–t 圖
    const p: Pane = { x: 6, y: roadH + 6, w: w - 12, h: h - roadH - 12, yMin: L.vMin, yMax: L.vMax, tMax: dur };
    const ticksT = Array.from({ length: Math.floor(dur / 2) + 1 }, (_, i) => i * 2);
    drawPane(ctx, p, { title: lb.title, yLabel: lb.yLabel, color: SERIES.v.color, tint: SERIES.v.tint, xTicks: ticksT }, T);
    // 容差帶（目標線 ± TOL）與目標線（鋼藍虛線，與目標車同色）
    ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = SCENE.objectB; ctx.beginPath();
    L.points.forEach(([tt, v], i) => { const X = paneX(p, tt), Y = paneY(p, v + TOL); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
    [...L.points].reverse().forEach(([tt, v]) => ctx.lineTo(paneX(p, tt), paneY(p, v - TOL)));
    ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.strokeStyle = SCENE.objectB; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]); ctx.beginPath();
    L.points.forEach(([tt, v], i) => { const X = paneX(p, tt), Y = paneY(p, v); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
    ctx.stroke(); ctx.setLineDash([]);
    ctx.font = monoFont(11); ctx.fillStyle = SCENE.objectB; ctx.textAlign = "left";
    ctx.fillText(`${lb.target} · ${lb.band}`, paneX(p, 0) + 6, p.y + 30);
    // 轉折點小圓；完成後在每段中點標出斜率（教學：斜率就是 a）
    for (const [tt, v] of L.points) { ctx.beginPath(); ctx.arc(paneX(p, tt), paneY(p, v), 3, 0, Math.PI * 2); ctx.fillStyle = SCENE.white; ctx.fill(); ctx.strokeStyle = SCENE.objectB; ctx.lineWidth = 1.5; ctx.stroke(); }
    if (phase === "done") {
      ctx.font = monoFont(11); ctx.fillStyle = SCENE.objectB; ctx.textAlign = "center";
      for (let i = 0; i < L.points.length - 1; i++) {
        const [t0, v0] = L.points[i], [t1, v1] = L.points[i + 1]; const aSeg = (v1 - v0) / (t1 - t0);
        const X = paneX(p, (t0 + t1) / 2), Y = paneY(p, (v0 + v1) / 2);
        ctx.fillText(`a = ${tick(aSeg)}`, X, Y - (aSeg >= 0 ? 10 : -16));
      }
    }
    // 學生的線（速度綠，實線）到現在為止
    if (run.n > 0) {
      ctx.strokeStyle = SERIES.v.color; ctx.lineWidth = 3; ctx.beginPath();
      for (let k = 0; k < run.ts.length; k++) { const X = paneX(p, run.ts[k]), Y = paneY(p, run.vs[k]); if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
      ctx.stroke();
    }
    // 時間游標與兩個點
    if (phase !== "ready") {
      const X = paneX(p, run.t);
      ctx.strokeStyle = T.ink3; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(X, paneY(p, L.vMax)); ctx.lineTo(X, paneY(p, L.vMin)); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(X, paneY(p, targetV(L, run.t)), 5, 0, Math.PI * 2); ctx.fillStyle = SCENE.objectB; ctx.fill();
      ctx.beginPath(); ctx.arc(X, paneY(p, run.v), 5.5, 0, Math.PI * 2); ctx.fillStyle = SERIES.v.color; ctx.fill(); ctx.strokeStyle = SCENE.white; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.font = monoFont(11); ctx.fillStyle = SERIES.v.color; ctx.textAlign = "left"; ctx.fillText(lb.you, paneX(p, 0) + 6, p.y + 44);
  };
}

function drawRoad(ctx: CanvasRenderingContext2D, w: number, roadH: number, L: Level, run: Run, T: ReturnType<typeof theme>, lb: Labels) {
  const sc = w / L.view;                       // 像素 / 米，每關固定
  const camX = run.s;                          // 鏡頭跟隨學生車：車在畫面 30% 處
  const wx = (x: number) => (x - camX) * sc + w * 0.3;
  const groundY = roadH * 0.5, roadY0 = roadH * 0.56, roadY1 = roadH * 0.96;
  const laneMid = (roadY0 + roadY1) / 2;
  // 天空、視差雲、地面、路面
  const sky = ctx.createLinearGradient(0, 0, 0, groundY); sky.addColorStop(0, SCENE.skyTop); sky.addColorStop(1, SCENE.skyBottom);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, groundY);
  ctx.fillStyle = SCENE.cloud;
  const P = w + 240;
  for (let i = 0; i < 5; i++) {
    const cx = ((((i * P) / 5 - camX * sc * 0.25) % P) + P) % P - 120, cy = groundY * (0.25 + 0.12 * (i % 3)), r = 16 + 6 * (i % 2);
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.8, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = SCENE.ground; ctx.fillRect(0, groundY, w, roadH - groundY);
  // 樹（世界座標，每 9 m 一棵，高度由序號決定）
  const xL = camX - w * 0.3 / sc - 10, xR = camX + w * 0.7 / sc + 10;
  for (let x = Math.floor(xL / 9) * 9; x <= xR; x += 9) {
    const k = Math.abs(Math.round(x / 9)), hTree = 14 + (k * 7) % 10, tx = wx(x + ((k * 5) % 4));
    ctx.strokeStyle = SCENE.trunk; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, roadY0 - 2); ctx.lineTo(tx, roadY0 - 2 - hTree * 0.6); ctx.stroke();
    ctx.fillStyle = SCENE.leaf; ctx.beginPath(); ctx.arc(tx, roadY0 - 4 - hTree * 0.6, hTree * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = SCENE.road; ctx.fillRect(0, roadY0, w, roadY1 - roadY0);
  // 車道分隔虛線（世界座標：線 2 m、空 2 m）
  ctx.strokeStyle = SCENE.roadDash; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = Math.floor(xL / 4) * 4; x <= xR; x += 4) { ctx.moveTo(wx(x), laneMid); ctx.lineTo(wx(x + 2), laneMid); }
  ctx.stroke();
  // 距離柱（每 nice(view/6) m，附數字）與起點旗
  const d = nice(L.view / 6);
  ctx.font = monoFont(11); ctx.fillStyle = T.ink2; ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let x = Math.floor(xL / d) * d; x <= xR; x += d) {
    const X = wx(x); ctx.strokeStyle = SCENE.post; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, roadY1); ctx.lineTo(X, roadY1 + 8); ctx.stroke();
    ctx.fillText(`${tick(x)} m`, X, roadY1 + 10);
  }
  ctx.textBaseline = "alphabetic";
  const fx = wx(0);
  ctx.strokeStyle = SCENE.post; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, roadY0); ctx.lineTo(fx, roadY0 - 30); ctx.stroke();
  ctx.fillStyle = SCENE.flag; ctx.beginPath(); ctx.moveTo(fx, roadY0 - 30); ctx.lineTo(fx + 14, roadY0 - 25); ctx.lineTo(fx, roadY0 - 20); ctx.closePath(); ctx.fill();
  // 目標車（遠車道，鋼藍）與學生車（近車道，琥珀）
  const sT = targetS(L, run.t);
  const cw = Math.max(36, CAR_LEN * sc), ch = Math.max(16, cw * 0.42);
  const yFar = roadY0 + (laneMid - roadY0) * 0.55, yNear = laneMid + (roadY1 - laneMid) * 0.55;
  const tX = wx(sT);
  if (tX > -cw && tX < w + cw) { car(ctx, tX, yFar, cw * 0.9, ch * 0.9, SCENE.objectB, SCENE.objectBEdge, SCENE.objectAWindow); ctx.font = uiFont(12); ctx.fillStyle = T.ink2; ctx.textAlign = "center"; ctx.fillText(lb.target, tX, yFar - ch * 0.9 - 6); }
  else {   // 目標車在畫面外：邊緣箭嘴與距離
    const right = tX >= w + cw, ex = right ? w - 12 : 12;
    ctx.fillStyle = SCENE.objectB; ctx.beginPath(); ctx.moveTo(ex, yFar); ctx.lineTo(ex + (right ? -12 : 12), yFar - 8); ctx.lineTo(ex + (right ? -12 : 12), yFar + 8); ctx.closePath(); ctx.fill();
    ctx.font = uiFont(12); ctx.fillStyle = T.ink2; ctx.textAlign = right ? "right" : "left"; ctx.fillText(`${lb.target} ${sig(Math.abs(sT - run.s))} m`, ex + (right ? -16 : 16), yFar + 4);
  }
  const uX = wx(run.s);
  car(ctx, uX, yNear, cw, ch, SCENE.objectA, SCENE.objectAEdge, SCENE.objectAWindow);
  ctx.font = uiFont(12); ctx.fillStyle = T.ink2; ctx.textAlign = "center"; ctx.fillText(lb.you, uX, yNear - ch - 6);
  // 速度箭嘴（實線）與加速度箭嘴（虛線）：比例只與畫面寬度和關卡上限有關，播放中不變
  const kv = (w * 0.22) / L.vMax, ka = (w * 0.12) / L.aMax;
  const aNow = run.as.length ? run.as[run.as.length - 1] : 0;
  const yV = yNear - ch * 0.15, yA = yNear + ch * 0.3;
  if (Math.abs(run.v) > 0.05) drawArrow2D(ctx, uX, yV, uX + run.v * kv, yV, "velocity", "v");
  if (Math.abs(aNow) > 0.01) drawArrow2D(ctx, uX, yA, uX + aNow * ka, yA, "acceleration", "a");
  // 右上讀數
  ctx.font = monoFont(12); ctx.fillStyle = T.ink; ctx.textAlign = "right"; ctx.textBaseline = "top";
  ctx.fillText(`t = ${sig(run.t)} s   v = ${sig(run.v)} m s⁻¹   Δs = ${run.s - sT >= 0 ? "+" : "−"}${sig(Math.abs(run.s - sT))} m`, w - 10, 8);
  ctx.textBaseline = "alphabetic";
}

function car(ctx: CanvasRenderingContext2D, cx: number, cy: number, cw: number, ch: number, fill: string, edge: string, glass: string) {
  const x0 = cx - cw / 2, yTop = cy - ch, r = Math.min(6, ch * 0.3);
  ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x0 + r, yTop + ch * 0.45); ctx.lineTo(x0 + cw * 0.22, yTop); ctx.lineTo(x0 + cw * 0.72, yTop); ctx.lineTo(x0 + cw - r, yTop + ch * 0.45);
  ctx.lineTo(x0 + cw, yTop + ch * 0.5); ctx.lineTo(x0 + cw, cy - 2); ctx.lineTo(x0, cy - 2); ctx.lineTo(x0, yTop + ch * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = glass; ctx.fillRect(x0 + cw * 0.28, yTop + 3, cw * 0.4, ch * 0.36);
  ctx.fillStyle = SCENE.wheel; ctx.beginPath(); ctx.arc(x0 + cw * 0.24, cy - 2, ch * 0.22, 0, Math.PI * 2); ctx.arc(x0 + cw * 0.76, cy - 2, ch * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = SCENE.hub; ctx.beginPath(); ctx.arc(x0 + cw * 0.24, cy - 2, ch * 0.08, 0, Math.PI * 2); ctx.arc(x0 + cw * 0.76, cy - 2, ch * 0.08, 0, Math.PI * 2); ctx.fill();
}
