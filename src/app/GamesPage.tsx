import { useEffect, useState, type ComponentType } from "react";
import { useT } from "@/i18n/lang";
import { UI } from "@/i18n/ui";
import { GAMES, gameOf, isGameLive } from "@/games/registry";
import { UNITS } from "./units";
import { GameCards } from "./GameCards";
import { TopBar } from "./TopBar";
import { navigate } from "./router";
import type { UnitId } from "@/shell/types";

// 遊戲清單：按單元分組（單元主色色條），頂部單元 chips 篩選；可玩的排前，即將推出的收在最後一段。
export function GamesPage() {
  const t = useT();
  const [unit, setUnit] = useState<UnitId | null>(null);
  const nLive = GAMES.filter(isGameLive).length;
  const unitsWithGames = UNITS.filter(u => GAMES.some(g => g.unit === u.id));
  const live = GAMES.filter(g => isGameLive(g) && (!unit || g.unit === unit));
  const soon = GAMES.filter(g => !isGameLive(g) && (!unit || g.unit === unit));
  return (
    <>
      <TopBar />
      <main className="wrap">
        <button type="button" className="back" onClick={() => navigate("#/")}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d="M9 2 4 7l5 5" /></svg>{t(UI.backHome)}
        </button>
        <div className="unit-head">
          <div>
            <div className="code">{t({ zh: "玩住學", en: "Learn by playing" })}</div>
            <h2>{t({ zh: "物理遊戲", en: "Physics games" })}</h2>
          </div>
        </div>
        <p className="games-intro">{t({ zh: "模擬器是調參數看結果；遊戲反過來，給你目標，要你用公式找參數。每關一個物理要點，有提示，有星星。", en: "Simulations let you tweak parameters and watch. Games flip it: here is the target, use the physics to find the parameters. One idea per level, with hints and stars." })}</p>
        <div className="filters" role="group" aria-label={t({ zh: "單元", en: "Unit" })}>
          <button type="button" className="chip" aria-pressed={unit === null} onClick={() => setUnit(null)}>{t({ zh: "全部", en: "All" })}</button>
          {unitsWithGames.map(u => (
            <button key={u.id} type="button" className="chip-ch" style={{ ["--unit" as string]: u.color }} aria-pressed={unit === u.id} onClick={() => setUnit(unit === u.id ? null : u.id)}>
              <b>{t(u.code)}</b> {t(u.name)}
            </button>
          ))}
          <span className="result">{live.length} / {nLive}</span>
        </div>
        {UNITS.map(u => { const l = live.filter(g => g.unit === u.id); return l.length ? <GameCards key={u.id} title={{ zh: `${u.code.zh} ${u.name.zh}`, en: `${u.code.en} ${u.name.en}` }} games={l} /> : null; })}
        {!live.length && <p className="empty">{t({ zh: "這個單元未有可玩的遊戲", en: "No playable games in this unit yet" })}</p>}
        <GameCards title={UI.comingSoon} games={soon} />
      </main>
    </>
  );
}

export function GamePage({ id }: { id: string }) {
  const t = useT();
  const g = gameOf(id);
  const [C, setC] = useState<ComponentType | null>(null);
  useEffect(() => { setC(null); g?.load?.().then(m => setC(() => m.default)); }, [g]);
  if (!g || !g.load) {
    return (
      <>
        <TopBar />
        <main className="wrap">
          <button type="button" className="back" onClick={() => navigate("#/games")}>← {t({ zh: "返回遊戲", en: "Back to games" })}</button>
          <h2>{g ? t(g.title) : id}</h2>
          <p>{t(UI.comingSoon)}</p>
        </main>
      </>
    );
  }
  if (!C) return <main className="wrap"><p>…</p></main>;
  return <C />;
}
