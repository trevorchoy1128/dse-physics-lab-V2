import type { Text } from "@/shell/types";

// 界面字串。物理名詞一律經 term()；這裏只放非術語的界面用語。
export const UI = {
  play: { zh: "播放", en: "Play" },
  pause: { zh: "暫停", en: "Pause" },
  step: { zh: "逐格", en: "Step" },
  reset: { zh: "重置", en: "Reset" },
  speed: { zh: "速度", en: "Speed" },
  params: { zh: "參數", en: "Parameters" },
  readouts: { zh: "讀數", en: "Readouts" },
  layers: { zh: "顯示", en: "Show" },
  tryIt: { zh: "試試看", en: "Try it" },
  tabs: {
    steps: { zh: "步驟", en: "Steps" },
    theory: { zh: "理論", en: "Theory" },
    misconceptions: { zh: "常見混淆", en: "Common misconceptions" },
    watch: { zh: "觀察重點", en: "What to watch" },
    teacher: { zh: "教師備註", en: "Teacher notes" },
    verify: { zh: "驗證", en: "Verification" },
  },
  assumptions: { zh: "假設", en: "Assumptions" },
  backHome: { zh: "返回課程地圖", en: "Back to course map" },
  home: { zh: "課程地圖", en: "Course map" },
  search: { zh: "搜尋模擬…", en: "Search simulations…" },
  experiment: { zh: "實驗", en: "Experiment" },
  concept: { zh: "概念", en: "Concept" },
  comingSoon: { zh: "即將推出", en: "Coming soon" },
  preview: { zh: "內部預覽", en: "Internal preview" },
  time: { zh: "時間", en: "Time" },
} satisfies Record<string, Text | Record<string, Text>>;
