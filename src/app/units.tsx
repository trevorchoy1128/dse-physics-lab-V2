import type { ReactNode } from "react";
import type { Text, UnitId } from "@/shell/types";

export interface UnitDef { id: UnitId; group: "c" | "e" | "s"; code: Text; name: Text; icon: ReactNode; color: string }

// 每個單元一種主色（首頁格子、模擬頁標題列、試試看按鈕）。刻意避開向量顏色編碼（紅、藍、橙、紫、黑、綠）的正色調
export const UNIT_COLORS: Record<UnitId, string> = {
  c1: "#d9482b", c2: "#e8891d", c3: "#1596c4", c4: "#4b5cb0", c5: "#8e44ad",
  e1: "#2f3e8f", e2: "#c2185b", e3: "#2e9e5b", e4: "#e53963", sk: "#5b7083",
};

const svg = (d: ReactNode) => <svg viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{d}</svg>;

export const UNITS: UnitDef[] = [
  { id: "c1", color: UNIT_COLORS["c1"], group: "c", code: { zh: "必修 I", en: "Compulsory I" }, name: { zh: "熱和氣體", en: "Heat and Gases" }, icon: svg(<><path d="M10 5v16a4 4 0 1 0 4 0V5a2 2 0 0 0-4 0z" /><path d="M12 12v9" /><circle cx="24" cy="9" r="1.6" /><circle cx="28" cy="16" r="1.6" /><circle cx="23" cy="22" r="1.6" /><circle cx="29" cy="26" r="1.6" /></>) },
  { id: "c2", color: UNIT_COLORS["c2"], group: "c", code: { zh: "必修 II", en: "Compulsory II" }, name: { zh: "力和運動", en: "Force and Motion" }, icon: svg(<><path d="M4 26h26" /><rect x="7" y="15" width="12" height="8" /><circle cx="10" cy="26" r="2" /><circle cx="16" cy="26" r="2" /><path d="M19 19h9m0 0-3-3m3 3-3 3" /></>) },
  { id: "c3", color: UNIT_COLORS["c3"], group: "c", code: { zh: "必修 III", en: "Compulsory III" }, name: { zh: "波動", en: "Wave Motion" }, icon: svg(<><path d="M3 17c3-8 6-8 9 0s6 8 9 0 6-8 9 0" /><path d="M3 17h28" strokeDasharray="1.5 3" /></>) },
  { id: "c4", color: UNIT_COLORS["c4"], group: "c", code: { zh: "必修 IV", en: "Compulsory IV" }, name: { zh: "電和磁", en: "Electricity and Magnetism" }, icon: svg(<><path d="M9 6v12a8 8 0 0 0 16 0V6" /><path d="M9 6h5v6H9zM20 6h5v6h-5z" /><path d="M17 26v3" /></>) },
  { id: "c5", color: UNIT_COLORS["c5"], group: "c", code: { zh: "必修 V", en: "Compulsory V" }, name: { zh: "放射現象和核能", en: "Radioactivity and Nuclear Energy" }, icon: svg(<><circle cx="17" cy="17" r="2.2" /><path d="M17 12.5V5a12 12 0 0 1 10.4 6l-6.5 3.7M13.1 14.7 6.6 11A12 12 0 0 1 17 5M13.1 19.3l-6.5 3.7a12 12 0 0 0 20.8 0l-6.5-3.7" /></>) },
  { id: "e1", color: UNIT_COLORS["e1"], group: "e", code: { zh: "選修 I", en: "Elective I" }, name: { zh: "天文學和航天科學", en: "Astronomy and Space Science" }, icon: svg(<><circle cx="17" cy="17" r="7" /><path d="M5 21c4 4 20 4 24-4M6 13c5-5 18-4 22 3" /></>) },
  { id: "e2", color: UNIT_COLORS["e2"], group: "e", code: { zh: "選修 II", en: "Elective II" }, name: { zh: "原子世界", en: "Atomic World" }, icon: svg(<><circle cx="17" cy="17" r="2" /><ellipse cx="17" cy="17" rx="13" ry="5" /><ellipse cx="17" cy="17" rx="13" ry="5" transform="rotate(60 17 17)" /><ellipse cx="17" cy="17" rx="13" ry="5" transform="rotate(-60 17 17)" /></>) },
  { id: "e3", color: UNIT_COLORS["e3"], group: "e", code: { zh: "選修 III", en: "Elective III" }, name: { zh: "能量和能源的使用", en: "Energy and Use of Energy" }, icon: svg(<><circle cx="11" cy="11" r="4" /><path d="M11 3v2M11 17v2M3 11h2M17 11h2M5.3 5.3l1.4 1.4M15.3 15.3l1.4 1.4M16.7 5.3l-1.4 1.4M6.7 15.3l-1.4 1.4" /><path d="M25 30V18M25 18l-5-3M25 18l5-3M25 18v-6" /></>) },
  { id: "e4", color: UNIT_COLORS["e4"], group: "e", code: { zh: "選修 IV", en: "Elective IV" }, name: { zh: "醫學物理學", en: "Medical Physics" }, icon: svg(<path d="M3 18h7l3-8 4 16 3-8h11" />) },
  { id: "sk", color: UNIT_COLORS["sk"], group: "s", code: { zh: "跨單元", en: "Cross-topic" }, name: { zh: "基礎技能", en: "Skills" }, icon: svg(<><path d="M5 5v24h24" /><path d="M8 24 27 9" /><circle cx="11" cy="21" r="1.4" /><circle cx="16" cy="18" r="1.4" /><circle cx="21" cy="13" r="1.4" /><circle cx="25" cy="11" r="1.4" /></>) },
];
export const unitOf = (id: string) => UNITS.find(u => u.id === id);
