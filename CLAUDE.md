# DSE Physics Lab — 項目規則

HKDSE 物理 3D 實驗模擬器網站。中文為主（繁體、香港用語），可切換英文。對話用繁體中文回覆。

**項目位置：`C:\Users\trevor\dev\dse-physics-lab`（git repo，在 OneDrive 之外，避免 node_modules 同步與鎖檔）。** `reference/` 是連結，指向 OneDrive `DSE Physics Lab\reference`，老師在 OneDrive 放文件即可；其中 `E-book/` 與 PDF 不入 git。OneDrive 內其他檔案已遷入此 repo，以 repo 為準。

## 程式結構（階段 0 第 1 步已建）
- `src/shell/` — 共用外殼：`types.ts` 契約、`format.ts` 三位有效數字、`units.ts` 允許單位、`frame.ts` 座標約定（x 右 y 上 z 向觀眾）、`runner.ts` 固定步長、`controls.ts` gControl、`readouts.ts`、`SimShell.tsx`、`Guide.tsx`、`fixtures/handedness/` 左右手基準
- `src/components/` — `VectorArrow`（顏色線型由 kind 決定，`arrowMath.ts` 有渲染層測試）、`Label`、`Trail`、`PlanScene`、`Canvas2D`
- `src/physics/` — `rk4`、`semiImplicitEuler`、`vec`、考評局常數
- `src/i18n/` — `lang.ts` 中/EN、`glossary.gen.ts`（由 CSV 生成，`npm run build:glossary`）、`term()` 查不到即拋錯、`ui.ts`
- `src/sims/<id>/` — 一個模擬；`registry.ts` 登記；`example-fall` 是共用層範本
- `src/games/` — 遊戲（首頁「遊戲」部分、`#/games`、`#/game/<id>`）：`registry.ts` 登記；每個遊戲一個資料夾，邏輯（`game.ts`）與畫面（`*.tsx`）分開，關卡必須有窮舉測試證明有解。第一個是 `projectile-siege` 拋體攻城，物理與 #033 一致
- 指令：`npm run dev`（5173）、`npm test`、`npm run termlint`、`npm run build:catalogue`、`npm run export -- <simId>`
- 瀏覽器面板：`.claude/launch.json` 的 `dev`

## 文件地圖
- `BLUEPRINT.md` — 藍圖（定位、技術、語言、架構、模擬清單、通用物理規範、階段）。先讀這份。
- `content/catalogue.json` — 全部模擬的唯一來源。改動後跑 `node tools/build-catalogue.mjs`，首頁資料、藍圖 §6、藍圖網頁同步更新。不要手改生成的區段。
- `reference/` — 老師提供的權威文件：
  - `08_中英術語對照表.md` + `.csv` — 術語規則與 2,992 條對照（牛津《活學物理》詞彙欄 → 教育局 2020 → 歷屆試卷）
  - `11_Book2_難點與3D模擬器規格.md` — 必修 II 物理規格（14 個模擬器）。其他冊的規格會陸續加入，檔名同款
  - `PhyGlossary_2020.pdf` — 教育局詞彙原件（pdftotext 抽不到中文欄，用 CSV）
- `content/misconceptions-template.md` — 老師整理易錯概念的格式
- `site/index.html` — 首頁原型（單檔 HTML，之後移植到正式項目）
- `tools/` — Node 工具：`term.mjs` 查術語、`termlint.mjs` 掃自創術語、`build-catalogue.mjs` 生成目錄
- `.claude/skills/new-sim/` — 建立一個模擬的標準流程

## 術語（最重要的規則）
- 中文物理名詞**不得自行翻譯**。查 `node tools/term.mjs "<english>"`；查不到就停下，列入「待老師定奪」，不要猜。
- 用 CSV「採用」欄的寫法，不用別稱（例：衍射不是繞射、程差不是路程差、波陣面不是波前、波節不是節點、活線不是火線、抽熱機不是熱泵）。課本原文印別稱時照抄並加註。
- 寫入內容檔後 hook 會自動跑 termlint；報錯就修正，不要繞過。全量檢查：`node tools/termlint.mjs`。
- 尚待老師定奪：geostationary satellite、normal reaction 的符號（R / N）、rubber bung、LDR、U-value、coefficient of restitution（建議不引入）、banked track（暫用傾斜彎道）、trajectory（B8 用「路徑」）。

## 物理與呈現規範（全站，來自 Book 2 規格 §0、§4）
- 符號跟考評局公式表：u、v、a、s、t、m、F、W、P、p、ω、r、T。符號斜體，單位正體。
- g 預設 9.81 m s⁻²，可切換 9.8 / 10。
- 單位一律指數式：m s⁻¹、N kg⁻¹、rad s⁻¹、kg m s⁻¹。不用 m/s。
- 讀數三位有效數字並附單位；角度顯示用度，內部用弧度。
- 向量用箭嘴，標量只顯示數值；速度箭嘴與力箭嘴線型必須明顯不同。
- 向量顏色：重量 紅 · 法向反作用力 藍 · 摩擦 橙 · 張力 紫 · 合力 黑（粗） · 速度 綠 · 加速度 綠（虛線）。
- 每個模擬必備：① 暫停與逐格 ② 每支向量可獨立開關 ③ 即時數值面板。
- 反差原則：每個模擬都要有一組參數令學生的錯誤預測與模擬結果明顯不同。先寫下「學生會預測甚麼」。
- 規格沒寫的物理內容不要靜靜加入；要加就標「規格以外，待老師定奪」。
- **摩擦不用摩擦係數 μ 作控制項**（老師 2026-09-11：DSE 沒有教 μ）。學生直接控制摩擦力 f（單位 N）；模型內 μ 只可作內部換算，不可出現在滑桿、讀數或圖例。已建的模擬（#024 情景 1）要改。

