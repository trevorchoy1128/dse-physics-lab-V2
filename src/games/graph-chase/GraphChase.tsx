import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas2D, SCENE, SERIES, drawArrow2D, drawPane, monoFont, nice, theme, tick, uiFont, px as paneX, py as paneY, type Pane } from "@/components";
import { sig } from "@/shell/format";
import { useT } from "@/i18n/lang";
import { UNIT_COLORS } from "@/app/units";
import { TopBar } from "@/app/TopBar";
import { navigate } from "@/app/router";
import { LEVELS } from "./levels";
import { A_STEP, STAR_MIN, TOL, advance, durationOf, loadProgress, newRun, nextCorner, quantA, saveProgress, score, targetA, targetS, targetV, type Level, type Progress, type Run, type Score } from "./game";

// v–t 圖追車（警車追賊車）：畫面與互動。物理與評分全部在 game.ts；這裏只畫路面、兩架車與 v–t 圖，並把油門桿的 a 交給 advance()。
// 上半是路面（鏡頭跟隨警車，背景在世界座標），下半是 v–t 圖（軸範圍每關固定）。
// 減難度但不減物理：預設「轉折點自動暫停」（到每個轉折點停下，撥好 a 再繼續，考的是讀斜率不是反應）；可選「慢動作 ½ 速」（只改播放速率，物理不變）。

