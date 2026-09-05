import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { createRunner } from "./runner";
import { formatReadouts, type ReadoutDef } from "./readouts";
import { withUnit } from "./format";
import { Guide } from "./Guide";
import { useLang, useT } from "@/i18n/lang";
import { UI } from "@/i18n/ui";
import type { ControlDef, Layers, SimModule, Scenario } from "./types";

const SPEEDS = [0.1, 0.25, 0.5, 1, 2];

export interface SimShellProps { sim: SimModule<unknown, Record<string, unknown>> & { readouts?: ReadoutDef[] } }

// 所有模擬共用的外殼：參數面板、播放控制、圖層開關、讀數、試試看、分頁。模擬只提供資料與場景。
export function SimShell({ sim }: SimShellProps) {
  const t = useT();
  const { lang, setLang } = useLang();
  const [params, setParams] = useState<Record<string, unknown>>(() => ({ ...sim.defaults }));
  const [layers, setLayers] = useState<Layers>(() => Object.fromEntries(sim.layers.map(l => [l.key, l.default])));
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [, setFrame] = useState(0);   // 只用作每幀重繪的觸發
  const [activeScenario, setActiveScenario] = useState<Scenario<Record<string, unknown>> | null>(null);
  const runner = useRef(createRunner(sim.model, params));

  // 參數改變：重置運行（實驗流程：改參數要重做）；liveParams 例外，即時生效不重置
  const applyParams = useCallback((next: Record<string, unknown>, live = false) => {
    setParams(next);
    if (live) runner.current.params = next; else runner.current.reset(next);
    setFrame(f => f + 1);
  }, []);
  const setParam = useCallback((key: string, value: unknown) => {
    setParams(prev => { const next = { ...prev, [key]: value }; const live = sim.liveParams?.includes(key) ?? false; if (live) runner.current.params = next; else runner.current.reset(next); return next; });
    setFrame(f => f + 1);
  }, [sim]);

  // 固定步長 + RAF；分頁隱藏時暫停
  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      // 上限 1 s：視窗在背景時瀏覽器把動畫降至每秒 1 幀，仍能保持真實時間（學生試用者：「播放比 1× 慢 30 倍」）
      const dt = Math.min(1, (now - last) / 1000); last = now;
      if (playing && !document.hidden) runner.current.advance(dt * speed);
      setFrame(f => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const state = runner.current.state;
  const obs = useMemo(() => sim.model.observe(state, params), [sim, state, params]);
  const plan = useMemo(() => sim.plan(state, params, obs, layers), [sim, state, params, obs, layers]);
  const readouts = formatReadouts({ ...obs, t: runner.current.t }, sim.readouts ?? []);
  const Scene = sim.Scene;

  const runScenario = (s: Scenario<Record<string, unknown>>) => {
    setActiveScenario(s);
    if (s.layers) setLayers(prev => ({ ...prev, ...Object.fromEntries(s.layers!.map(k => [k, true])) }));
    applyParams({ ...sim.defaults, ...s.params }); setPlaying(true);
  };

  return (
    <div className="sim">
      <header className="sim-head">
        <a className="brand" href="#/">⚗ DSE Physics Lab</a>
        <div className="sim-title">
          <span className="code">{sim.manifest.chapter}{sim.manifest.spec?.code ? ` · ${sim.manifest.spec.code}` : ""} · v{sim.manifest.version}</span>
          <h1>{t(sim.manifest.title)}</h1>
        </div>
        <div className="modes" role="group" aria-label="Language">
          <button type="button" aria-pressed={lang === "zh"} onClick={() => setLang("zh")}>中</button>
          <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
        </div>
      </header>

      <div className="sim-main">
        <div className="stage">
          <div className="transport">
            <button type="button" className="primary" onClick={() => setPlaying(p => !p)}>{playing ? "⏸ " + t(UI.pause) : "▶ " + t(UI.play)}</button>
            <button type="button" onClick={() => { setPlaying(false); runner.current.advance(sim.stepSize ?? 0.05); setFrame(f => f + 1); }}>⏭ {t(UI.step)} {sim.stepSize ?? 0.05} s</button>
            <button type="button" onClick={() => { runner.current.reset(); setFrame(f => f + 1); }}>↺ {t(UI.reset)}</button>
            <button type="button" onClick={() => { setActiveScenario(null); setLayers(Object.fromEntries(sim.layers.map(l => [l.key, l.default]))); applyParams({ ...sim.defaults }); }}>⟲ {t(UI.restore)}</button>
            <label className="speed">{t(UI.speed)}
              <select value={speed} onChange={e => setSpeed(Number(e.target.value))}>{SPEEDS.map(s => <option key={s} value={s}>{s}×</option>)}</select>
            </label>
            {sim.duration && (
              <label className="scrub" aria-label={t(UI.time)}>
                <span className="scrub-label">{lang === "zh" ? "跳到" : "Jump to"} <i>t</i> =</span>
                <input type="range" min={0} max={sim.duration(params)} step={0.01} value={Math.min(runner.current.t, sim.duration(params))}
                  onChange={e => { setPlaying(false); runner.current.seek(Number(e.target.value)); setFrame(f => f + 1); }} />
                <input type="number" min={0} max={sim.duration(params)} step={0.1} value={Math.round(Math.min(runner.current.t, sim.duration(params)) * 100) / 100}
                  aria-label={t(UI.time)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                  onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) { setPlaying(false); runner.current.seek(Math.max(0, Math.min(sim.duration!(params), v))); setFrame(f => f + 1); } }} />
                <span>s</span>
              </label>
            )}
            <span className="clock"><i>t</i> = {withUnit(runner.current.t, "s")}</span>
          </div>
          <div className="stage-canvas">
            {sim.mode === "3d" ? (
              <Canvas shadows="percentage" camera={{ position: sim.camera?.position ?? [6, 4, 8], fov: sim.camera?.fov ?? 40 }} dpr={[1, 2]}>
                <color attach="background" args={["#f5f7f4"]} />
                <ambientLight intensity={0.7} />
                <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
                <Grid args={[40, 40]} cellColor="#d8ddd7" sectionColor="#c3cac2" fadeDistance={60} position={[0, -0.001, 0]} />
                <Scene plan={plan} />
                <OrbitControls makeDefault enableDamping dampingFactor={0.1} target={sim.camera?.target ?? [0, 0, 0]} />
              </Canvas>
            ) : (
              <Scene plan={plan} onInput={setParam} />
            )}
          </div>
          {sim.manifest.assumptions.length > 0 && (
            <div className="assumptions"><b>{t(UI.assumptions)}：</b>{sim.manifest.assumptions.map(a => t(a)).join("；")}</div>
          )}

        </div>

        <aside className="panel">
          <h2>{t(UI.params)}</h2>
          <div className="controls">
            {sim.controls.filter(c => c.visible?.(params) ?? true).map(c => <Control key={c.key} def={c} value={params[c.key]} onChange={v => setParam(c.key, v)} />)}
          </div>

          {sim.layers.length > 0 && <>
            <h2>{t(UI.layers)}</h2>
            <div className="layers">
              {sim.layers.map(l => (
                <label key={l.key} className="chk"><input type="checkbox" checked={!!layers[l.key]} onChange={e => setLayers({ ...layers, [l.key]: e.target.checked })} /> {t(l.label)}</label>
              ))}
            </div>
          </>}

          {readouts.length > 0 && <>
            <h2>{t(UI.readouts)}</h2>
            <table className="readouts"><tbody>
              {readouts.map(r => <tr key={r.key}><th><i>{r.symbol}</i> <span>{t(r.label)}</span></th><td>{r.text}</td></tr>)}
            </tbody></table>
          </>}

          {sim.scenarios.length > 0 && <>
            <h2>{t(UI.tryIt)}</h2>
            <div className="scenarios">
              {sim.scenarios.map(s => (
                <button key={s.key} type="button" className={activeScenario?.key === s.key ? "on" : ""} onClick={() => runScenario(s)}>
                  <span className="mis">「{t(s.misconception)}」</span>
                </button>
              ))}
              {activeScenario && <div className="scenario-note"><p><b>{lang === "zh" ? "看甚麼" : "Watch"}：</b>{t(activeScenario.watch)}</p><p><b>{lang === "zh" ? "會見到" : "You will see"}：</b>{t(activeScenario.expect)}</p></div>}
            </div>
          </>}
        </aside>
      </div>

      <Guide md={sim.guideZh} onScenario={k => { const s = sim.scenarios.find(x => x.key === k); if (s) runScenario(s); }} />
    </div>
  );
}

