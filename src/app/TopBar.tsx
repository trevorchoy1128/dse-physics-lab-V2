import { useLang, useT } from "@/i18n/lang";
import { UI } from "@/i18n/ui";
import { navigate } from "./router";

export function TopBar({ query, onQuery }: { query?: string; onQuery?: (q: string) => void }) {
  const t = useT();
  const { lang, setLang } = useLang();
  return (
    <div className="bar"><div className="bar-in">
      <a className="brand" href="#/" onClick={e => { e.preventDefault(); onQuery?.(""); navigate("#/"); }}>
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M9 3h8M11 3v7L4.5 21a1.5 1.5 0 0 0 1.3 2.2h14.4a1.5 1.5 0 0 0 1.3-2.2L15 10V3" /><path d="M7.5 17h11" /></svg>
        DSE Physics Lab
      </a>
      <div className="spacer" />
      {onQuery && (
        <label className="search">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3.5 3.5" /></svg>
          <input type="search" value={query ?? ""} placeholder={t(UI.search)} aria-label={t(UI.search)} onChange={e => onQuery(e.target.value)} />
        </label>
      )}
      <div className="modes" role="group" aria-label="Language">
        <button type="button" aria-pressed={lang === "zh"} onClick={() => setLang("zh")}>中</button>
        <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
      </div>
    </div></div>
  );
}