type Phase = "ready" | "running" | "paused" | "done";
type Mode = "normal" | "hard";       // 普通：轉折點自動暫停；困難：不停，要即時反應（原本的玩法）
const keyOf = (id: string, mode: Mode) => (mode === "hard" ? `${id}#hard` : id);   // 兩個模式分開記錄星數
const zero = (x: number) => (Math.abs(x) < 1e-9 ? 0 : x);   // 完全貼線時的浮點殘差顯示為 0
const STAR = (n: number) => "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n);
const CAR_LEN = 4.2;                 // 車長 / m
const QUICK = [-2, -1, 0, 1, 2];     // 快速鍵：一按到位

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
  const [mode, setMode] = useState<Mode>("normal");
  const [slow, setSlow] = useState(false);             // 慢動作 ½ 速
  const aRef = useRef(0);                              // rAF 回呼內讀最新值用
  const modeRef = useRef<Mode>("normal"); const slowRef = useRef(false);
  const assist = mode === "normal";
  const phaseRef = useRef<Phase>("ready");
  const runRef = useRef<Run>(newRun(L));
  const raf = useRef(0);
  const t0 = useRef(0);                                // 牆鐘起點（ms），暫停後順延

  const setLever = useCallback((v: number) => { const q = quantA(v, L); aRef.current = q; setA(q); }, [L]);
  const setPh = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  const openLevel = useCallback((i: number) => {
    cancelAnimationFrame(raf.current);
    runRef.current = newRun(LEVELS[i]); aRef.current = 0; phaseRef.current = "ready";
    setLi(i); setA(0); setPhase("ready"); setResult(null); setShowHint(false); setFrame(f => f + 1);
  }, []);

  // rAF 迴圈：按真實時間（慢動作時 ½）逐步積分，油門桿的 a 每幀讀一次；輔助模式在下一個轉折點停下
  const loop = useCallback(() => {
    const run = runRef.current, rate = slowRef.current ? 0.5 : 1;
    const stopAt = modeRef.current === "normal" ? nextCorner(L, run.t) ?? undefined : undefined;
    const { done, stopped, skipped } = advance(L, run, ((performance.now() - t0.current) / 1000) * rate, aRef.current, stopAt);
    t0.current += (skipped / rate) * 1000;   // 分頁曾被隱藏：當作暫停，時鐘起點順延
    setFrame(f => f + 1);
    if (done) {
      const sc = score(L, run); setResult(sc); setPh("done");
      const key = keyOf(L.id, modeRef.current);
      if (sc.stars > 0) setProgress(p => { if ((p[key] ?? 0) >= sc.stars) return p; const np = { ...p, [key]: sc.stars }; saveProgress(np); return np; });   // 最佳星數
      return;
    }
    if (stopped) { setPh("paused"); return; }
    raf.current = requestAnimationFrame(loop);
  }, [L]);

  const start = useCallback(() => {
    if (phaseRef.current === "running") return;
    cancelAnimationFrame(raf.current);
    runRef.current = newRun(L); setResult(null); setPh("running"); setFrame(f => f + 1);
    t0.current = performance.now();
    raf.current = requestAnimationFrame(loop);
  }, [L, loop]);
  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    const rate = slowRef.current ? 0.5 : 1;
    t0.current = performance.now() - (runRef.current.t / rate) * 1000;   // 時鐘接回現在的 t
    setPh("running"); raf.current = requestAnimationFrame(loop);
  }, [loop]);
  const retry = useCallback(() => { setLever(0); start(); }, [setLever, start]);   // 油門桿歸零再開始，不會帶着上次的 a 衝出去
  const go = useCallback(() => { if (phaseRef.current === "paused") resume(); else start(); }, [resume, start]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => {
    // 鍵盤：↑ ↓ 半格、← → 一格（一按一下，不吃長按重複），0 歸零，數字 1–4 直接設 +n（「-」鍵變負），Enter 開始／繼續。按鈕上的 Enter 是按鈕自己的事。
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== "range") return;
      const k = e.key;
      if (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight") {
        e.preventDefault(); if (e.repeat) return;
        setLever(aRef.current + (k === "ArrowUp" ? A_STEP : k === "ArrowDown" ? -A_STEP : k === "ArrowRight" ? 1 : -1));
      }
      else if (k === "0") setLever(0);
      else if (/^[1-4]$/.test(k)) setLever(+k);
      else if (k === "-" || k === "−") setLever(-Math.abs(aRef.current));
      else if (k === "Enter" && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); go(); }
      else if (k === " " && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); if (phaseRef.current === "paused") resume(); }
    };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, [setLever, go, resume]);

  const labels = useMemo(() => ({
    title: t({ zh: "v–t 圖（速度—時間）", en: "v–t graph (velocity–time)" }), you: t({ zh: "警車（你）", en: "Police (you)" }), target: t({ zh: "賊車", en: "Getaway car" }),
    band: t({ zh: `容差 ±${sig(TOL, 1)} m s⁻¹`, en: `tolerance ±${sig(TOL, 1)} m s⁻¹` }), yLabel: "v / m s⁻¹",
    corner: t({ zh: "轉折點", en: "corner" }), nextCorner: t({ zh: "下一個轉折點", en: "next corner" }),
  }), [t]);
  const draw = useMemo(() => makeDraw(L, runRef, phase, assist, labels), [L, phase, assist, labels]);   // 每幀由 frame 觸發重畫

  const run = runRef.current;
  const unitColor = UNIT_COLORS.c2;
  const gap = zero(run.s - targetS(L, run.t));
  const T = durationOf(L);
  const corner = phase === "paused" ? run.t : null;

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
              <button key={l.id} type="button" role="tab" aria-selected={i === li} className={progress[keyOf(l.id, mode)] ? "done" : ""} onClick={() => openLevel(i)} title={t(l.name)}>
                <b>{i + 1}</b><span>{progress[keyOf(l.id, mode)] ? STAR(progress[keyOf(l.id, mode)]) : "☆☆☆"}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="game-main chase">
          <div className="game-stage" style={{ aspectRatio: "16 / 11" }}>
            <Canvas2D draw={draw} frame={frame} />
            {phase === "ready" && (
              <div className="shot-banner ready" aria-live="polite">
                <b>{t({ zh: "警車追賊車：三步", en: "Police chase: three steps" })}</b>
                <p>{t({ zh: "① 藍色虛線是賊車的 v–t 圖，看清楚每段的斜率　② 按「開始」　③ 用 + −（或鍵盤）撥油門桿，令警車的綠線貼住賊車的線，就能一直跟在賊車旁邊", en: "① The blue dashed line is the getaway car's v–t graph; read the slope of each segment　② Press Start　③ Use + − (or the keyboard) on the lever so the police car's green line hugs the getaway car's line, and you stay right beside it" })}</p>
                <p>{assist ? t({ zh: "普通模式：到每個轉折點會自動停下，撥好 a 再按「繼續」。", en: "Normal mode: the chase pauses at every corner; set a, then press Continue." }) : t({ zh: "困難模式：不會停，要即時撥桿。", en: "Hard mode: no pauses, react in real time." })}</p>
              </div>
            )}
            {phase === "paused" && corner !== null && (
              <div className="shot-banner paused" aria-live="polite">
                <b>{t({ zh: `轉折點 t = ${tick(corner)} s`, en: `Corner at t = ${tick(corner)} s` })}</b>
                <p>{t({ zh: "賊車的線改變斜率了。下一段的 Δv / Δt 是多少？撥好 a 再繼續。", en: "The getaway car's line changes slope here. What is Δv / Δt for the next segment? Set a, then continue." })}</p>
                <div className="banner-btns">
                  <button type="button" className="banner-btn primary" onClick={resume}>{t({ zh: "繼續 ▶", en: "Continue ▶" })}</button>
                  <span className="banner-note">{t({ zh: "現在 a = ", en: "Now a = " })}<b className="mono">{a > 0 ? "+" : ""}{sig(a, 2)}</b> m s⁻²</span>
                </div>
              </div>
            )}
            {phase === "done" && result && (
              <div className={`shot-banner ${result.stars ? "hit" : "block"}`} aria-live="polite">
                <b>{result.stars ? t({ zh: "追到了！", en: "Caught up!" }) : t({ zh: "跟丟了", en: "Lost it" })} <span className="stars">{STAR(result.stars)}</span></b>
                <p>{t({ zh: `貼線時間 ${tick(Math.round(result.fraction * 100))}%，最大偏差 ${sig(result.maxErr)} m s⁻¹，終點${gap >= 0 ? "領先" : "落後"}賊車 ${sig(Math.abs(gap))} m。`, en: `On the line ${tick(Math.round(result.fraction * 100))}% of the time, largest gap ${sig(result.maxErr)} m s⁻¹, finished ${sig(Math.abs(gap))} m ${gap >= 0 ? "ahead of" : "behind"} the getaway car.` })}</p>
                {result.stars < 3 && <p>{t({ zh: "綠線與賊車的線平行即是斜率相同：斜率就是 a。轉折點要及時撥桿；落後了就短暫用更大的 a 追回。", en: "Parallel lines have the same slope, and the slope is a. Move the lever promptly at each corner; if you fall behind, briefly use a larger a to catch up." })}</p>}
                <div className="banner-btns">
                  <button type="button" className="banner-btn primary" onClick={retry}>{t({ zh: "立即重試", en: "Retry now" })}</button>
                  {result.stars > 0 && li + 1 < LEVELS.length && <button type="button" className="banner-btn" onClick={() => openLevel(li + 1)}>{t({ zh: "下一關 →", en: "Next level →" })}</button>}
                </div>
              </div>
            )}
          </div>
          <div className="panel game-panel chase-lever">
            <div className="level-name"><span className="n">{li + 1} / {LEVELS.length}</span>{t(L.name)}</div>
            <p className="brief">{t(L.brief)}</p>
            <div className="lever-grid">
              <div className="control lever">
                <label><i>a</i> {t({ zh: "加速度（油門桿）", en: "Acceleration (throttle lever)" })} <span className="u-unit">/ m s⁻²</span></label>
                <div className="lever-row">
                  <button type="button" className="lever-btn" onMouseDown={e => e.preventDefault()} onClick={() => setLever(a - A_STEP)} disabled={a <= -L.aMax} aria-label={t({ zh: "減少 a 半格", en: "Decrease a by half a notch" })}>−</button>
                  <div className={`lever-val mono ${a > 0 ? "pos" : a < 0 ? "neg" : ""}`} aria-live="off">{a > 0 ? "+" : ""}{sig(a, 2)}</div>
                  <button type="button" className="lever-btn" onMouseDown={e => e.preventDefault()} onClick={() => setLever(a + A_STEP)} disabled={a >= L.aMax} aria-label={t({ zh: "增加 a 半格", en: "Increase a by half a notch" })}>+</button>
                </div>
                <div className="quick-row" role="group" aria-label={t({ zh: "快速設定 a", en: "Quick set a" })}>
                  {QUICK.map(q => <button key={q} type="button" className={`quick ${a === q ? "on" : ""}`} onMouseDown={e => e.preventDefault()} onClick={() => setLever(q)}>{q > 0 ? "+" : ""}{q}</button>)}
                </div>
                <input type="range" className="lever-slider" min={-L.aMax} max={L.aMax} step={A_STEP} value={a} onChange={e => setLever(+e.target.value)} aria-label={t({ zh: "加速度 a", en: "Acceleration a" })} />
                <p className="key-hint">{t({ zh: "鍵盤：↑ ↓ 半格、← → 一格、1–4 直接設定、0 歸零、Enter 開始／繼續", en: "Keys: ↑ ↓ half notch, ← → one notch, 1–4 set directly, 0 to zero, Enter start / continue" })}</p>
              </div>
              <div className="fire-col">
                <button type="button" className="fire" onClick={go} disabled={phase === "running"}>
                  {phase === "running" ? t({ zh: `追捕中… ${sig(run.t)} s`, en: `Chasing… ${sig(run.t)} s` }) : phase === "paused" ? t({ zh: "繼續 ▶", en: "Continue ▶" }) : phase === "done" ? t({ zh: "再試一次", en: "Try again" }) : t({ zh: "開始", en: "Start" })}
                </button>
                <span className="shots-n">{t({ zh: "時長", en: "Duration" })} <b>{tick(T)} s</b></span>
                <div className="mode-row" role="group" aria-label={t({ zh: "模式", en: "Mode" })}>
                  {(["normal", "hard"] as Mode[]).map(m => <button key={m} type="button" className={`mode ${mode === m ? "on" : ""}`} aria-pressed={mode === m} disabled={phase === "running" || phase === "paused"} onClick={() => { modeRef.current = m; setMode(m); }}>{m === "normal" ? t({ zh: "普通模式", en: "Normal" }) : t({ zh: "困難模式", en: "Hard" })}</button>)}
                </div>
                <p className="key-hint">{assist ? t({ zh: "普通：轉折點自動暫停", en: "Normal: pauses at every corner" }) : t({ zh: "困難：不停，即時反應", en: "Hard: no pauses, react live" })}</p>
                <label className="toggle"><input type="checkbox" checked={slow} onChange={e => { slowRef.current = e.target.checked; setSlow(e.target.checked); if (phaseRef.current === "running") t0.current = performance.now() - (runRef.current.t / (e.target.checked ? 0.5 : 1)) * 1000; }} />{t({ zh: "慢動作 ½ 速", en: "Slow motion ½" })}</label>
              </div>
            </div>
          </div>
          <aside className="panel game-panel chase-panel">
            <p className="g-note">{t({ zh: `油門桿設定警車的加速度 a，v–t 圖的斜率就是 a。綠線在陰影帶內（±${sig(TOL, 1)} m s⁻¹）的時間 ≥ ${tick(STAR_MIN[2] * 100)}% 三星、≥ ${tick(STAR_MIN[1] * 100)}% 兩星、≥ ${tick(STAR_MIN[0] * 100)}% 一星。無摩擦。`, en: `The lever sets the police car's acceleration a; the slope of the v–t graph is a. Green line inside the shaded band (±${sig(TOL, 1)} m s⁻¹) for ≥ ${tick(STAR_MIN[2] * 100)}% of the time: three stars; ≥ ${tick(STAR_MIN[1] * 100)}%: two; ≥ ${tick(STAR_MIN[0] * 100)}%: one. No friction.` })}</p>

            <h2>{t({ zh: "讀數", en: "Readouts" })}</h2>
            <table className="readouts">
              <tbody>
                <tr><th>{t({ zh: "時間", en: "Time" })} <span><i>t</i></span></th><td>{sig(run.t)} s</td></tr>
                <tr><th>{t({ zh: "警車速度", en: "Police velocity" })} <span><i>v</i></span></th><td>{sig(run.v)} m s⁻¹</td></tr>
                <tr><th>{t({ zh: "賊車速度", en: "Getaway velocity" })}</th><td>{sig(targetV(L, run.t))} m s⁻¹</td></tr>
                <tr><th>{t({ zh: "賊車線斜率", en: "Getaway slope" })}</th><td>{sig(targetA(L, run.t))} m s⁻²</td></tr>
                <tr><th>{t({ zh: "警車位移", en: "Police displacement" })} <span><i>s</i></span></th><td>{sig(run.s)} m</td></tr>
                <tr><th>{t({ zh: "與賊車距離", en: "Gap to getaway car" })}</th><td>{gap > 0 ? "+" : gap < 0 ? "−" : ""}{sig(Math.abs(gap))} m</td></tr>
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
          </aside>
        </div>
      </main>
    </>
  );
}

