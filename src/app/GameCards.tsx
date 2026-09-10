import { useT } from "@/i18n/lang";
import { UI } from "@/i18n/ui";
import { isGameLive, type GameDef } from "@/games/registry";
import { UNIT_COLORS } from "./units";
import { navigate } from "./router";
import type { Text } from "@/shell/types";

// 遊戲卡片：首頁「遊戲」部分、#/games、單元頁共用。可玩的可按；未做的標「即將推出」不可按（與模擬卡片同一規則）。
export function GameCards({ games, title }: { games: GameDef[]; title?: Text }) {
  const t = useT();
  if (!games.length) return null;
  const grid = (
    <div className="games">
      {games.map(g => {
        const live = isGameLive(g);
        const inner = (
          <>
            <div className="top"><span className="topic">{t(g.topic)}</span><span className="badge b-g">{t({ zh: "遊戲", en: "Game" })}</span></div>
            <div className="title">{t(g.title)}</div>
            <div className="desc">{t(g.summary)}</div>
            <div className={`status ${live ? "live" : ""}`}>{live ? t({ zh: "開始玩", en: "Play" }) : t(UI.comingSoon)}</div>
          </>
        );
        const style = { ["--unit" as string]: UNIT_COLORS[g.unit] };
        return live
          ? <a key={g.id} className="card live game-card" style={style} href={`#/game/${g.id}`} onClick={e => { e.preventDefault(); navigate(`#/game/${g.id}`); }}>{inner}</a>
          : <div key={g.id} className="card soon game-card" style={style} aria-disabled="true">{inner}</div>;
      })}
    </div>
  );
  if (!title) return grid;
  return (
    <section className="topic">
      <div className="topic-h"><h2>{t(title)}</h2><span className="n">{games.length}</span></div>
      {grid}
    </section>
  );
}
