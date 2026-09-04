// 讀數格式：固定三位有效數字，指數式單位。規範見 CLAUDE.md「物理與呈現規範」
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
export const sup = (n: number) => String(n).split("").map(c => SUP[c] ?? c).join("");

/** 三位有效數字。|x| ≥ 10⁴ 或 < 10⁻³ 用 a × 10ⁿ；否則定點，保留尾隨零（9.80 不寫 9.8）。 */
export function sig(x: number, n = 3): string {
  if (!Number.isFinite(x)) return "—";
  if (x === 0) return (0).toFixed(n - 1);
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= 4 || e <= -4) {
    const m = x / 10 ** e;
    const ms = Number(m.toPrecision(n));
    if (Math.abs(ms) >= 10) return sig(x, n); // toPrecision 進位到 10 的邊界情況極少，遞歸一次即穩定
    return `${ms.toFixed(n - 1)} × 10${sup(e)}`;
  }
  const rounded = Number(x.toPrecision(n));
  const e2 = rounded === 0 ? e : Math.floor(Math.log10(Math.abs(rounded)));
  const decimals = Math.max(0, n - 1 - e2);
  return rounded.toFixed(decimals);
}

/** 數值 + 單位，如 "9.81 m s⁻²"；無單位只回數值 */
export const withUnit = (x: number, unit?: string, n = 3) => unit ? `${sig(x, n)} ${unit}` : sig(x, n);

/** 角度：內部弧度，顯示用度 */
export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
