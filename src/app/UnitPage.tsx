import { useState } from "react";
import { useT } from "@/i18n/lang";
import { UI } from "@/i18n/ui";
import { unitOf } from "./units";
import { CHAPTERS, simsOf } from "./catalogue";
import { SimCards } from "./SimCards";
import { TopBar } from "./TopBar";
import { navigate } from "./router";
import type { UnitId } from "@/shell/types";

export function UnitPage({ id }: { id: string }) {
  const t = useT();
  const u = unitOf(id);
  const [type, setType] = useState<"all" | "e" | "c">("all");
  const [chapter, setChapter] = useState<string | null>(null);   // 章節是可按的篩選，不再像按鈕卻沒反應
  if (!u) return <main className="wrap"><p>未有此單元</p></main>;
  const chapters = (CHAPTERS[u.id] ?? []).filter(c => c.code !== "—");
  let list = simsOf(u.id as UnitId);
  if (type !== "all") list = list.filter(s => s.type === type);
  if (chapter) list = list.filter(s => s.ch.replace(/\?$/, "") === chapter);
  return (
    <>
      <TopBar />
      <main className="wrap">
        <button type="button" className="back" onClick={() => navigate("#/")}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d="M9 2 4 7l5 5" /></svg>{t(UI.backHome)}
        </button>
        <div className="unit-head">
          <span className="icon">{u.icon}</span>
          <div>
            <div className="code">{t(u.code)}</div>
            <h2>{t(u.name)}</h2>
          </div>
        </div>
        {chapters.length > 0 && (
          <div className="chs" role="group" aria-label={t({ zh: "課本章節", en: "Textbook chapters" })}>
            <span className="chs-label">{t({ zh: "課本章節", en: "Textbook chapters" })}</span>
            {chapters.map(c => (
              <button key={c.code} type="button" className="chip-ch" aria-pressed={chapter === c.code} onClick={() => setChapter(chapter === c.code ? null : c.code)}>
                <b>{c.code.replace(/^Bk\w+ /, "")}</b> {t({ zh: c.zh, en: c.en })}
              </button>
            ))}
          </div>
        )}
        <div className="filters" role="group">
          {(["all", "e", "c"] as const).map(k => (
            <button key={k} type="button" className="chip" aria-pressed={type === k} onClick={() => setType(k)}>
              {k === "all" ? t({ zh: "全部", en: "All" }) : t(k === "e" ? UI.experiment : UI.concept)}
            </button>
          ))}
          <span className="result">{list.length} / {simsOf(u.id as UnitId).length}</span>
        </div>
        <SimCards title={UI.experiment} sims={list.filter(s => s.type === "e")} />
        <SimCards title={UI.concept} sims={list.filter(s => s.type === "c")} />
        {!list.length && <p className="empty">{t({ zh: "沒有符合的模擬", en: "No matching simulations" })}</p>}
      </main>
    </>
  );
}
