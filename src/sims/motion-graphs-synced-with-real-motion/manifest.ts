import type { SimManifest } from "@/shell/types";

// Book 2 規格 模擬器 7：運動線圖與真實運動同步（B2.1 描述直線運動、B2.2 運動線圖、B2.3 勻加速運動方程、B1.3）
export const manifest: SimManifest = {
  id: "motion-graphs-synced-with-real-motion",
  unit: "c2",
  chapter: "Bk2 B2",
  type: "c",
  phase: 2,
  needs3D: "low",
  spec: { doc: "reference/11_Book2_難點與3D模擬器規格.md", section: "模擬器 7", code: "S7" },
  title: { zh: "運動線圖與真實運動同步", en: "Motion graphs synced with real motion" },
  summary: {
    zh: "小車沿直線軌道運動，s–t、v–t、a–t 三個線圖即時繪出；也可以在 v–t 圖上拖畫線段，讓小車按圖運動。",
    en: "A trolley moves along a straight track while its s–t, v–t and a–t graphs are drawn live; or drag the v–t graph and let the trolley follow it.",
  },
  dsePapers: ["14(1B)Q3", "15(1A)Q9", "15(1B)Q4(a)", "18(1A)Q7", "18(1A)Q10", "18(1A)Q11", "21(1A)Q7", "23(1B)Q3(c)(i)"],
  pendingPapers: ["14(1B)Q3", "15(1A)Q9", "15(1B)Q4(a)", "18(1A)Q7", "18(1A)Q10", "18(1A)Q11", "21(1A)Q7", "23(1B)Q3(c)(i)"],
  assumptions: [
    { zh: "小車視為質點，沿直線軌道運動", en: "The trolley is treated as a point moving along a straight track" },
    { zh: "向右為正方向", en: "Rightward is taken as positive" },
  ],
  pendingTerms: [
    "displacement–time graph（規格用「s–t 圖」，沿用）",
    "velocity–time graph（規格用「v–t 圖」，沿用）",
    "acceleration–time graph（規格用「a–t 圖」，沿用）",
    "area under graph（規格用「線下面積」，沿用）",
    "tangent（規格用「切線」，沿用）",
  ],
  beyondSpec: [
    "規格無參數表：初速 u 範圍 −5 至 5 m s⁻¹、加速度 a 範圍 −10 至 10 m s⁻²、時間窗 T 2 至 60 s（滑桿，步進 1 s，老師 2026-09-06 要求可自訂），由開發端定，待老師定奪",
    "「由圖生成運動」以每秒一個可拖動的控制點畫 v–t 折線（共 T + 1 點），而非自由手繪，待老師定奪",
  ],
  version: "0.5.1",   // 0.5.1：畫圖模式 s 軸範圍改為逐段精確極值並計入控制點以外的保持段（核數員第 7 輪 F9）；0.5.0：時間窗改為 2–60 s 滑桿（控制範圍改動），畫圖模式控制點按密度縮小、秒數標籤按間距疏化；0.4.2：軌道改為固定比例＋鏡頭跟車（背景流動、距離柱），線圖 t 軸刻度移到 y = 0 軸線上，線圖軸範圍由參數預測一次定好、不隨時間變（老師要求）；0.4.1：meta 用歸零值、拖動改為按時間就近、還原預設不改播放狀態； 0.4.0：折線末節點 a 不再 NaN、凍結 t 截斷為 T、畫面用歸零後的 s；0.2.0：時間窗末端 a 不再歸零（第 1 輪 F1）；0.3.0：observe 把 < 1 nm 的位移殘餘歸零（第 3 輪 F6）
};
