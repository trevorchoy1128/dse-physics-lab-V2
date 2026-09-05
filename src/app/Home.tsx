import { useState } from "react";
import { useT } from "@/i18n/lang";
import { UI } from "@/i18n/ui";
import { UNITS } from "./units";
import { SIMS, simsOf } from "./catalogue";
import { SimCards } from "./SimCards";
import { TopBar } from "./TopBar";
import { navigate } from "./router";

export function Home() {
  const t = useT();
  const [q, setQ] = useState("");
  const nE = SIMS.filter(s => s.type === "e").length;
  const groups: { key: "c" | "e" | "s"; label: { zh: string; en: string } }[] = [
    { key: "c", label: { zh: "必修部分", en: "Compulsory" } }, { key: "e", label: { zh: "選修部分", en: "Electives" } }, { key: "s", label: { zh: "跨單元", en: "Cross-topic" } },
  ];
  const query = q.trim().toLowerCase();
  return (
    <>
      <TopBar query={q} onQuery={setQ} />
      <main className="wrap">
        {query ? (
          <SearchResults query={query} />
        ) : (
          <>
            <div className="intro">
              <div>
                <h1>{t({ zh: "HKDSE 物理 3D 實驗模擬器", en: "Interactive 3D simulations for HKDSE Physics" })}</h1>
                <p>{t({ zh: "按課程單元選擇。每個模擬都可以調校參數、記錄讀數、匯出數據，並附步驟、理論及常見混淆。", en: "Pick a unit. Every simulation lets you adjust parameters, record readings and export data, with steps, theory and common misconceptions." })}</p>
              </div>
              <div className="stats">
                <span><b>{SIMS.length}</b>{t({ zh: "模擬", en: "simulations" })}</span>
                <span><b>{nE}</b>{t(UI.experiment)}</span>
                <span><b>{SIMS.length - nE}</b>{t(UI.concept)}</span>
              </div>
            </div>
            {groups.map(g => (
              <section key={g.key}>
                <div className="map-label">{t(g.label)}</div>
                <div className={`units ${g.key === "c" ? "five" : "four"}`}>
                  {UNITS.filter(u => u.group === g.key).map(u => {
                    const list = simsOf(u.id); const e = list.filter(s => s.type === "e").length;
                    return (
                      <a key={u.id} className="unit" style={{ ["--unit" as string]: u.color }} href={`#/unit/${u.id}`} onClick={ev => { ev.preventDefault(); navigate(`#/unit/${u.id}`); }}>
                        <span className="icon">{u.icon}</span>
                        <span className="code">{t(u.code)}</span>
                        <span className="name">{t(u.name)}</span>
                        <span className="count">{e > 0 && <i className="e">{e} {t(UI.experiment)}</i>}<i className="c">{list.length - e} {t(UI.concept)}</i></span>
                      </a>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
        <footer className="foot">
          <span>DSE Physics Lab</span>
          <span>{t({ zh: "術語以牛津《活學物理》及教育局《物理科常用詞彙》為準", en: "Terminology follows Oxford Physics at Work and the EDB physics glossary" })}</span>
        </footer>
      </main>
    </>
  );
}

function SearchResults({ query }: { query: string }) {
  const t = useT();
  const hits = SIMS.filter(s => `${s.zh} ${s.en} ${s.dzh} ${s.den} ${s.ch}`.toLowerCase().includes(query));
  return (
    <>
      <div className="unit-head"><div><div className="code">{t({ zh: "搜尋結果", en: "Search results" })}</div><h2>“{query}”</h2></div></div>
      {UNITS.map(u => { const l = hits.filter(s => s.unit === u.id); return l.length ? <SimCards key={u.id} title={{ zh: `${u.code.zh} ${u.name.zh}`, en: `${u.code.en} ${u.name.en}` }} sims={l} /> : null; })}
      {!hits.length && <p className="empty">{t({ zh: "沒有符合的模擬", en: "No matching simulations" })}</p>}
    </>
  );
}
