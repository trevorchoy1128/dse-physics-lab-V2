import { useEffect, useState } from "react";
import { useRoute } from "./router";
import { REGISTRY } from "@/sims/registry";
import { SimShell } from "@/shell/SimShell";
import { HandednessFixture } from "@/shell/fixtures/handedness/HandednessScene";
import { useLang, useT } from "@/i18n/lang";
import { UI } from "@/i18n/ui";
import type { SimModule } from "@/shell/types";

export default function App() {
  const { path } = useRoute();
  if (path[0] === "sim" && path[1]) return <SimPage id={path[1]} />;
  if (path[0] === "fixtures" && path[1] === "handedness") return <HandednessFixture />;
  return <Home />;
}

function SimPage({ id }: { id: string }) {
  const [sim, setSim] = useState<SimModule<unknown, Record<string, unknown>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setSim(null); setErr(null);
    const load = REGISTRY[id];
    if (!load) { setErr(`未有此模擬：${id}`); return; }
    load().then(setSim).catch(e => setErr(String(e)));
  }, [id]);
  if (err) return <main className="wrap"><p>{err}</p><a href="#/">← 課程地圖</a></main>;
  if (!sim) return <main className="wrap"><p>載入中…</p></main>;
  return <SimShell key={id} sim={sim} />;
}

// 首頁：階段 0 第 2 步會移植完整課程地圖；現階段列出已實作的模擬
function Home() {
  const t = useT();
  const { lang, setLang } = useLang();
  return (
    <main className="wrap">
      <header className="home-head">
        <h1>DSE Physics Lab</h1>
        <div className="modes"><button type="button" aria-pressed={lang === "zh"} onClick={() => setLang("zh")}>中</button><button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button></div>
      </header>
      <p>{t(UI.home)}（移植中）。已實作的模擬：</p>
      <ul className="simlist">
        {Object.keys(REGISTRY).map(id => <li key={id}><a href={`#/sim/${id}`}>{id}</a></li>)}
        <li><a href="#/fixtures/handedness">fixtures/handedness（左右手基準場景）</a></li>
      </ul>
    </main>
  );
}
