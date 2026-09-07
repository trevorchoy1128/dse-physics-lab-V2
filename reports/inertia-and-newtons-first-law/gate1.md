# 閘 1 自檢：inertia-and-newtons-first-law（#024，S15）

日期：2026-09-07　版本：manifest 0.1.0　規格：reference/13_024_慣性與牛頓運動第一定律_模擬器規格.md v0.3（老師核准）

## A. 物理正確
- [x] 規格 §10 驗證條件 1–17 各有同名測試：1、2、5–13、15 在 model.test.ts；3、4、14、16、17 在 plan.test.ts。24 條測試全綠（`npx vitest run src/sims/inertia-and-newtons-first-law`）。
- [x] 解析解比較：桌布精確解（Δv、抽出時刻、臨界 1.08 m s⁻¹）、粗糙面 a = −μg 與 d = v²/2μg、2024 Q3(a) v_B = 1.5 m s⁻¹、勻速 F = μmg，相對誤差 ≤ 1e-9。
- [x] 守恆量：無摩擦動能守恆 ≤ 1e-9；有摩擦 ΔEk = 摩擦功（≤ 1e-6）；J = fΔt = mΔv（≤ 1e-9）。
- [x] 方程、參數範圍、預設值照規格 §5、§7；老師決定（桌布無質量滑桿、乘客滑動物體、只有地面視角、μs = μk）已落實。
- [x] g 用共用 gControl。
- [x] model.ts 只用純 TS（閉式分段積分，事件精確分段）；Scene.tsx 只畫 plan。

## A2. 畫面正確
- [x] 箭嘴 = 模型量；淨力 = 各力之和；法向反作用力垂直向上、重量向下、摩擦沿面反相對運動趨勢；同一 kind 一個縮放係數（全部 1）；標籤 = observe；單位在允許清單；箭嘴只在 x、y；隨機 50 組參數無 NaN。
- [x] 沒有虛擬力（plan.test「沒有虛擬力」）。

## B. 學生不用講解也懂得用
- [x] 打開即播放 2024 Q3 情景；三步提示指向「已放手」按鈕；`liveParams` 令放手即時生效。
- [x] 每個滑桿有中文標籤、符號、單位；控制項按情景顯示。
- [x] 11 條迷思各有「試試看」；截圖 scenario-1…11 已看過。
- [x] 暫停、逐格、重播、慢速、時間拉桿可用（時間窗由 `duration` 提供）。
- [x] 每支向量可獨立開關；「只看淨力」圖層。
- [x] 桌面 1440 × 900、iPad 直向 768 × 1024、iPad 橫向截圖已看；箭嘴長度按舞台高度與泳道間距限長。
- [x] console 無錯誤（shots.mjs 與 Playwright 互動檢查 `reports/…/audit/release-check.mjs`：放手後淨力只剩摩擦、停下後歸零；太空關引擎後 v 保持、燃料 0）。
- [ ] 待學生試用者確認：讀數面板在桌面版位於右欄較低位置（shell 版面），需滾動。

## C. 術語與內容
- [x] termlint 零錯誤（guide、quiz、manifest、controls、scenarios、charts）。
- [x] 查不到的名詞列入 `pendingTerms`（glider、seat belt / headrest、Galileo's law of inertia、impetus theory）。
- [x] guide 五節齊全，常見混淆 11 條各有 [key] 連結。
- [x] quiz.sources = 規格題號；items 空。
- [x] 規格外常數列入 `beyondSpec` 六項並在 guide 教師備註標明。

## E. 可信性
- [ ] 考題回歸：沒有評卷參考，全部題號列入 `pendingPapers`（24(1B)Q3(a) 的 1.5 m s⁻¹ 只作解析解測試）。
- [x] 理想化假設在畫面固定位置列明（manifest.assumptions）。
- [ ] `pendingTerms` / `beyondSpec` / `pendingPapers` 非空 → 通過閘 2 後只可 `preview`。

## 工具
- designlint 零錯誤；`tsc -b` 零錯誤；全套 121 條測試全綠。
- 導出：`node tools/export-sim.mjs inertia-and-newtons-first-law --frames 3200 --dt 0.005`（17 個運行）。
- 截圖：`node tools/shots.mjs inertia-and-newtons-first-law --url http://localhost:5175`。
- 學生試用者用靜態伺服器 http://localhost:4174（`vite build` + `vite preview`），避免熱更新重置。

## 閘 1 期間自己發現並修正的問題
1. 讀數面板把「力的支數」顯示成 3.00 → 改由畫布左上角以整數顯示。
2. 線圖 t 軸刻度 16.263 之類 → 改用 1–2–5 好看刻度。
3. iPad 直向重量箭嘴伸出舞台 → 箭嘴上限按舞台高度與泳道間距限長。
4. 桌布情景 s 軸被布的位移撐到 ±20 m → s 軸只看物件。
5. 太空情景飛船太細、第三艘畫出舞台外 → 最少 44 px；三艘中、上、下排列。
6. 第二個方塊走出畫面 → 每條泳道各自鏡頭跟隨。
7. 軸範圍假設施力／引擎全程按着會把放手後的 v–t 壓成一條線 → 預測改為施力 3 s 後放手；一直按着時軸只放大不縮小。
