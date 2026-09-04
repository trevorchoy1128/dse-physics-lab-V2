import { GLOSSARY } from "./glossary.gen";
import type { Text } from "@/shell/types";

const norm = (en: string) => en.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");

/** 由英文查權威中譯；查不到即拋錯（不得自行翻譯）。回傳 {zh, en} 方便直接作標籤。 */
export function term(en: string): Text {
  const k = norm(en);
  const hit = GLOSSARY[k] ?? GLOSSARY[k + "s"] ?? GLOSSARY[k.replace(/s$/, "")];
  if (!hit) throw new Error(`術語表無「${en}」：停下問老師，不得自行翻譯`);
  return { zh: hit.zh, en };
}
export const hasTerm = (en: string) => Boolean(GLOSSARY[norm(en)]);
