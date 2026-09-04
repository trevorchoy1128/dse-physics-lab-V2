# DSE Physics Lab — 項目藍圖 Project Blueprint (v0.4)

> 參考文件：`reference/11_Book2_難點與3D模擬器規格.md`（必修 II 的物理規格，v1.0）。其他單元的規格文件到位後會同樣整合。

> 目標：一個免費、免安裝、可在學校電腦及手機瀏覽器直接開啟的 3D 物理實驗模擬器，
> 覆蓋 HKDSE 物理課程的全部建議實驗，並把最難憑想像理解的概念以 3D 動態呈現。
> 中文為主，可切換英文。
>
> Goal: a free, install-free 3D physics simulator that runs in any school computer or phone browser,
> covering every HKDSE Physics suggested experiment and visualising the hardest concepts in 3D.
> Chinese interface by default, with an English switch.

---

## 1. 定位與設計原則 Positioning & Principles

| 原則 Principle | 說明 |
|---|---|
| 課程對齊 Syllabus-aligned | 每個模擬標明 HKDSE 課程單元（必修 I–V、選修 I–IV）及對應的建議實驗 |
| 真實物理 Real physics | 用自寫數值積分（RK4 / 半隱式 Euler）計算，不用遊戲物理引擎「近似」，數據可用作實驗報告 |
| 實驗流程還原 Do the experiment | 學生要「做」實驗：擺設儀器、調校參數、讀數、繪圖、找斜率，而不只是看動畫 |
| 概念可視化 See the invisible | 把不可見量（場力線、向量、能量、相位、電子）畫出來，可隨時開關 |
| 中文為主、可切英文 Chinese first | 預設中文界面，右上角一鍵切換英文；不做中英並列顯示。術語以考評局課程指引為準（見第 3 節） |
| 零後端 No backend | 純靜態網站，GitHub Pages 免費託管；可安裝為 PWA 離線使用 |
| iPad 與電腦並重 iPad and desktop first | 主要使用裝置是 iPad（觸控）和學校電腦（滑鼠）。所有操作必須觸控可用：按鈕與滑桿最小 44 px、不依賴 hover、3D 場景用單指旋轉 / 雙指縮放、直向與橫向都可用；同時支援鍵盤與滑鼠。Safari 為首要測試瀏覽器。可加至 iPad 主畫面作全屏 App |
| 低門檻硬件 Runs on old machines | 目標在學校舊電腦及中階平板流暢運行（自動降低畫質） |

---

## 2. 技術選型 Tech Stack

| 層 Layer | 選擇 Choice | 原因 Why |
|---|---|---|
| 建構工具 | Vite + TypeScript | 快、簡單、靜態輸出 |
| UI 框架 | React 18 | 生態成熟，容易做面板、表格、圖表 |
| 3D 渲染 | three.js + @react-three/fiber + @react-three/drei | React 式寫 three.js，drei 提供相機控制、標籤、量度輔助 |
| 物理計算 | 自寫 `physics/` 純 TypeScript 模組（無 DOM 依賴） | 可單元測試、可離線驗證數值準確度 |
| 碰撞（少量場景） | Rapier (WASM) | 只用於小車碰撞、氣體分子等需要碰撞偵測的場景 |
| 圖表 | uPlot（實時）+ Recharts（靜態） | uPlot 每幀更新仍流暢 |
| 狀態管理 | Zustand | 輕量，模擬狀態與 UI 分離 |
| 樣式 | Tailwind CSS | 深淺色主題及響應式 |
| 多語言 | 自訂 `t()` + 術語表 | 字串少、結構簡單，不需要 i18next |
| 測試 | Vitest（物理模組）+ Playwright（關鍵頁面） | 物理公式必須有測試 |
| 部署 | GitHub Actions → GitHub Pages | 推送即部署 |

---

## 3. 語言設計 Language

中文為主，英文為可選切換。不做中英並列顯示（2026-09-05 決定）。

| 項目 | 做法 |
|---|---|
| 資料結構 | 所有可見文字以 `{ zh: "...", en: "..." }` 儲存，方便日後補齊英文，但界面一次只顯示一種語言 |
| 顯示模式 | **中**（預設）/ **EN**。選擇記在瀏覽器並編碼入分享連結 |
| 術語規則 | 依 `reference/08_中英術語對照表.md`：**絕對不自行翻譯物理名詞**。取用次序：① 牛津《活學物理》電子書詞彙欄（724 條）② 教育局《物理科常用詞彙》2020（2,268 條）③ 歷屆試卷中文版 ④ 以上皆無 → 停下問老師 |
| 術語表 Glossary | `i18n/glossary.ts` 由 `08_中英術語對照表.csv`（2,992 條）生成，記錄英文、中文、別稱、來源；任何模擬用到的術語都從這裡取。已知例子：diffraction = 衍射（別稱繞射）、path difference = 程差、wavefront = 波陣面、node = 波節、slit separation = 狹縫間距、slit width = 狹縫闊度、loudspeaker = 揚聲器、microphone = 微音器 |
| 兩道防線 | ① 程式內 `term("path difference")` 由英文查中譯，查不到即拋錯，建構失敗；② `termlint` 在 CI 掃描全部內容檔，揪出不在對照表的自創術語，每次發佈前必跑 |
| 課本印刷差異 | 課本正文與重點框用字不一致時（如 p.174 印「繞射」），照抄不改並加註兩者同義，依老師 2026-09-03 定案 |
| 術語彈出 | 界面上的術語可點擊，彈出定義、單位、符號、相關公式及英文對應名稱（方便應付英文卷） |
| 圖表與儀器 | 軸標籤、單位、儀表刻度、按鈕跟隨當前語言 |
| 長文內容 | 實驗步驟、理論、常見混淆、練習題先做中文版，英文版按需要補上 |
| 字體 | 中文 Noto Sans TC，數字及單位用等寬字體對齊 |

