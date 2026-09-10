# 全站設計語言（老師 2026-09-06：所有模擬要同一個 design language）

每個模擬都由同一套零件砌成。程式碼在 `src/components/design.ts`；`tools/designlint.mjs` 在每次寫入 `src/sims/**/*.tsx` 時自動檢查，違反即擋。這份文件說明「為甚麼是這樣」，令新模擬不用再猜。

## 1. 版面（SimShell 固定，模擬不可改）
- 標題列（單元色底線）→ 播放列（播放／逐格／重播／還原預設／速度／跳到 t）→ 三步提示 → **舞台** → 讀數與控制欄（桌面在右，iPad 直向在下）→ 指南分頁（步驟／理論／常見混淆／觀察重點／教師備註）。
- 舞台由模擬提供：3D 用 `PlanScene` + `VectorArrow`，2D 用 `Canvas2D`。3D 模擬如需平面視窗（側視、俯視、能量圖），用 `SimModule.Views`，畫在主場景下方，三欄等寬。
- 桌面用盡橫向空間（`.wrap` 最闊 1800 px）；iPad 直向 768 px 時舞台全闊、面板下移；觸控目標最少 44 px。

## 2. 顏色
- **主題色**只從 `theme()` 讀：`ink`（正文）、`ink2`、`ink3`（次要文字、軸）、`line`（格線）、`accent`（主題青綠）、`paper`、`unit`（該單元的主色，來自 `UNIT_COLORS`，用於標題列、主按鈕、試試看邊條）。深色模式自動跟隨。
- **向量顏色編碼**（`ARROW_STYLE`，全站不可改）：重量紅、法向反作用力藍、摩擦橙、張力紫、合力黑粗、速度綠（開口箭頭）、加速度綠虛線（開口箭頭）、場青。
- **場景調色板** `SCENE`：天空 `skyTop → skyBottom` 漸層、雲、草地 `ground`、路面 `road` + 黃虛線 `roadDash`、樹 `trunk / leaf`、距離柱 `post`、起點旗 `flag`。**物體**：主物體琥珀 `objectA`（小車、球 A），第二物體鋼藍 `objectB`（球 B、對照物）；兩者都避開向量顏色編碼。對照／殘影用 `ghost`、`muted`。
- **線圖色系** `SERIES`：s 主題色、v 速度綠（與速度箭嘴同色）、a 青藍、動能橙、勢能鋼藍、總能量墨色；每張圖用自己的 `tint` 做底色、`color` 做頂部色條與標題。線下面積用 `AREA_FILL.positive / negative`。
- 不可在 Scene / Views 內寫十六進位或 rgba 顏色。確有例外（例如一次性的示意色）在該行加註 `// design-ok` 並在 PR 說明。

## 3. 字體
- 畫布內文字：`uiFont(size)`（Noto Sans TC，最少 12 px）、`monoFont(size)`（IBM Plex Mono，最少 11 px，用於數字與刻度）、`symbolFont(size)`（斜體，用於物理符號 s、v、a）。粗體用第二個參數 `"700"`。
- 不可寫 `system-ui`、`sans-serif` 等字串；iPad 上字體不縮小。
- 符號斜體、單位正體、指數式單位（m s⁻¹），讀數三位有效數字（`sig`），畫布內去尾零用 `trim3` 或 `tick`。

## 4. 線圖（2D 圖框）
- 一律用 `drawPane(ctx, pane, style, theme)`：淡底色、頂部 3 px 色條、左上標題、右上 y 單位、y 軸五條格線與數字、**t 軸刻度與數字放在 y = 0 的軸線上**（負值在軸線下，與課本一致），「t / s」在軸線另一側。
- 座標映射只用 `px / py / fromPy`（左 44 px、右 12 px、上 22 px、下 22 px 邊距），拖動控制點時用 `fromPy` 反算。y 方向另有 12% 留白（`Pane.padY`）：格線仍在 yMax / yMin，曲線到頂時不會緊貼圖框（老師 2026-09-11）。
- 軸範圍在重置時由參數預測一次定好，播放期間不變；只有學生自己的操作可以放大，永不縮小。刻度用 `nice`（1–2–5）。
- 有可拖控制點的圖：刻度落在控制點的時間上（`xTicks`），拖動中顯示 `t = … s，v = …`。

## 5. 場景（軌道、背景、鏡頭）
- 比例固定（米／像素在重置時定好）。物體離開畫面用鏡頭跟隨（中央 40% 死區），背景在世界座標：距離柱附數字（`SCENE.post` + `monoFont(12)`）、樹、路面虛線、視差雲。鏡頭偏離起點時右上角以 `uiFont(12, "700")` 說明「鏡頭跟着小車移動（比例不變）」。
- 物體標籤格式 `s = 1.23 m`（`monoFont(12)`，符號斜體由讀數面板負責）。
- 2D 箭嘴一律 `drawArrow2D(ctx, x0, y0, x1, y1, kind, label)`：顏色線型跟 `ARROW_STYLE`，同一 kind 全場景一個比例；靠近邊緣時同步縮短並在左上以 `uiFont(11)` 提示。
- 3D 場景：儀器用程式幾何（不用貼圖），地面淡灰，燈光一組；相機預設由 `SimModule.camera` 給，單指旋轉、雙指縮放。

## 6. 文字與引導
- 中文優先，`useLang` 切換英文；術語只用 `reference/08_中英術語對照表.csv`。
- 每個模擬三步提示（`SimModule.hints`）、讀數的一句解釋（`ReadoutDef.hint`）、四個「試試看」對應迷思。

## 7. 檢查
- 閘 1：`node tools/designlint.mjs`（自動）+ checklist G 節。
- 閘 2：物理核數員以截圖對照本文件第 2、4、5 節；學生試用者不看文件，只看得不得懂。