function Control({ def, value, onChange }: { def: ControlDef; value: unknown; onChange: (v: unknown) => void }) {
  const t = useT();
  const kind = def.kind ?? "slider";
  const id = `ctl-${def.key}`;
  return (
    <div className="control">
      <label htmlFor={id}>{def.symbol && <i>{def.symbol}</i>} {t(def.label)}{def.unit ? <span className="u-unit"> / {def.unit}</span> : null}</label>
      {kind === "slider" && (
        <div className="slider-row">
          <input id={id} type="range" min={def.min} max={def.max} step={def.step} value={Number(value)} onChange={e => onChange(Number(e.target.value))} />
          <input type="number" min={def.min} max={def.max} step={def.step} value={Number(value)} onChange={e => onChange(Number(e.target.value))} aria-label={t(def.label)} />
        </div>
      )}
      {kind === "select" && (
        <select id={id} value={String(value)} onChange={e => { const o = def.options?.find(x => String(x.value) === e.target.value); onChange(o ? o.value : e.target.value); }}>
          {def.options?.map(o => <option key={String(o.value)} value={String(o.value)}>{t(o.label)}</option>)}
        </select>
      )}
      {kind === "toggle" && <input id={id} type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />}
      {kind === "segment" && (
        <div className="segment" role="group" aria-label={t(def.label)}>
          {def.options?.map(o => <button key={String(o.value)} type="button" aria-pressed={String(o.value) === String(value)} onClick={() => onChange(o.value)}>{t(o.label)}</button>)}
        </div>
      )}
    </div>
  );
}
