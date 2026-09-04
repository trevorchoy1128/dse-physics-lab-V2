import { useT } from "@/i18n/lang";
import { UI } from "@/i18n/ui";
import { chapterOf, isLive, summaryOf, titleOf, type CatSim } from "./catalogue";
import { navigate } from "./router";
import type { Text } from "@/shell/types";

// 模擬卡片：已實作的可按；未實作的清楚標「即將推出」且不可按（學生試用者：按了無反饋會以為按不中）
export function SimCards({ title, sims }: { title: Text; sims: CatSim[] }) {
  const t = useT();
  if (!sims.length) return null;
  return (
    <section className="topic">
      <div className="topic-h"><h2>{t(title)}</h2><span className="n">{sims.length}</span></div>
      <div className="grid">
        {sims.map(s => {
          const live = isLive(s); const ch = chapterOf(s);
          const inner = (
            <>
              <div className="top">
                <span className="id">#{String(s.n).padStart(3, "0")}</span>
                {ch && <span className="ch">{t({ zh: ch.zh, en: ch.en })}</span>}
                <span className={`badge ${s.type === "e" ? "b-e" : "b-c"}`}>{t(s.type === "e" ? UI.experiment : UI.concept)}</span>
              </div>
              <div className="title">{t(titleOf(s))}</div>
              <div className="desc">{t(summaryOf(s))}</div>
              <div className={`status ${live ? (s.status === "approved" ? "live" : "wip") : ""}`}>
                {live ? (s.status === "approved" ? t({ zh: "可使用", en: "Available" }) : t(UI.preview)) : t(UI.comingSoon)}
              </div>
            </>
          );
          return live
            ? <a key={s.id} className="card live" href={`#/sim/${s.id}`} onClick={e => { e.preventDefault(); navigate(`#/sim/${s.id}`); }}>{inner}</a>
            : <div key={s.id} className="card soon" aria-disabled="true">{inner}</div>;
        })}
      </div>
    </section>
  );
}
