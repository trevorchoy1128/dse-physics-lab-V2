import type { SimManifest } from "@/shell/types";

// 規格：reference/13_024_慣性與牛頓運動第一定律_模擬器規格.md（v0.3，老師 2026-09-07 核准；建議編號 S15）
// 課本：牛津《活學物理》Book 2 §3.2 牛頓運動第一定律（實驗 3a 氣墊導軌、圖 3.2b–3.2g、STSE 安全帶與頭枕、練習 3.2）
export const manifest: SimManifest = {
  id: "inertia-and-newtons-first-law",
  unit: "c2",
  chapter: "Bk2 B3",
  type: "c",
  phase: 2,
  needs3D: "low",
  spec: { doc: "reference/13_024_慣性與牛頓運動第一定律_模擬器規格.md", section: "模擬器 #024", code: "S15" },
  title: { zh: "慣性與牛頓運動第一定律", en: "Inertia and Newton's first law" },
  summary: {
    zh: "方塊受一支可以隨時「放手」的水平力：放手一刻力箭嘴消失而速度不變。摩擦係數可拖到 0（氣墊導軌）。另有桌布實驗、巴士上的乘客、太空中的飛船三個情景。",
    en: "A block pushed by a force you can release at any moment: the force arrow vanishes but the velocity stays. Friction can be set to zero (air track). Also: tablecloth pull, a passenger on a bus, and a spacecraft.",
  },
  // 規格 §0：DSE 兩題、HKCEE 八題
  dsePapers: ["24(1B)Q3(b)", "20(1A)Q5", "CE84(II)Q1", "CE85(II)Q8", "CE98(II)Q6", "CE98(II)Q9", "CE99(II)Q42", "CE01(II)Q4", "CE02(II)Q4", "CE06(II)Q2"],
  // 尚無評卷參考（content/papers/ 未有）：24(1B)Q3(a) 的速率 1.5 m s⁻¹ 已按規格方程作解析解測試，但不當作評卷參考；其餘為概念題或無評卷參考
  pendingPapers: ["24(1B)Q3(b)", "20(1A)Q5", "CE84(II)Q1", "CE85(II)Q8", "CE98(II)Q6", "CE98(II)Q9", "CE99(II)Q42", "CE01(II)Q4", "CE02(II)Q4", "CE06(II)Q2"],
  assumptions: [
    { zh: "方塊、物件、乘客視為質點，不模擬傾倒", en: "Block, object and passenger are treated as points; toppling is not modelled" },
    { zh: "靜摩擦上限等於動摩擦（μs = μk = μ）", en: "Limiting static friction equals kinetic friction (μs = μk = μ)" },
    { zh: "桌布以恆定速率抽出；車廂視為無限長，不模擬撞牆", en: "The cloth is pulled at constant speed; the bus interior is taken as unbounded" },
    { zh: "向右為正方向", en: "Rightward is taken as positive" },
  ],
  // 術語表未收錄，規格 §11 第 8 項列出，待老師定奪
  pendingTerms: [
    "glider（氣墊導軌上的滑行物，牛津英文版 §3.2；中文版用語待核）",
    "seat belt / headrest（安全帶／頭枕，STSE 用語，非物理術語）",
    "Galileo's law of inertia（伽利略慣性定律，課本 §3.2）",
    "impetus theory（衝力理論，只在教師備註出現）",
  ],
  // 規格沒有明寫、由開發端定的常數，待老師定奪
  beyondSpec: [
    "前段光滑桌面長度固定 0.75 m（取 2024 卷一乙部 Q3 的 A 至 B 距離）",
    "乘客質量固定 60 kg（規格 §7 的 m，參數表未列）",
    "桌布物件質量固定 1.0 kg（老師 2026-09-07 決定不設滑桿；模型內仍可變，供驗證條件 11 測試）",
    "太空情景「三艘飛船」的初速固定為 0、+2、−2 m s⁻¹；「可轉向」以向前／向後兩段實現",
    "燃料消耗率以 0.05 × F引擎 kg s⁻¹ 示意（規格只要求關引擎時為零）",
    "情景 1 與 4 的時間窗 12 s；情景 2、3 的時間窗由參數算出",
  ],
  version: "0.2.4",   // 0.2.4（閘 2 第 5 輪後）：Scene 雙方塊標牌固定在泳道左端、軸標題底框、衝量條加高並在條內寫數值；guide 步驟 4 先設後段摩擦 0（儀器審核員、學生試用者）；0.2.3（閘 2 第 4 輪後）：plan meta 補方塊質量供標牌；Scene 淨力標籤避讓同向摩擦、速度箭嘴避讓 R 標籤、方塊 A/B 標牌、衝量條加闊（儀器審核員、學生試用者）；0.2.2（閘 2 第 3 輪後）：衝量條滿格改為臨界速度的衝量 m√(2μgL)，不隨 v布 變（核數員 H）；Scene 標籤底框與位置規則（儀器審核員）；0.2.1（閘 2 第 2 輪後）：plan 速度／加速度箭嘴用歸零值、meta 補 μ桌 μ布（核數員 E、儀器審核員）；Scene 鏡頭跟乘客、車廂貫穿畫面、標籤重排；0.2.0（閘 2 第 1 輪後）：桌布追上布速時 Δt 凍結於追上時刻（核數員 B）、sliding 旗標含滑動開始一瞬（第二實作者）（model）；車廂畫長 16 m 並兩端截斷、水平／垂直力各一個像素比例上界（plan）；推手、桌腳、樽頸、粗糙紋跟 μ、標籤分層、鏡頭跟乘客與巴士中點（Scene）
};
