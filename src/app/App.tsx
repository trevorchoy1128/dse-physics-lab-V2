import { useEffect, useState } from "react";
import { useRoute, navigate } from "./router";
import { REGISTRY } from "@/sims/registry";
import { SimShell } from "@/shell/SimShell";
import { HandednessFixture } from "@/shell/fixtures/handedness/HandednessScene";
import { Home } from "./Home";
import { UnitPage } from "./UnitPage";
import { GamesPage, GamePage } from "./GamesPage";
import { TopBar } from "./TopBar";
import { SIMS } from "./catalogue";
import { useT } from "@/i18n/lang";
import { UI } from "@/i18n/ui";
import type { SimModule } from "@/shell/types";

export default function App() {
  const { path } = useRoute();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [path.join("/")]);
  if (path[0] === "sim" && path[1]) return <SimPage id={path[1]} />;
  if (path[0] === "unit" && path[1]) return <UnitPage id={path[1]} />;
  if (path[0] === "games") return <GamesPage />;
  if (path[0] === "game" && path[1]) return <GamePage id={path[1]} />;
  if (path[0] === "fixtures" && path[1] === "handedness") return <HandednessFixture />;
  return <Home />;
}

function SimPage({ id }: { id: string }) {
  const t = useT();
  const [sim, setSim] = useState<SimModule<unknown, Record<string, unknown>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setSim(null); setErr(null);
    const load = REGISTRY[id];
    if (!load) { setErr("soon"); return; }
    load().then(setSim).catch(e => setErr(String(e)));
  }, [id]);
  if (err) {
    const cat = SIMS.find(s => s.id === id);
    return (
      <>
        <TopBar />
        <main className="wrap">
          <button type="button" className="back" onClick={() => navigate(cat ? `#/unit/${cat.unit}` : "#/")}>← {t(UI.backHome)}</button>
          <h2>{cat ? t({ zh: cat.zh, en: cat.en }) : id}</h2>
          <p>{err === "soon" ? t(UI.comingSoon) : err}</p>
        </main>
      </>
    );
  }
  if (!sim) return <main className="wrap"><p>…</p></main>;
  return <SimShell key={id} sim={sim} />;
}
