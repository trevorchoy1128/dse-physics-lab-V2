import type { SimManifest } from "@/shell/types";

// Book 2 規格 模擬器 2：拋體運動：水平與垂直的獨立性（B8.1 認識拋體運動、B8.2 分析拋體運動）
export const manifest: SimManifest = {
  id: "projectile-motion-independence-of-components",
  unit: "c2",
  chapter: "Bk2 B8",
  type: "c",
  phase: 1,
  needs3D: "high",
  spec: { doc: "reference/11_Book2_難點與3D模擬器規格.md", section: "模擬器 2", code: "S2" },
  title: { zh: "拋體運動：水平與垂直的獨立性", en: "Projectile motion: independence of components" },
  summary: {
    zh: "發射器射出一顆球，3D 立體視角、側視投影、俯視投影三個視窗同步播放：水平方向勻速運動，垂直方向自由下落，兩者互不影響。",
    en: "A launcher fires a ball; the 3D view, side projection and top projection play in sync: uniform motion horizontally, free fall vertically, each independent of the other.",
  },
  dsePapers: ["17(1A)Q9", "19(1A)Q13", "12(1A)Q12", "14(1A)Q10", "16(1A)Q10", "22(1A)Q13", "12(1B)Q5", "13(1A)Q13", "15(1B)Q3", "18(1B)Q4", "19(1A)Q6", "21(1B)Q3", "23(1A)Q13"],
  pendingPapers: [],   // 老師 2026-09-06 決定：DSE 試題無需處理（不做考題回歸）
  assumptions: [
    { zh: "球視為質點；預設忽略空氣阻力", en: "The ball is treated as a point; air resistance is ignored by default" },
    { zh: "地面水平，落地即停", en: "The ground is level; the ball stops on landing" },
  ],
  // 術語：老師 2026-09-06 確認沿用規格用語——飛行時間、最高點、頻閃照片、側視投影／俯視投影、發射高度、路徑（trajectory）
  pendingTerms: [],
  // 規格以外的內容已全部經老師 2026-09-06 定奪（見 reports/…/escalation.md 頂部與 guide 教師備註）：
  // 空氣阻力 F = −k v（k = 0.3 N s m⁻¹）、質量滑桿 0.1–5 kg、第二顆球（預設無）、g 合併 3.7 / 1.6、各角度射程比較圖層、頻閃照片模式、發射器取捨、落地後保留讀數、θ < 0 時 H = h、不做考題回歸
  beyondSpec: [],
  version: "0.3.1",   // 0.3.1（第 4 輪後）：有阻力時隱藏 ½mvₓ² 參考線；時間拉桿上限改用線性阻力閉式解的落地時刻；發射管半透明；指南第 1 步配合預設；0.3.0（老師 2026-09-06 決定）：空氣阻力改為 F = −k v（k = 0.3）、質量滑桿、預設無第二顆球、頻閃照片模式、考題回歸取消；0.2.3（老師看過後）：發射器重做為管式發射器，樞軸在發射點、管向前伸、器材全在地面上；0.2.2（第 3 輪後，未經覆核）：取景包圍盒加入標籤與比例尺、相機角度放低；量角器弧與刻度同一範圍；0.2.1：3D 自動取景（塔頂與路徑都在畫面內，視線不低於地面）、場景標籤同幀更新、x 標籤移到地面上方、自由下落時不畫高度影子列、量角器放大；0.2.0：全部落地後 runner 時鐘停住（done）；球的地面影子、牆上高度影子列；加速度與重量箭嘴長度分開；第二顆球水平距離讀數
};
