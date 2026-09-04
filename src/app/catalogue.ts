import raw from "../../content/catalogue.json";
import type { SimStatus, Text, UnitId } from "@/shell/types";
import { hasSim } from "@/sims/registry";

export interface CatSim {
  id: string; unit: UnitId; ch: string; type: "e" | "c"; star: 0 | 1; spec?: string;
  zh: string; en: string; dzh: string; den: string; status: SimStatus;
  n: number;               // 目錄編號（單元 → 實驗 → 概念 次序）
}
export interface Chapter { code: string; zh: string; en: string; unsure: boolean }

const CAT = raw as unknown as { chapters: Record<string, [string, string, string][]>; sims: Omit<CatSim, "n">[] };

export const UNIT_ORDER: UnitId[] = ["c1", "c2", "c3", "c4", "c5", "e1", "e2", "e3", "e4", "sk"];

export const CHAPTERS: Record<string, Chapter[]> = Object.fromEntries(
  Object.entries(CAT.chapters).map(([u, list]) => [u, list.map(([code, zh, en]) => ({ code: code.replace(/\?$/, ""), zh, en, unsure: code.endsWith("?") }))]),
);

// 編號與 build-catalogue.mjs 一致：單元 → 實驗 → 概念，檔案次序
export const SIMS: CatSim[] = (() => {
  const out: CatSim[] = [];
  for (const u of UNIT_ORDER) for (const t of ["e", "c"] as const) for (const s of CAT.sims) if (s.unit === u && s.type === t) out.push({ ...s, n: out.length + 1 });
  return out;
})();

export const simsOf = (unit: UnitId) => SIMS.filter(s => s.unit === unit);
export const chapterOf = (s: CatSim): Chapter | undefined => CHAPTERS[s.unit]?.find(c => c.code === s.ch.replace(/\?$/, ""));
export const titleOf = (s: CatSim): Text => ({ zh: s.zh, en: s.en });
/** 卡片描述：去掉開發用的規格代號前綴（S2 · …），學生不需要看到 */
export const summaryOf = (s: CatSim): Text => ({ zh: s.dzh.replace(/^S\d+ · /, ""), en: s.den.replace(/^S\d+ · /, "") });
export const isLive = (s: CatSim) => hasSim(s.id);
