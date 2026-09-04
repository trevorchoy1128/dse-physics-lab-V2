import type { SimManifest } from "@/shell/types";

// 範本：把 example-fall 換成真正的模擬。中文名詞先用 node tools/term.mjs 查證。
export const manifest: SimManifest = {
  id: "example-fall",
  unit: "c2",
  chapter: "Bk2 B2",
  type: "c",
  phase: 1,
  needs3D: "low",
  spec: { doc: "reference/11_Book2_難點與3D模擬器規格.md", section: "模擬器 2", code: "S2" },
  title: { zh: "自由下落（範本）", en: "Free fall (template)" },
  summary: { zh: "一個球由靜止釋放，顯示速度與加速度箭嘴。", en: "A ball released from rest, with velocity and acceleration arrows." },
  dsePapers: [],
  pendingTerms: [],
  beyondSpec: [],
};
