import type { SimManifest } from "@/shell/types";

// 範本 / 冒煙測試模擬：驗證共用層可端對端運作。不是課程模擬，不出現在目錄。
export const manifest: SimManifest = {
  id: "example-fall",
  unit: "c2",
  chapter: "Bk2 B2",
  type: "c",
  phase: 1,
  needs3D: "low",
  title: { zh: "自由下落（共用層範本）", en: "Free fall (shell template)" },
  summary: { zh: "一個球由靜止釋放，顯示速度、加速度與重量箭嘴。", en: "A ball released from rest, showing velocity, acceleration and weight arrows." },
  dsePapers: [],
  pendingPapers: [],
  assumptions: [{ zh: "忽略空氣阻力", en: "Air resistance neglected" }],
  pendingTerms: [],
  beyondSpec: [],
  version: "0.1.0",
};