---

## 4. 網站結構 Site Structure

```
/                      首頁 Home：課程地圖（必修 I–V、選修 I–IV），每格顯示實驗數及概念數
/topic/:topicId        單元頁 Topic：該單元所有模擬的卡片（實驗 / 概念 兩類）
/sim/:simId            模擬頁 Simulation（核心頁面，見下）
/concepts              概念專區 Concepts：跨單元的難懂概念合集，可按「常見混淆」瀏覽
/skills                基礎技能 Skills：圖像分析、誤差、單位等跨單元技能
/glossary              術語表 Glossary：中英對照，可搜尋
/teacher               教師模式 Teacher：投影版大字體、預設情境、隱藏答案、匯出工作紙
/about                 說明、課程對照表、授權
```

### 模擬頁（/sim/:simId）的固定佈局

```
┌─────────────────────────────────────────────────────────────┐
│ 標題・課程編號・語言 中|EN・分享連結                              │
├────────────────────────────┬────────────────────────────────┤
│                            │  參數面板（滑桿 / 數值 / 開關）    │
│      3D 場景 (Canvas)       │  ─────────────────────────────  │
│   可旋轉 / 縮放 / 重置視角    │  實時圖表（x-t, v-t, I-V …）      │
│   圖層開關：向量 / 場力線 /     │  ─────────────────────────────  │
│   軌跡 / 能量條             │  數據表（記錄讀數、匯出 CSV）       │
├────────────────────────────┴────────────────────────────────┤
│ ▶ 播放  ⏸ 暫停  ⏭ 單步  🐢 慢速 0.1×–2×  ↺ 重置  ⏱ t = 0.000 s │
├─────────────────────────────────────────────────────────────┤
│ 分頁：實驗步驟 │ 理論 │ 常見混淆 │ 練習題（DSE 題型） │ 教師備註   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 模擬架構 Module Architecture

```
src/
├─ app/                 路由、版面、主題、語言模式
├─ shell/               SimShell：所有模擬共用的外殼（面板、控制列、圖表、數據表、分頁）
├─ physics/             純數學：積分器、向量、常數、單位換算（無 React / three 依賴）
│   ├─ integrators.ts   rk4(), semiImplicitEuler()
│   ├─ constants.ts     g, e, c, h, k_B …
│   └─ __tests__/
├─ sims/
│   ├─ registry.ts      所有模擬的清單（自動產生首頁及單元頁）
│   └─ <simId>/
│       ├─ manifest.ts  id、{zh,en} 標題、單元、類型（實驗/概念）、標籤、難度
│       ├─ model.ts     物理模型：state、step(dt)、可觀測量
│       ├─ Scene.tsx    three.js 場景（只負責畫 model 的 state）
│       ├─ controls.ts  參數定義（{zh,en} 名稱、單位、範圍、預設）→ 自動生成面板
│       ├─ charts.ts    要畫哪些圖（x 軸、y 軸、單位）
│       ├─ guide.zh.md  實驗步驟 / 理論 / 常見混淆
│       ├─ guide.en.md
│       └─ quiz.json    練習題（雙語）
├─ components/          3D 共用零件：尺、量角器、秒錶、安培計、伏特計、示波器、GM 計數器
└─ i18n/
    ├─ glossary.ts      考評局術語對照表（中英、符號、單位）
    └─ ui.ts            界面字串