interface Labels { title: string; you: string; target: string; band: string; yLabel: string; corner: string; nextCorner: string }

// ---- 畫面：路面（世界座標，鏡頭跟隨警車）＋ v–t 圖（軸範圍每關固定）----
function makeDraw(L: Level, runRef: { current: Run }, phase: Phase, assist: boolean, lb: Labels) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const T = theme(); const run = runRef.current; const dur = durationOf(L);
    const roadH = Math.round(h * 0.36);
    drawRoad(ctx, w, roadH, L, run, T, lb);
    // v–t 圖
    const p: Pane = { x: 6, y: roadH + 6, w: w - 12, h: h - roadH - 12, yMin: L.vMin, yMax: L.vMax, tMax: dur };
    const ticksT = Array.from({ length: Math.floor(dur / 2) + 1 }, (_, i) => i * 2);
    drawPane(ctx, p, { title: lb.title, yLabel: lb.yLabel, color: SERIES.v.color, tint: SERIES.v.tint, xTicks: ticksT }, T);
    // 以下全部裁剪在圖框內：警車的 v 超出軸範圍時，線不會穿出圖框畫到路面上（軸範圍每關固定，不隨線放大）
    ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
    // 容差帶（賊車線 ± TOL）與賊車線（鋼藍虛線）
    ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = SCENE.objectB; ctx.beginPath();
    L.points.forEach(([tt, v], i) => { const X = paneX(p, tt), Y = paneY(p, v + TOL); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
    [...L.points].reverse().forEach(([tt, v]) => ctx.lineTo(paneX(p, tt), paneY(p, v - TOL)));
    ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.strokeStyle = SCENE.objectB; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]); ctx.beginPath();
    L.points.forEach(([tt, v], i) => { const X = paneX(p, tt), Y = paneY(p, v); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
    ctx.stroke(); ctx.setLineDash([]);
    ctx.font = monoFont(11); ctx.fillStyle = SCENE.objectB; ctx.textAlign = "left";
    ctx.fillText(`${lb.target} · ${lb.band}`, paneX(p, 0) + 6, p.y + 30);
    // 轉折點：小圓；下一個轉折點畫直線並倒數（讓學生預備撥桿）；每段中點標出斜率：完成後全部揭曉，輔助模式走過的段即揭曉
    for (const [tt, v] of L.points) { ctx.beginPath(); ctx.arc(paneX(p, tt), paneY(p, v), 3, 0, Math.PI * 2); ctx.fillStyle = SCENE.white; ctx.fill(); ctx.strokeStyle = SCENE.objectB; ctx.lineWidth = 1.5; ctx.stroke(); }
    const nc = phase === "running" || phase === "paused" ? nextCorner(L, run.t - (phase === "paused" ? 1e-6 : 0)) : null;
    if (nc !== null) {
      const X = paneX(p, nc);
      ctx.strokeStyle = SCENE.flag; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X, p.y + 18); ctx.lineTo(X, p.y + p.h - 4); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = monoFont(11); ctx.fillStyle = SCENE.flag; ctx.textAlign = X > p.x + p.w * 0.8 ? "right" : "left";
      ctx.fillText(phase === "paused" ? `${lb.corner} t = ${tick(nc)} s` : `${lb.nextCorner} ${sig(Math.max(0, nc - run.t), 2)} s`, X + (X > p.x + p.w * 0.8 ? -6 : 6), p.y + 58);
    }
    if (phase === "done" || assist) {
      ctx.font = monoFont(11); ctx.fillStyle = SCENE.objectB; ctx.textAlign = "center";
      for (let i = 0; i < L.points.length - 1; i++) {
        const [t0, v0] = L.points[i], [t1, v1] = L.points[i + 1]; const aSeg = (v1 - v0) / (t1 - t0);
        if (phase !== "done" && t1 > run.t + 1e-9) continue;   // 輔助模式：走過才揭曉，不是預先告訴
        const X = paneX(p, (t0 + t1) / 2), Y = paneY(p, (v0 + v1) / 2);
        ctx.fillText(`a = ${tick(aSeg)}`, X, Y - (aSeg >= 0 ? 10 : -16));
      }
    }
    // 警車的線（速度綠，實線）到現在為止
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
      // 警車的點：超出軸範圍時貼在圖框邊緣，並標明超出
      const off = run.v > L.vMax ? 1 : run.v < L.vMin ? -1 : 0;
      const Y = off > 0 ? p.y + 8 : off < 0 ? p.y + p.h - 8 : paneY(p, run.v);
      ctx.beginPath(); ctx.arc(X, Y, 5.5, 0, Math.PI * 2); ctx.fillStyle = SERIES.v.color; ctx.fill(); ctx.strokeStyle = SCENE.white; ctx.lineWidth = 1.5; ctx.stroke();
      if (off) { ctx.font = monoFont(11); ctx.fillStyle = SERIES.v.color; ctx.textAlign = X > p.x + p.w * 0.8 ? "right" : "left"; ctx.fillText(`v = ${sig(run.v)} ${off > 0 ? "↑" : "↓"}`, X + (X > p.x + p.w * 0.8 ? -9 : 9), Y + 4); }
    }
    ctx.font = monoFont(11); ctx.fillStyle = SERIES.v.color; ctx.textAlign = "left"; ctx.fillText(lb.you, paneX(p, 0) + 6, p.y + 44);
    ctx.restore();
  };
}