## 畫面呈現（全站規則，老師 2026-09-06 定，每個模擬都要遵守，不用每次重講）
- **要 colorful，吸引學生**：天空／地面／路面等場景有顏色，各單元用自己的主色（src/app/units.tsx 的 UNIT_COLORS，CSS 變數 --unit），線圖各有色系與標題色條，按鈕與「試試看」用單元色。物體避開向量顏色編碼的紅、藍、橙、紫、綠。向量顏色本身不可改。
- **軸或比例不隨時間改變**：線圖軸範圍、軌道米／像素，在重置時由參數預測的上界一次定好，播放期間不放大、不縮小。學生見到條線或物件突然跳，會以為程式壞或物理錯。只有學生自己的操作（拖滑桿、改參數）才可以令軸或比例改變，程式自動改的一律不准。
- **物體離開畫面用鏡頭跟隨，不是縮比例**：比例一縮，物體看似「瞬移」。鏡頭跟物件移動，背景放在世界座標（距離柱附數字、樹、路面虛線、視差雲），令學生看到「物件在動、走了多遠、向哪邊」。
- **線圖的 t 軸放在 y = 0 的軸線上**，不放圖框底部；負值在軸線以下，與課本一致。刻度數字去尾零（10 而非 10.0）。
- **同一個設計語言**：顏色、字體、刻度、箭嘴、圖框只可從 src/components/design.ts 取用，文件在 .claude/skills/new-sim/references/design-language.md；tools/designlint.mjs 會擋下 Scene / Views 內自定義的顏色與字體。
- 逐項對照表在 .claude/skills/new-sim/references/checklist.md 第 F、G 節；閘 1 未過 F 節不派驗收員。

## 裝置與可用性
- iPad 與電腦並重：觸控目標最少 44 px、不依賴 hover、3D 單指旋轉 / 雙指縮放、直向橫向皆可用、Safari 優先測試。
- 學生在沒有講解下也要懂得用：每個模擬打開即有合理預設情境在動；控制項有中文標籤和單位；第一次進入有三步提示。
- 純靜態網站，無後端、無登入。

## 技術
- TypeScript 全棧：Vite + React + three.js（@react-three/fiber + drei）、Zustand、Tailwind、Vitest、Playwright。
- `model.ts` 不碰 three.js，`Scene.tsx` 不碰物理。物理模型必須有對照解析解或規格驗證條件的測試，測試未過不畫場景。
- 工具鏈只用 Node（本機 `python` 是 Windows Store 空殼，不可用）。
- 儀器與物件用程式幾何生成，不用外部模型檔。

## 可信性（對外可查證，老師 2026-09-05 決定全部採用，不計 token 成本）
- 四道閘：閘 1 建造（skill 檢查表）→ 閘 2 獨立驗收（physics-auditor、second-implementer、student-tester、apparatus-reviewer 四個 agent 並行，報告在 `reports/<simId>/`）→ 閘 3 老師簽收並凍結基準 `baselines/<simId>/` → 閘 4 CI 守門（測試、termlint、截圖與輸出比對基準；`pendingTerms` / `beyondSpec` / `pendingPapers` 非空者不發佈）。
- 每個模擬有考題回歸測試（`dse.test.ts`，與評卷參考答案一致）；實驗類有真實數據對照（`labdata.test.ts`）。
- 模擬頁有「驗證」分頁公開驗證條件、考題清單、核數與簽收紀錄、版本號；畫面固定位置列明理想化假設。
- model.ts / plan.ts 任何改動：版本遞增，該模擬自動轉「待重審」，重新走閘 2–3。
- 每頁有「回報問題」，自動帶上版本；回報與處理公開。
- 每冊發佈前請另一位物理老師抽查，紀錄在審核紀錄。
- 閘 2 循環規則在 `.claude/skills/new-sim/references/loop.md`：改甚麼重派誰、三輪封頂、矛盾裁決、升級報告。主流程在場由主流程修正；無人值守用 `sim-fixer` agent。
- 無人值守批量驗收：`.claude/workflows/verify-loop.js`（args: simIds、maxRounds、tasks、apparatus）。工具規定要用戶明確說「用 workflow」才可啟動。
- 自訂 agent（`.claude/agents/`：physics-auditor、second-implementer、student-tester、apparatus-reviewer、sim-fixer）與 hook 在 session 開始時載入；新增或修改後要開新 session。

## 工作方式
- **Session 命名**（老師 2026-09-07 喜歡這做法）：每個 session 開始做某個模擬時，立即用 set_session_title 把自己改名為「#編號 名稱 · 階段」，例如「#031 拋體 · 閘 2」；階段改變（閘 2 → 閘 3 簽收）時再改。一個 session 一個模擬，簽收後歸檔；狀態以 repo（catalogue.json、reports/）為準，不靠 session。
- 新模擬一律用 `/new-sim`。
- 改動 `content/catalogue.json` 後必跑 `node tools/build-catalogue.mjs`。
- 完成一個模擬前必在瀏覽器面板實機看過桌面與 iPad 兩種尺寸，並讀 console 有無錯誤。