```

**關鍵決定：** `model.ts` 不碰 three.js，`Scene.tsx` 不碰物理。物理可以單獨測試，日後也可換渲染方式。

**目錄的唯一來源：** `content/catalogue.json` 記錄全部模擬（單元、課本章節、類型、優先、中英名稱、內容）。`node tools/build-catalogue.mjs` 由它生成首頁資料、本文件第 6 節及藍圖網頁，三處不會不一致。正式項目的 `registry.ts` 亦由此生成。

---

## 6. 模擬清單 Simulation Catalogue

圖例：🧪 實驗 Experiment（課程建議實驗）　💡 概念 Concept（概念可視化）　⭐ 第一階段優先 Phase 1

<!-- CATALOGUE-START -->
### 必修 I　熱和氣體 Heat and Gases

課本章節：Bk1 Ch1 溫度和溫度計 · Bk1 Ch2 熱和內能 · Bk1 Ch3 熱容量和比熱容量 · Bk1 Ch4? 物態變化 · Bk1 Ch5? 氣體　（? = 推斷，待老師核對）

**實驗 Experiments**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 1 | Bk1 Ch3 | 比熱容量（電熱法） Specific heat capacity (electrical method) | 🧪⭐ | 金屬塊 / 水，發熱器、温度計、電錶讀數，T-t 圖，熱損失 |
| 2 | Bk1 Ch4? | 熔化潛熱 / 汽化潛熱 Specific latent heat of fusion / vaporisation | 🧪 | 冰塊加熱、沸水，質量-時間圖 |
| 3 | Bk1 Ch5? | 波義耳定律 Boyle's law | 🧪⭐ | 注射器加壓，p-V 及 p-1/V 圖 |
| 4 | Bk1 Ch5? | 氣壓定律 / 查理定律 Pressure law / Charles's law | 🧪 | 水浴加熱，p-T 圖外推至 −273 °C（絕對零度） |
| 5 | Bk1 Ch5? | 布朗運動（烟霧盒） Brownian movement (smoke cell) | 🧪 | 顯微鏡視角，烟粒被空氣分子撞擊 |

**概念 Concepts**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 6 | Bk1 Ch1 | 熱平衡與溫標 Thermal equilibrium and temperature scales | 💡 | 兩物體接觸至熱平衡；攝氏温標 / 開氏溫標對照 |
| 7 | Bk1 Ch2 | 温度、熱與內能 Temperature, heat and internal energy | 💡⭐ | 分子視角：温度 = 平均動能，內能 = 動能 + 勢能，熱 = 轉移中的能量 |
| 8 | Bk1 Ch2 | 傳導、對流、輻射 Conduction, convection, radiation | 💡 | 金屬棒温度分佈、對流、紅外輻射 |
| 9 | Bk1 Ch4? | 物態變化時温度為何不變 Why temperature stays constant during a change of state | 💡 | 能量去了分子勢能而非動能 |
| 10 | Bk1 Ch4? | 蒸發與沸騰 Evaporation vs boiling | 💡 | 高速分子逃逸、蒸發致冷；沸騰在整體內發生 |
| 11 | Bk1 Ch5? | 氣體分子運動論 Kinetic theory of gases | 💡⭐ | 3D 分子盒，改變 T、V、N，即時顯示壓強及速率分佈 |
| 12 | Bk1 Ch5? | 氣體壓強的分子解釋 Molecular origin of gas pressure | 💡 | 分子撞壁的動量變化 → 壓強，推導 pV = ⅓Nmc² |
| 13 | Bk1 Ch5? | 理想氣體方程 pV = nRT Ideal gas equation | 💡 | 三個氣體定律合一，任意固定一個變量 |
| 14 | Bk1 Ch5? | 分子速率分佈與温度 Molecular speed distribution and temperature | 💡 | 速率分佈曲線、方均根速率 |

### 必修 II　力和運動 Force and Motion

課本章節：Bk2 B1 位置和移動 · Bk2 B2 直線運動 · Bk2 B3 力和運動 · Bk2 B4 力的合成和分解 · Bk2 B5 力矩 · Bk2 B6 功、能量和功率 · Bk2 B7 動量 · Bk2 B8 拋體運動 · Bk2 B9 圓周運動 · Bk2 B10 引力

> 本單元的概念模擬以 `reference/11_Book2_難點與3D模擬器規格.md`（v1.0）為準：S1–S14 對應該文件的模擬器 1–14，P1–P3 為該文件的優先次序（P1 = 第一階段）。B1–B10 為該文件及牛津課本的章節編號。

**實驗 Experiments**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 15 | Bk2 B2 | 紙帶打點計時器 / 運動感應器 Ticker-tape timer / motion sensor | 🧪⭐ | 紙帶生成、剪帶貼圖、求加速度 |
| 16 | Bk2 B2 | 自由下落量 g Measuring g by free fall | 🧪⭐ | 光閘 / 電磁釋放，s-t² 圖 |
| 17 | Bk2 B3 | 牛頓運動第二定律（小車＋斜面） Newton's second law (trolley and runway) | 🧪⭐ | 補償摩擦作用、砝碼加力，a-F、a-1/m 圖 |
| 18 | Bk2 B5 | 力矩與平衡（米尺） Moments and equilibrium (metre rule) | 🧪 | 米尺平衡、重心，加減砝碼 |
| 19 | Bk2 B7 | 動量守恆（小車 / 氣墊導軌） Conservation of momentum | 🧪 | 彈性、非彈性、爆炸三種，動量及動能表 |
| 20 | Bk2 B9 | 圓周運動（旋轉膠塞） Circular motion (whirling bung) | 🧪⭐ | 向心力箭嘴、F-ω² 圖，切繩後沿切線飛出 |

**概念 Concepts**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 21 | Bk2 B1 | 位移、速度變化的矢量運算 Vector arithmetic: displacement and change in velocity | 💡 | S12 · 路徑編輯；距離 vs 位移、平均速率 vs 平均速度；Δv = v − u 三角形法；轉 90° 速率不變時 Δv = √2 v |
| 22 | Bk2 B1 | 相對速度與參考座標系 Relative velocity and frames of reference | 💡 | 火車上拋球，切換地面與車廂兩個觀察者的視角 |
| 23 | Bk2 B2 | 運動線圖與真實運動同步 Motion graphs synced with real motion | 💡 | S7 · 2D 即可。由運動生成圖，或在 v-t 圖上拖畫線段驅動小車；切線斜率、線下面積陰影；位移與距離分開讀數 |
| 24 | Bk2 B3 | 慣性與牛頓運動第一定律 Inertia and Newton's first law | 💡 | 無摩擦運動、桌布實驗 |
| 25 | Bk2 B3 | 摩擦的方向與極限摩擦 Direction of friction and limiting friction | 💡 | S13 · 驅動輪接觸點摩擦向前；靜摩擦隨外力增至極限後跌至動摩擦 |
| 26 | Bk2 B3 | 流體阻力與終端速度 Fluid resistance and terminal velocity | 💡 | S11 · 阻力 ∝ v 或 v²；初速可高於終端速度；a 由 g 減至零 |
| 27 | Bk2 B3 | 作用與反作用力對的辨識 Identifying action–reaction pairs | 💡⭐ | S5 · 每支力標「施力物 → 受力物」；點選高亮其反作用力；只看某物體受的力（孤立物體圖）；桌加速下降時重量與法向反作用力不再相等 |
| 28 | Bk2 B4 | 連接體系統 Connected bodies | 💡 | S10 · 滑輪連掛重、兩接觸方塊、升降機內磅秤；張力 vs mg；整體法與隔離法並列 |
| 29 | Bk2 B4 | 斜面受力與力的分解 Forces on an inclined plane and resolution | 💡⭐ | S6 · R = mg cos θ 與 mg 比較條；實際摩擦 vs 極限摩擦；tan θ = μ 剛好滑動；加水平外力時 R 改變；接觸力合成 |
| 30 | Bk2 B5 | 剛體平衡、重心與傾倒 Rigid-body equilibrium, centre of gravity and toppling | 💡⭐ | S4 · 米尺與支點、鉸接橫桿與牆、可傾斜的箱；作用線與垂直距離；力偶；重心在物體外；支撐面與重心投影，tan θ = b / 2h |
| 31 | Bk2 B6 | 能量轉換與機械能守恆 Energy conversion and conservation of mechanical energy | 💡 | S9 · 軌道編輯器；能量堆疊條（動能、重力勢能、內能）；不同斜度同高度落底速率相同；參考水平面可拖動；W = Fs cos θ |
| 32 | Bk2 B7 | 碰撞與動量守恆（含二維與衝擊力） Collisions and momentum (1D, 2D, impact force) | 💡 | S8 · 總動量與總動能分開顯示；完全彈性至完全非彈性連續調節；二維碰撞矢量圖；硬地板 vs 軟墊 F-t 圖面積相同 |
| 33 | Bk2 B8 | 拋體運動：水平與垂直的獨立性 Projectile motion: independence of components | 💡⭐ | S2 · 3D + 側視 + 俯視三窗同步；兩球同時落地；頻閃模式；最高點 vy = 0 但 vx 不變；g 可選 1.6 / 3.7 / 9.81 |
| 34 | Bk2 B9 | 圓周運動：向心力的來源 Circular motion: source of the centripetal force | 💡⭐ | S1 · 水平轉盤、錐擺、傾斜彎道（μ 可調至零）；受力圖只畫真實的力，合力另一層顯示；轉盤觀察者視角標明非慣性座標系；剪斷繩沿切線離開 |
| 35 | Bk2 B10 | 引力場強度與平方反比定律 Gravitational field strength and the inverse square law | 💡 | S14 · 距離由地心量起；r = 2R 時 g/4；月球、火星比較 |
| 36 | Bk2 B10 | 衞星軌道與表觀失重 Satellite orbits and apparent weightlessness | 💡⭐ | S3 · 常設引力箭嘴與場強讀數；艙內磅秤讀數為零而引力仍在；軌道面傾角非零時星下點成 8 字；T = 24 h 反推 r ≈ 4.2 × 10⁷ m |

### 必修 III　波動 Wave Motion

課本章節：Bk3A Ch1 光的反射 · Bk3A Ch2 光的折射 · Bk3A Ch3? 透鏡 · Bk3B Ch4 波的性質 · Bk3B Ch5 波的現象 · Bk3B Ch6 光的波動性 · Bk3B Ch7 聲音　（? = 推斷，待老師核對）

**實驗 Experiments**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 37 | Bk3A Ch2 | 折射與全內反射（玻璃磚） Refraction and total internal reflection (glass block) | 🧪⭐ | 光線追蹤、斯涅耳定律、臨界角 |
| 38 | Bk3A Ch3? | 透鏡成像與焦距 Lens image formation and focal length | 🧪⭐ | 凸透鏡 / 凹透鏡、物距像距、光線圖、主焦點 |
| 39 | Bk3B Ch5 | 水波槽 Ripple tank | 🧪⭐ | 反射、折射、衍射、雙源干涉，頻閃觀測器定格 |
| 40 | Bk3B Ch5 | 駐波（弦線 / 共鳴管） Stationary waves (Melde's experiment, resonance tube) | 🧪 | 邁爾德實驗、共鳴管量聲速 |
| 41 | Bk3B Ch6 | 楊氏雙縫實驗與衍射光柵 Young's double slit experiment and diffraction grating | 🧪 | 程差、條紋間距 y = λD/a、狹縫間距 |
| 42 | Bk3B Ch7 | 聲波干涉（兩個揚聲器） Sound interference (two loudspeakers) | 🧪 | 走動聽強弱（腹線、節線），頻率與距離關係 |

**概念 Concepts**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 43 | Bk3A Ch1 | 平面鏡成像 Plane mirror images | 💡 | 虛像、橫向倒置、最小鏡長 |
| 44 | Bk3A Ch2 | 折射率與視深 Refractive index and apparent depth | 💡 | 池底看似較淺、筷子折斷 |
| 45 | Bk3A Ch2 | 全內反射的應用 Applications of total internal reflection | 💡 | 光纖、稜鏡潛望鏡、海市蜃樓 |
| 46 | Bk3A Ch2 | 色散與電磁波譜 Dispersion and the electromagnetic spectrum | 💡 | 稜鏡色散；波長、頻率、能量對照 |
| 47 | Bk3A Ch3? | 實像與虛像、放大 Real and virtual images, magnification | 💡 | 光線可否在屏上會聚、放大鏡 |
| 48 | Bk3A Ch3? | 眼睛與照相機 Eye and camera as lens systems | 💡 | 視覺調節、近視遠視矯正（連結選修 E4） |
| 49 | Bk3B Ch4 | 橫波與縱波 Transverse and longitudinal waves | 💡⭐ | 粒子振動與波傳播分開顯示；波長、振幅、密部疏部、v = fλ |
| 50 | Bk3B Ch4 | 位移-距離圖 vs 位移-時間圖 Displacement–distance vs displacement–time graphs | 💡⭐ | 同一列波兩張圖並排，讀波長 vs 讀週期 |
| 51 | Bk3B Ch4 | 粒子運動方向 Direction of particle motion | 💡 | 給波形與傳播方向，判斷某點粒子此刻向上或向下 |
| 52 | Bk3B Ch4 | 相位與相位差 Phase and phase difference | 💡 | 同相、反相、相位差與程差 |
| 53 | Bk3B Ch5 | 波的折射 Refraction of waves | 💡 | 波速與波長改變、頻率不變 |
| 54 | Bk3B Ch5 | 衍射與狹縫闊度 Diffraction and slit width | 💡 | 狹縫闊度 vs 波長比例 |
| 55 | Bk3B Ch5 | 疊加與干涉 Superposition and interference | 💡⭐ | 兩波逐點相加、相長相消、程差 = nλ 或 (n+½)λ |
| 56 | Bk3B Ch5 | 駐波 vs 行波 Stationary vs travelling waves | 💡 | 波節、波腹、能量不傳播、相鄰波節間同相 |
| 57 | Bk3B Ch7 | 聲音：音調、響度、音品 Sound: pitch, loudness, timbre | 💡 | 波形與頻譜、超聲波、聽頻範圍、陰極射線示波器顯示 |
| 58 | Bk3B Ch7 | 共振 Resonance | 💡 | 驅動頻率掃描，振幅-頻率圖，固有頻率 |
| 59 | E1 Ch3 | 多普勒效應 Doppler effect | 💡 | 波源移動，波陣面壓縮（連結選修 E1） |

### 必修 IV　電和磁 Electricity and Magnetism

課本章節：Bk4 Ch1 靜電學 · Bk4 Ch2 電路 · Bk4 Ch3? 家居用電 · Bk4 Ch4? 磁場 · Bk4 Ch5? 電磁力 · Bk4 Ch6? 電磁感應 · Bk4 Ch7? 交流電 · Bk4 Ch8 變壓器與輸電　（? = 推斷，待老師核對）

**實驗 Experiments**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 60 | Bk4 Ch2 | 歐姆定律與 I-V 特性 Ohm's law and I-V characteristics | 🧪⭐ | 電阻器、燈泡、二極管，接駁安培計與伏特計 |
| 61 | Bk4 Ch2 | 電阻率 Resistivity | 🧪 | 改變導線長度、截面積，R-L 圖 |
| 62 | Bk4 Ch2 | 串聯、並聯與分壓器 Series, parallel circuits and potential divider | 🧪 | 拖放式接線板，電流「粒子」流動 |
| 63 | Bk4 Ch2 | 電動勢與內電阻 EMF and internal resistance | 🧪 | V-I 圖求 ε 與 r |
| 64 | Bk4 Ch4? | 電流的磁場 Magnetic field of currents | 🧪⭐ | 直導線 / 線圈 / 螺綫管，3D 場力線、指南針陣列、右手握拳定則 |
| 65 | Bk4 Ch5? | 載流導體受力與直流電動機 Force on a current-carrying conductor, d.c. motor | 🧪 | F = BIL，力箭嘴，轉子逐步旋轉 |
| 66 | Bk4 Ch6? | 電磁感應 Electromagnetic induction | 🧪⭐ | 磁鐵進出線圈，磁通量-時間、感應電動勢-時間圖 |

**概念 Concepts**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 67 | Bk4 Ch1 | 電荷與感應起電 Charge and charging by induction | 💡 | 摩擦起電、感應起電、接地、范德格拉夫起電機 |
| 68 | Bk4 Ch1 | 庫倫定律 Coulomb's law | 💡 | 力與距離平方反比 |
| 69 | Bk4 Ch1 | 電場力線與電場強度 Electric field lines and field strength | 💡⭐ | 拖放點電荷，3D 場力線、平行板均勻場 |
| 70 | Bk4 Ch1 | 電勢、電勢差與電勢能 Potential, p.d. and potential energy | 💡⭐ | 等勢面、「高度」地形圖比喻、電荷沿場移動的能量變化 |
| 71 | Bk4 Ch1 | 帶電粒子在電場中 Charged particle in an electric field | 💡⭐ | 陰極射綫偏轉管、陰極射線示波器 |
| 72 | Bk4 Ch2 | 電流的微觀圖像：漂移速度 Drift velocity, I = nAvq | 💡 | 導線內電子隨機運動加緩慢漂移 |
| 73 | Bk4 Ch2 | 歐姆導體與非歐姆導體 Ohmic and non-ohmic conductors | 💡 | 燈泡温度升電阻升、二極管單向導電 |
| 74 | Bk4 Ch2 | 電動勢 vs 端電壓 EMF vs terminal voltage | 💡 | 內電阻分壓，負載變化 |
| 75 | Bk4 Ch2 | 電功率與電能 Electrical power and energy | 💡 | P = IV = I²R = V²/R 在同一電路中如何用 |
| 76 | Bk4 Ch2 | 感應器電路（光敏電阻、熱敏電阻器） Sensor circuits (LDR, thermistor) | 💡 | 分壓器輸出隨光 / 温度變化 |
| 77 | Bk4 Ch3? | 家居用電 Domestic electricity | 💡 | 活線 / 中線 / 地線、保險絲、斷路器、千瓦小時 |
| 78 | Bk4 Ch4? | 磁場圖案 Magnetic field patterns | 💡 | 條形磁鐵、U 形磁鐵、地磁場 |
| 79 | Bk4 Ch5? | 弗林明左手定則 Fleming's left-hand rule | 💡⭐ | 3D 手勢，任意旋轉磁場與電流方向 |
| 80 | Bk4 Ch5? | 平行導線間的力 Force between parallel wires | 💡 | 同向相吸、反向相斥 |
| 81 | Bk4 Ch5? | 線圈所受的轉矩 Torque on a coil | 💡 | 力偶、轉動角度與轉矩變化 |
| 82 | Bk4 Ch5? | 帶電粒子在磁場中 Charged particle in a magnetic field | 💡⭐ | 圓周運動 r = mv/qB、速度選擇器 |
| 83 | Bk4 Ch5? | 霍耳效應 Hall effect | 💡 | 載流子偏向、霍耳電壓 |
| 84 | Bk4 Ch6? | 磁通量與楞次定律 Magnetic flux and Lenz's law | 💡⭐ | 磁通量變化率、感應電流方向、能量守恆 |
| 85 | Bk4 Ch7? | 交流發電機 a.c. generator | 💡 | 線圈轉角與電動勢波形同步 |
| 86 | Bk4 Ch7? | 交流與方均根值 a.c. and r.m.s. values | 💡 | 峰值 vs 方均根值、與直流等效發熱 |
| 87 | Bk4 Ch8 | 變壓器與渦電流 Transformer and eddy currents | 💡 | 匝數比、疊片鐵芯、渦流損耗 |
| 88 | Bk4 Ch8 | 高壓輸電 High-voltage power transmission | 💡 | 同功率下提高電壓減 I²R 功率損失 |

### 必修 V　放射現象和核能 Radioactivity and Nuclear Energy

課本章節：Bk5 Ch1 放射現象 · Bk5 Ch2 原子核與衰變 · Bk5 Ch3 核能

**實驗 Experiments**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 89 | Bk5 Ch1 | 蓋革計數器與本底輻射 Geiger counter and background radiation | 🧪⭐ | 隨機計數、計數率、扣除本底 |
| 90 | Bk5 Ch1 | 吸收與平方反比定律 Absorption and the inverse square law | 🧪 | 紙 / 鋁 / 鉛吸收，距離變化 |
| 91 | Bk5 Ch2 | 半衰期 Half-life | 🧪⭐ | 3D 原子核陣列隨機衰變，衰變曲線，取對數 |

**概念 Concepts**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 92 | Bk5 Ch1 | α、β、γ 性質比較 Properties of α, β, γ | 💡⭐ | 致電離能力、穿透能力、在電場 / 磁場中的偏轉 |
| 93 | Bk5 Ch1 | 雲室徑跡 Cloud chamber tracks | 💡 | 三種射線的徑跡 |
| 94 | Bk5 Ch1 | 輻射劑量 Radiation dose | 💡 | 吸收劑量、當量劑量（希沃特）、本底輻射來源 |
| 95 | Bk5 Ch2 | 原子結構與同位素 Atomic structure and isotopes | 💡 | 原子序數、核子數、同位素記法 |
| 96 | Bk5 Ch2 | 衰變的隨機性 Randomness of decay | 💡 | 放射強度、衰變常數、單個原子核何時衰變不可預測 |
| 97 | Bk5 Ch2 | 衰變方程與衰變系 Decay equations and decay series | 💡 | 核子數與電荷守恆，N-Z 圖 |
| 98 | Bk5 Ch2 | 碳 14 年代測定法 Carbon-14 dating | 💡 | 半衰期的應用 |
| 99 | Bk5 Ch3 | 質能等價與結合能 Mass–energy equivalence and binding energy | 💡⭐ | 質量虧損、每核子結合能曲線 |
| 100 | Bk5 Ch3 | 核裂變、連鎖反應與反應堆 Nuclear fission, chain reaction and reactor | 💡 | 中子、鈾核、減速劑、控制棒、臨界質量 |
| 101 | Bk5 Ch3 | 核聚變 Nuclear fusion | 💡 | 太陽內的核聚變及其條件 |

### 選修 I　天文學和航天科學 Astronomy and Space Science

課本章節：E1 Ch1 宇宙 · E1 Ch2 天體力學 · E1 Ch3 恆星與宇宙

**概念 Concepts**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 102 | E1 Ch1 | 天球與星空 Celestial sphere and the night sky | 💡 | 赤經赤緯、星空隨時間變化 |
| 103 | E1 Ch2 | 開普勒行星運動定律與太陽系 Kepler's laws of planetary motion and the Solar System | 💡 | 橢圓軌道、近日點遠日點、等面積、T² ∝ a³ |
| 104 | E1 Ch3 | 視差、赫羅圖與恆星演化 Parallax, H-R diagram and stellar evolution | 💡 | 視差量距離、光度與温度、演化路徑 |
| 105 | E1 Ch3 | 紅移與哈勃定律 Red shift and Hubble's law | 💡 | 譜線移動（多普勒頻移）、退行速度與距離 |

### 選修 II　原子世界 Atomic World

課本章節：E2 Ch1 光電效應 · E2 Ch2 原子結構 · E2 Ch3 納米科技

**實驗 Experiments**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 106 | E2 Ch1 | 光電效應 Photoelectric effect | 🧪⭐ | 臨閾頻率、遏止電勢、光子模型、功函數 |
| 107 | E2 Ch2 | 盧瑟福散射 Rutherford scattering | 🧪 | α 粒子射向金箔，散射角分佈 |

**概念 Concepts**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 108 | E2 Ch2 | 玻爾模型、能級與光譜 Bohr's model, energy levels and spectra | 💡 | 能級躍遷、發射光譜與吸收光譜 |
| 109 | E2 Ch2 | 電子衍射與物質波 Electron diffraction and matter waves | 💡 | 德布羅意波長、衍射環 |
| 110 | E2 Ch3 | 掃描隧穿顯微鏡與納米尺度 Scanning tunnelling microscope and the nanoscale | 💡 | 隧穿電流、原子表面成像 |

### 選修 III　能量和能源的使用 Energy and Use of Energy

課本章節：E3 Ch1 能源效益 · E3 Ch2 照明 · E3 Ch3 建築與交通 · E3 Ch4 可再生能源與核能

**實驗 Experiments**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 111 | E3 Ch4 | 太陽能電池與風力渦輪機 Solar cells and wind turbines | 🧪 | 光強與輸出、風速與功率 |

**概念 Concepts**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 112 | E3 Ch1 | 抽熱機與性能係數 Heat pumps and coefficient of performance | 💡 | 壓縮機、冷凝管道、COP 隨温差變化 |
| 113 | E3 Ch2 | 照明：光視效能與照明度 Lighting: luminous efficacy and illuminance | 💡 | 白熾燈 / 熒光燈 / LED 比較、平方反比定律、朗伯餘弦定律 |
| 114 | E3 Ch3 | 建築物傳熱與總熱傳送值 Building heat transfer and OTTV | 💡 | 導熱率、窗與牆的熱流、OTTV |

### 選修 IV　醫學物理學 Medical Physics

課本章節：E4 Ch1 眼睛 · E4 Ch2 耳與超聲波 · E4 Ch3 X 射線與放射醫學

**概念 Concepts**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 115 | E4 Ch1 | 眼睛與視力矯正 The eye and vision correction | 💡 | 近視、遠視、散光、屈光度 |
| 116 | E4 Ch2 | 超聲波 A-掃描 / B-掃描 Ultrasound A-scan / B-scan | 💡 | 脈衝回聲、聲阻抗、衰減、成像 |
| 117 | E4 Ch3 | X 射線衰減與電腦斷層造影 X-ray attenuation and computed tomography | 💡 | 半值厚度、多角度投影、反投影算法 |
| 118 | E4 Ch3 | 放射療法與劑量 Radiotherapy and dose | 💡 | 多方向照射、劑量分佈 |

### 跨單元　基礎技能 Cross-topic Skills

課本章節：— 跨單元

**概念 Concepts**

| # | 章節 | 模擬 Simulation | | 內容 |
|---|---|---|---|---|
| 119 | — | 線性化與求斜率 Linearising graphs and finding gradients | 💡 | 把 y = kx² 變直線、取最佳線、讀斜率截距 |
| 120 | — | 誤差、不確定度與有效數字 Errors, uncertainty and significant figures | 💡 | 隨機誤差 vs 規律性誤差、百分誤差、有效數字規則 |
| 121 | — | 國際單位制單位與量綱 SI units and dimensions | 💡 | 基本單位、導出單位、量綱分析檢查公式 |
| 122 | — | 數量級估算 Order-of-magnitude estimation | 💡 | 費米估算練習 |

**合共 122 個模擬：30 個實驗、92 個概念；34 個標為第一階段優先。** 目錄唯一來源：`content/catalogue.json`，以 `node tools/build-catalogue.mjs` 生成本節、首頁資料及藍圖網頁。
<!-- CATALOGUE-END -->

### 全站通用物理規範（採自 Book 2 規格 §0 及 §4，適用於所有單元）

| 項目 | 規範 |
|---|---|
| 術語 | 中文物理名詞不得自行翻譯。以牛津《活學物理》電子書詞彙欄及教育局《物理科常用詞彙》2020 為準；未列出的名詞須先查證。全部集中在 `i18n/glossary.ts` |
| 符號 | 跟隨考評局公式表：u、v、a、s、t、m、F、W、P、p、ω、r、T。拉丁及希臘字母符號一律斜體，單位正體 |
| 重力加速度 | 預設 g = 9.81 m s⁻²，可切換 9.8 或 10 配合課本題目 |
| 單位 | 一律指數式：m s⁻¹、m s⁻²、N kg⁻¹、rad s⁻¹、kg m s⁻¹，不用 m/s |
| 數值 | 所有讀數固定三位有效數字並附單位；角度以度顯示，內部用弧度 |
| 向量 vs 標量 | 向量以附箭頭的箭嘴表示，標量只顯示數值。速度箭嘴與力箭嘴的線型必須明顯不同 |
| 向量顏色 | 重量 紅 · 法向反作用力 藍 · 摩擦 橙 · 張力 紫 · 合力 黑（粗）· 速度 綠 · 加速度 綠（虛線） |
| 每個模擬必備 | ① 暫停與逐格 ② 每支向量可獨立開關（孤立物體圖訓練） ③ 所有相關物理量的即時數值面板 |
| 教學總原則 | 每個模擬都必須存在一組參數，令學生的錯誤預測與模擬結果明顯不同。設計時先寫下「學生會預測甚麼」，再確保該處有可見反差 |
| 試題對應 | 每個模擬的 manifest 記錄 DSE / HKCEE 對應題目編號，供練習題分頁及教師備註使用 |

**待老師定奪的術語**（Book 2 規格 §3，定奪前不採用任何譯法）：geostationary satellite（同步軌道 / 地球同步衛星）、normal reaction 的符號（R 或 N）、free-body diagram（孤立物體圖）、coefficient of restitution（建議不引入）、banked track（傾斜彎道）、trajectory（B8 建議用「路徑」）、terminal velocity（終端速度 / 終端速率）。

---

## 7. 每個模擬的共用功能 Shared Features (SimShell)

- **參數面板**：由 `controls.ts` 自動生成，支援滑桿、數值輸入、下拉、開關，附雙語名稱、單位及合理範圍
- **時間控制**：播放 / 暫停 / 單步 / 0.1×–2× 速度 / 重置；固定步長積分，與畫面幀率脫鈎
- **量度工具**：3D 尺、量角器、秒錶、探針（點擊物件讀數）
- **實時圖表**：可選 x 軸與 y 軸變量，自動擬合直線並顯示斜率及截距
- **數據表**：手動「記錄讀數」按鈕（模仿真實實驗），可匯出 CSV / 複製到 Excel
- **可視化圖層**：向量、場力線、軌跡、能量條、標籤，逐一開關
- **常見混淆**分頁：每個概念模擬列出學生最常錯的想法，並提供一個「試試看」情境去推翻它
- **分享連結**：所有參數及語言模式編碼入 URL，教師可預設情境發給學生
- **實驗誤差模式**：可開啟隨機讀數誤差及系統誤差，訓練誤差分析
- **內容分頁**：實驗步驟 / 理論 / 常見混淆 / DSE 題型練習 / 教師備註
- **無障礙**：鍵盤操作、高對比、可調字體

---

## 8. 開發階段 Phases

| 階段 | 內容 | 產出 |
|---|---|---|
| **0. 骨架**（第 1–2 週） | Vite + React + R3F 項目；SimShell；registry；雙語系統與術語表；部署流程；**1 個完整示範模擬（拋體運動）** | 可上線的網站，1 個模擬 |
| **1. 核心**（第 3–10 週） | 33 個 ⭐ 優先模擬；共用 3D 儀器零件庫 | 覆蓋全部 5 個必修單元的核心 |
| **2. 補完必修**（第 11–20 週） | 餘下必修模擬（至 106 個）；練習題；實驗誤差模式；概念專區 | 必修課程完整覆蓋 |
| **3. 選修與教師模式**（第 21–26 週） | 4 個選修單元、跨單元技能；教師投影模式；工作紙匯出；PWA 離線 | 全課程覆蓋 |
| **4. 打磨** | 效能（舊機 / 手機）、無障礙、使用者測試、內容校對 | 正式發佈 |

---

## 9. 品質與驗證 Quality

- 每個 `model.ts` 有 Vitest 測試：與解析解比較（拋體、RC、圓周）或與已知數據比較
- 物理常數與單位集中管理，界面一律 SI 單位並顯示
- 術語以考評局課程指引中英對照為準；內容由具 DSE 教學經驗者校對
- Playwright 冒煙測試：每個模擬能載入、播放、匯出 CSV，三種語言模式均無漏字

---

## 10. 待決定事項（已採用的預設）Defaults

| 事項 | 預設 | 備註 |
|---|---|---|
| 用戶登入 / 儲存進度 | **不需要**（純靜態） | 若日後需要，可加 Supabase |
| 託管 | GitHub Pages | 免費、自動部署 |
| 語言 | 中文預設，可切換 EN；不做中英並列 | 記在瀏覽器及分享連結 |
| 目標裝置 | **iPad 與電腦並重**，手機可用 | iPad 橫向：3D 場景左、面板右；iPad 直向及手機：3D 場景在上、面板在下可摺疊 |
| 授權 | MIT（程式）+ CC BY-NC（內容） | 方便學校及教師使用 |

---

## 11. 可信性 Workflow（2026-09-05 決定全部採用）

目標：由「我們內部相信它對」變成「外人可以查證它對」。

### 四道閘

| 閘 | 誰 | 通過條件 |
|---|---|---|
| 1 建造 | 主流程，`/new-sim` | 檢查表 A、A2、B、C、E 全部打勾；model / plan / dse / labdata 測試全綠；實機看過桌面與 iPad |
| 2 獨立驗收 | 四個 agent 並行 | 物理核數通過、第二實作一致、學生試用無卡住、儀器審核無必改（`reports/<simId>/`） |
| 3 老師簽收 | 老師 | 審核面板上簽收；簽收版本的截圖與逐幀輸出凍結為 `baselines/<simId>/` |
| 4 發佈守門 | CI 自動 | 測試、termlint、截圖與輸出對比基準；`pendingTerms` / `beyondSpec` / `pendingPapers` 為空才發佈 |

### 十項措施

1. **考題回歸測試**：每個模擬用規格列出的 DSE / HKCEE 題目做測試，輸出必須與評卷參考答案一致；模擬頁公開「與 N 題答案一致」。
2. **公開驗證紀錄**：每個模擬頁「驗證」分頁列出驗證條件與結果、考題清單、核數日期、儀器審核結論、簽收人與日期、版本號。
3. **真實實驗數據對照**：實驗類模擬與學校實測數據在實驗誤差內吻合。
4. **簽收凍結與自動守門**：CI 擋下任何令已簽收模擬輸出改變的提交；該模擬轉「待重審」。
5. **未定項目不上線**：pending 非空只可內部預覽。
6. **理想化假設明示**：畫面固定位置列出假設。
7. **學生實測回饋**：首批模擬先給一班學生用，「我不明白這個」按鈕記錄控制項。
8. **第二實作交叉比對**：每個模擬（不限 P1）由獨立 agent 只讀規格再實作一次，逐幀比對。
9. **問題回報與公開處理**：每頁「回報問題」自動帶版本；回報與處理公開。
10. **同行審閱**：每冊發佈前另一位物理老師抽查，紀錄在審核紀錄。

### 節奏
規格接收（主流程整合目錄，老師確認）→ 建造串行、驗收並行 → 每輪一頁審核面板交老師 → 簽收 → 發佈。

### 需要老師提供
《DSE_HKCEE_試題總索引》與評卷參考（措施 1）、幾組真實實驗數據（措施 3）、一班學生（措施 7）、一位抽查同事（措施 10）、GitHub repo（措施 4、9）。

---

## 12. 下一步 Next（2026-09-05 更新）

階段 0，在新 session 執行（自訂 agent 與 hook 要新 session 才載入）：

1. 建 Vite + React + TypeScript + three.js 骨架；共用層：`shell/types.ts`（見 skill 的 module-contract）、`VectorArrow` 連渲染層測試、`units.ts` 允許清單、`frame.test.ts` 座標系測試、左右手基準場景、`readout.test.ts`、`gControl`。
2. 移植首頁，修正 `reports/home/student-test.md` 的七點。
3. **第一個模擬：#023 運動線圖與真實運動同步（Book 2 規格模擬器 7，S7，2D）**，用 `/new-sim` 走完閘 1，再派四個驗收員走閘 2，交審核面板走閘 3。
4. 用 #023 跑 new-sim 的評測，修正 skill。
5. 設定 GitHub Actions 部署與閘 4 守門（需要 repo）。
