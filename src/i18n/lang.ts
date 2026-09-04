import { create } from "zustand";
import type { Lang, Text } from "@/shell/types";

const KEY = "dsepl-lang";
const initial = (): Lang => { try { return localStorage.getItem(KEY) === "en" ? "en" : "zh"; } catch { return "zh"; } };

interface LangState { lang: Lang; setLang: (l: Lang) => void }
export const useLang = create<LangState>(set => ({
  lang: initial(),
  setLang: (lang) => { try { localStorage.setItem(KEY, lang); } catch { /* 私隱模式 */ } set({ lang }); },
}));

/** 取當前語言的文字 */
export const useT = () => { const lang = useLang(s => s.lang); return (t: Text) => t[lang]; };
export const pick = (t: Text, lang: Lang) => t[lang];
