import { useMemo, useState, type ReactNode } from "react";
import { useT } from "@/i18n/lang";
import { UI } from "@/i18n/ui";

// guide.zh.md 固定五節：## 步驟 / 觀察步驟、## 理論、## 常見混淆、## 觀察重點、## 教師備註。
// 這裏做最小的 Markdown 轉換：標題、段落、清單、*斜體*、[scenario-key] 連結。
const TAB_KEYS = ["steps", "theory", "misconceptions", "watch", "teacher"] as const;
const HEAD_MATCH: Record<string, RegExp> = {
  steps: /步驟|steps/i, theory: /理論|theory/i, misconceptions: /常見混淆|misconception/i, watch: /觀察重點|watch/i, teacher: /教師備註|teacher/i,
};

function splitSections(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = md.split(/^## /m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf("\n");
    const title = p.slice(0, nl).trim(), body = p.slice(nl + 1);
    const key = TAB_KEYS.find(k => HEAD_MATCH[k].test(title)) ?? title;
    out[key] = body;
  }
  return out;
}

function inline(s: string, onScenario?: (k: string) => void): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*([^*]+)\*|\[([a-z0-9-]+)\]/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) nodes.push(s.slice(last, m.index));
    if (m[1]) nodes.push(<i key={i++}>{m[1]}</i>);
    else nodes.push(<button key={i++} type="button" className="try-link" onClick={() => onScenario?.(m![2])}>▶ {m[2]}</button>);
    last = m.index + m[0].length;
  }
  if (last < s.length) nodes.push(s.slice(last));
  return nodes;
}

function Md({ text, onScenario }: { text: string; onScenario?: (k: string) => void }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: string[] = [], ordered = false, key = 0;
  const flush = () => {
    if (!list.length) return;
    const items = list.map((l, i) => <li key={i}>{inline(l, onScenario)}</li>);
    out.push(ordered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>);
    list = [];
  };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { flush(); continue; }
    if (l.startsWith("### ")) { flush(); out.push(<h4 key={key++}>{inline(l.slice(4))}</h4>); continue; }
    const li = /^(-|\d+\.)\s+(.*)$/.exec(l);
    if (li) { if (list.length && ordered !== li[1].endsWith(".")) flush(); ordered = li[1].endsWith("."); list.push(li[2]); continue; }
    flush(); out.push(<p key={key++}>{inline(l, onScenario)}</p>);
  }
  flush();
  return <>{out}</>;
}

export function Guide({ md, onScenario, extra }: { md: string; onScenario?: (k: string) => void; extra?: { key: string; label: { zh: string; en: string }; node: ReactNode }[] }) {
  const t = useT();
  const sections = useMemo(() => splitSections(md), [md]);
  const tabs = [
    ...TAB_KEYS.filter(k => sections[k]).map(k => ({ key: k, label: UI.tabs[k], node: <Md text={sections[k]} onScenario={onScenario} /> })),
    ...(extra ?? []),
  ];
  const [active, setActive] = useState(tabs[0]?.key);
  const cur = tabs.find(x => x.key === active) ?? tabs[0];
  if (!tabs.length) return null;
  return (
    <section className="guide">
      <div className="tabs" role="tablist">
        {tabs.map(x => <button key={x.key} role="tab" type="button" aria-selected={x.key === cur.key} onClick={() => setActive(x.key)}>{t(x.label)}</button>)}
      </div>
      <div className="tab-body">{cur.node}</div>
    </section>
  );
}