function drawRoad(ctx: CanvasRenderingContext2D, w: number, roadH: number, L: Level, run: Run, T: ReturnType<typeof theme>, lb: Labels) {
  const sc = w / L.view;                       // 像素 / 米，每關固定
  const camX = run.s;                          // 鏡頭跟隨警車：車在畫面 30% 處
  const wx = (x: number) => (x - camX) * sc + w * 0.3;
  const groundY = roadH * 0.5, roadY0 = roadH * 0.56, roadY1 = roadH * 0.84;   // 路面下方留位放距離柱數字
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
  // 賊車（遠車道，深色）與警車（近車道，白車身鋼藍帶、警燈）
  const sT = targetS(L, run.t);
  const cw = Math.max(36, CAR_LEN * sc), ch = Math.max(16, cw * 0.42);
  const yFar = roadY0 + (laneMid - roadY0) * 0.55, yNear = laneMid + (roadY1 - laneMid) * 0.55;
  const tX = wx(sT);
  if (tX > -cw && tX < w + cw) { car(ctx, tX, yFar, cw * 0.9, ch * 0.9, SCENE.wheel, SCENE.hub, SCENE.objectAWindow); ctx.font = uiFont(12); ctx.fillStyle = T.ink2; ctx.textAlign = "center"; ctx.fillText(lb.target, tX, yFar - ch * 0.9 - 6); }
  else {   // 賊車在畫面外：邊緣箭嘴與距離
    const right = tX >= w + cw, ex = right ? w - 12 : 12;
    ctx.fillStyle = SCENE.wheel; ctx.beginPath(); ctx.moveTo(ex, yFar); ctx.lineTo(ex + (right ? -12 : 12), yFar - 8); ctx.lineTo(ex + (right ? -12 : 12), yFar + 8); ctx.closePath(); ctx.fill();
    ctx.font = uiFont(12); ctx.fillStyle = T.ink2; ctx.textAlign = right ? "right" : "left"; ctx.fillText(`${lb.target} ${sig(Math.abs(sT - run.s))} m`, ex + (right ? -16 : 16), yFar + 4);
  }
  const uX = wx(run.s);
  car(ctx, uX, yNear, cw, ch, SCENE.white, SCENE.objectBEdge, SCENE.objectAWindow);
  // 警車特徵：車身下半鋼藍帶、車頂警燈（紅藍交替閃）
  ctx.fillStyle = SCENE.objectB; ctx.fillRect(uX - cw / 2 + 2, yNear - ch * 0.42, cw - 4, ch * 0.16);
  const blink = Math.floor(run.t * 4) % 2 === 0;
  ctx.fillStyle = blink ? SCENE.flag : SCENE.objectB; ctx.fillRect(uX - cw * 0.16, yNear - ch - 6, cw * 0.14, 6);
  ctx.fillStyle = blink ? SCENE.objectB : SCENE.flag; ctx.fillRect(uX + cw * 0.02, yNear - ch - 6, cw * 0.14, 6);
  ctx.font = uiFont(12); ctx.fillStyle = T.ink2; ctx.textAlign = "center"; ctx.fillText(lb.you, uX, yNear - ch - 12);
  // 速度箭嘴（實線）與加速度箭嘴（虛線）：比例只與畫面寬度和關卡上限有關，播放中不變
  const kv = (w * 0.22) / L.vMax, ka = (w * 0.12) / L.aMax;
  const aNow = run.as.length ? run.as[run.as.length - 1] : 0;
  const yV = yNear - ch * 0.15, yA = yNear + ch * 0.3;
  if (Math.abs(run.v) > 0.05) drawArrow2D(ctx, uX, yV, uX + run.v * kv, yV, "velocity", "v");
  if (Math.abs(aNow) > 0.01) drawArrow2D(ctx, uX, yA, uX + aNow * ka, yA, "acceleration", "a");
  // 左上讀數（提示框在中間，不會遮住）
  ctx.font = monoFont(12); ctx.fillStyle = T.ink; ctx.textAlign = "left"; ctx.textBaseline = "top";
  const ds = zero(run.s - sT);
  ctx.fillText(`t = ${sig(run.t)} s   v = ${sig(run.v)} m s⁻¹   Δs = ${ds > 0 ? "+" : ds < 0 ? "−" : ""}${sig(Math.abs(ds))} m`, 10, 8);
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
