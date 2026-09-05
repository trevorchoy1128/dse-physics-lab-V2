import { withUnit } from "./format";
import type { Text } from "./types";

export interface ReadoutDef { key: string; symbol: string; label: Text; unit: string; transform?: (v: number) => number; hint?: Text }

/** 把 observe() 的值變成面板文字：三位有效數字 + 指數式單位 */
export function formatReadouts(obs: Record<string, number>, defs: ReadoutDef[]): { key: string; symbol: string; label: Text; text: string; hint?: Text }[] {
  return defs.map(d => {
    const raw = obs[d.key];
    const v = raw === undefined ? NaN : (d.transform ? d.transform(raw) : raw);
    return { key: d.key, symbol: d.symbol, label: d.label, text: withUnit(v, d.unit || undefined), hint: d.hint };
  });
}
