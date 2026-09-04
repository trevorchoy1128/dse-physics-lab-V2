// 由 reference/08_中英術語對照表.csv 生成 src/i18n/glossary.gen.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadGlossary, ROOT } from "./glossary.mjs";

const g = loadGlossary();
const entries = [...g.byEn.entries()].map(([en, v]) => [en, { zh: v.zh, alts: v.alts, src: v.src }]);
const out = `// 自動生成，請勿手改。來源：reference/08_中英術語對照表.csv（${entries.length} 條）。重新生成：node tools/build-glossary.mjs
export interface GlossaryEntry { zh: string; alts: string[]; src: string }
export const GLOSSARY: Record<string, GlossaryEntry> = ${JSON.stringify(Object.fromEntries(entries))};
`;
writeFileSync(join(ROOT, "src/i18n/glossary.gen.ts"), out);
console.log(`glossary.gen.ts：${entries.length} 條`);
