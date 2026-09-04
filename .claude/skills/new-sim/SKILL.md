---
name: new-sim
description: 建立或重做 DSE Physics Lab 的一個物理模擬（實驗或概念）的標準流程。凡是要新增模擬、把規格文件某一節變成程式、寫 model / Scene / controls / guide / quiz、補做某個模擬的測試或「常見混淆」分頁，或者用戶提到「S1」「模擬器 3」「拋體」「做個模擬」，即使沒有明說 /new-sim，都要用這個 skill。它保證物理跟足規格、術語不自創、學生不用講解也懂得用。
---

# new-sim：建立一個模擬

一個模擬 = `src/sims/<simId>/` 內七個檔案，由規格文件的一節逐欄映射而成。
這個 skill 的價值在於**次序**和**檢查表**：122 個模擬要一樣嚴謹，第 100 個不能比第 1 個鬆。

三個目標，也是三個常見失敗點：
1. **物理絕對正確** — 所以先寫測試，測試來自規格的「驗證條件」，模型未過測試不准畫場景。
2. **學生不用講解也懂得用** — 所以場景打開時已在動、控制項有中文標籤和單位、每個迷思有一個按鈕可以「試試看」。
3. **術語不自創** — 所以所有中文物理名詞經 `node tools/term.mjs` 查證，hook 會擋自創詞。

## 0. 輸入

先在 `content/catalogue.json` 找到該模擬（用 `zh`、`spec` 或 S 編號）。它告訴你：單元、課本章節、類型（e 實驗 / c 概念）、優先、中英名稱、一句內容。

再打開對應的規格文件（`reference/1?_Book?_難點與3D模擬器規格.md`）的那一節。規格文件每節固定有這些欄，每一欄都有去處：

| 規格欄位 | 去處 |
|---|---|
| 對應章節、DSE 對應題目 | `manifest.ts` 的 `chapter`、`dsePapers` |
| 學生難在哪裏 | `guide.zh.md` 的「理論」開頭一段 |
| 常見迷思與反駁設計（表） | `guide.zh.md` 的「常見混淆」+ `scenarios.ts` 的「試試看」情境（一條迷思一個情境） |
| 場景 | `Scene.tsx` 的情景切換 |
| 可調參數（表：符號、範圍、預設、單位） | `controls.ts`，逐行照抄，不得偏離範圍與預設 |
| 即時顯示 | `model.ts` 的 `observe()` + `charts.ts` |
| 方程 | `model.ts` 的 `step()`，照抄，不簡化 |
| 學生應該看見的現象 | 檢查表第 3 項；也是 `guide.zh.md` 的「觀察重點」 |
| 為何必須用 3D | `manifest.ts` 的 `needs3D`；決定 Scene 是 3D 還是 2D |
| 驗證條件 | `model.test.ts`，一條驗證條件一個測試 |

規格沒有的東西不要補。真的覺得需要（例如多一個情景），寫進 `manifest.ts` 的 `beyondSpec` 並在 guide 標「規格以外，待老師定奪」。老師看到會決定，靜靜加入的話沒人知道那是猜的。

如果該模擬**沒有規格文件**（Book 2 以外的單元暫時如此），停下來告訴用戶：可以先做骨架和測試，但物理內容、參數範圍和迷思清單要等規格，不要自己編一套。

## 1. 固定次序

跟着做，不跳步。每步做完才做下一步，因為後一步依賴前一步的產物。

### 1.1 建資料夾與 manifest
從 `assets/templates/` 複製七個檔案到 `src/sims/<simId>/`。`simId` 用英文 kebab-case（如 `projectile-independence`），來自 catalogue 的英文名。
填 `manifest.ts`。標題和摘要的中文逐個名詞用 `node tools/term.mjs` 核對；查不到的列入 `pendingTerms`。

### 1.2 先寫測試（model.test.ts）
把規格的每一條「驗證條件」變成一個測試，測試名用中文照抄該條件。
例：「θ = 45° 時射程最大」→ 掃描 θ 由 10° 至 80°，斷言 45° 的射程最大。
例：「v_x 在全程數值不變，容許誤差 10⁻⁶」→ 跑完整段軌跡，斷言 max|v_x − u cos θ| < 1e-6。
再加兩類：與解析解比較（有公式的一定加）；守恆量（能量、動量）在應守恆時的漂移 < 1e-6。
另開 `dse.test.ts`：規格列出的每一題 DSE / HKCEE 題目一個測試，把題目給的數值放入模型，斷言輸出等於評卷參考答案（有效數字按評卷參考）。這是其他老師最信的證據。評卷參考在 `content/papers/`；未有的題目列入 `manifest.pendingPapers`，不要自己作答案充當參考。
實驗類再開 `labdata.test.ts`：`content/labdata/<simId>/` 有學校實測數據時，開啟誤差模式跑同樣次數，輸出的平均與離散要與實測在實驗誤差內吻合。
數值積分用 `src/physics/integrators.ts` 的 `rk4`，步長由測試決定（通常 1e-3 s）。

跑 `npx vitest run src/sims/<simId>` — 此時應該全部失敗，因為 model 還未寫。這一步是要確認測試真的在測東西。

### 1.3 寫 model.ts
純 TypeScript，只 import `src/physics/*`。三個函數：`init(params)`、`step(state, params, dt)`、`observe(state, params)`。
方程照規格抄，變量名照考評局符號（u、v、a、s、t、m、F、W、P、p、ω、r、T）。
`observe()` 回傳規格「即時顯示」列出的每一個量，key 用英文，值用 SI 單位；顯示時的三位有效數字和單位由 shell 處理，model 不做格式化。
跑測試直至全綠。綠了才可以往下。

### 1.4 寫 controls.ts
規格的參數表逐行變成一個 `ControlDef`：`key`（英文）、`symbol`（斜體符號）、`label`（{zh,en}，中文查術語表）、`unit`（指數式）、`min`、`max`、`step`、`default`。
範圍和預設值必須和規格一致。想改要問，因為老師是按課本題目定的。
g 用共用控制 `gControl`（預設 9.81，可選 9.8 / 10），不要自己做一個。

### 1.5 寫 scenarios.ts（試試看）
規格迷思表每一行變成一個 `Scenario`：`misconception`（學生會怎樣想）、`params`（把參數設到能推翻它的組合）、`watch`（看甚麼讀數或箭嘴）、`expect`（會看到甚麼）。
這是反差原則的落實：先寫學生的預測，再確保模擬在那組參數下明顯不同。寫不出反差的迷思，回去看規格的「反駁設計」欄，那裏有提示。

### 1.6a 寫 plan.ts 與 plan.test.ts（畫面的物理）
模型對，畫面仍可以錯：箭嘴方向反轉、起點錯、兩支力縮放不同、座標左右手搞錯、面板數字與模型不符。這些測不到模型，所以畫面內容要先變成資料再畫。
`plan.ts` 是純函數 `plan(state, params, obs, layers) → RenderPlan`：列出每支箭嘴（kind、origin、vector）、每個標籤（value、unit、symbol）、每條軌跡。不 import three.js。
`plan.test.ts` 對 RenderPlan 斷言：
- 每支箭嘴的 vector 與模型量一致（例：拋體最高點速度箭嘴 y 分量 = 0；加速度箭嘴全程 = (0, −g, 0)）。
- `net` 箭嘴 = 畫出的各力之和；`normal` 垂直於接觸面；`friction` 沿接觸面且與相對運動趨勢相反；`tension` 沿繩指離物體。
- 同一 kind 在整個場景只有一個縮放係數（`plan` 回傳 `scales`，測試檢查每支箭嘴 |drawn| / |physical| 相等）。
- 標籤數值等於 `observe()` 對應的值，單位字串在 `src/shell/units.ts` 允許清單內。
- 在控制範圍內隨機取 50 組參數跑一段時間：沒有 NaN、沒有 Infinity、箭嘴長度有界。
座標約定全站一個：x 向右、y 向上、z 指向觀眾，右手系。`src/shell/frame.test.ts` 已固定測試 x × y = z；任何模擬不得自行換軸。

### 1.6b 寫 Scene.tsx
只把 `plan()` 的結果畫出來，沒有任何 if 判斷物理。
- 向量用 `<VectorArrow kind="weight|normal|friction|tension|net|velocity|acceleration">`，顏色與線型由 kind 決定，不要自己配色。速度和力線型不同是規格硬性要求。
- 每支向量都在 `layers` 登記，shell 會自動生成開關。
- 場景打開時已在播放預設情境，畫面中央是主體，相機預設角度要一眼看到規格「學生應該看見的現象」第 1 項。
- `needs3D` 為 low 的模擬（如運動線圖）用 2D `<Canvas2D>`，不要為 3D 而 3D。
- 觸控：物件可拖的話要有 ≥ 44 px 的抓取區；不做只靠 hover 的互動。

### 1.7 寫 charts.ts
規格「即時顯示」中屬於隨時間變化的量做圖表；x 軸預設 t。需要學生讀斜率的圖（如 s-t²、F-ω²）設 `fit: "linear"`。

### 1.8 寫 guide.zh.md 與 quiz.json
`guide.zh.md` 固定五節：實驗步驟（實驗類）或觀察步驟（概念類）、理論、常見混淆、觀察重點、教師備註。
常見混淆每條格式：學生的想法 → 為何會這樣想 → 試試看（連結 scenario key）→ 正確理解。
`quiz.json` 先放規格列出的 DSE 題號作 `sources`，題目內容等老師提供《試題總索引》後再補；不要自己作題冒充 DSE 題。
中文名詞逐個查術語表。

### 1.9 跑 termlint 與測試
```
node tools/termlint.mjs src/sims/<simId>/guide.zh.md src/sims/<simId>/quiz.json
npx vitest run src/sims/<simId>
```
兩者都乾淨才到下一步。

### 1.10 實機驗證
用瀏覽器面板開 `/sim/<simId>`：
1. 桌面尺寸截圖一張，iPad 直向（768×1024）一張。
2. 讀 console，不能有錯誤或 three.js 警告。
3. 按每一個「試試看」，確認畫面真的出現規格說的現象。
4. 對照規格「學生應該看見的現象」逐項核對截圖，每項寫一句「在截圖哪裏看到」。
5. Playwright 讀數值面板的文字，與 `observe()` 比較：三位有效數字、指數式單位、符號斜體都要一致（`src/shell/readout.test.ts` 提供共用測試，傳入 simId 即可）。
6. 涉及方向判斷的模擬（左手定則、右手握拳、楞次、帶電粒子在磁場中）：與 `src/shell/fixtures/handedness/` 的基準截圖並排比較，確認左右手沒有鏡像。
7. 不看代碼、不看規格，只看畫面問自己：一個中五學生第一次打開，知道要做甚麼嗎？知道每個滑桿改甚麼嗎？不知道就改標籤或加提示，不是加說明文字。
這一步只能減少錯誤，不能證明沒有錯誤；最後把關是 subagent 的獨立驗收和老師的審核，見 `references/checklist.md` D 節。

### 1.11 對照檢查表（閘 1）
讀 `references/checklist.md`，A、A2、B、C、E 逐項確認。有一項不過就未完成。

### 1.12 獨立驗收（閘 2）
`node tools/export-sim.mjs <simId>` 導出逐幀數據，截圖放 `reports/<simId>/shots/`。然後**同時**派出四個驗收 agent（見 `.claude/agents/`）：
- `physics-auditor`：規格 + 數據 + 截圖，獨立計算比對。
- `second-implementer`：只有規格，從零再實作一次，逐幀交叉比對。
- `student-tester`：只有網址與三個學生任務。
- `apparatus-reviewer`：截圖 + 規格「場景」段（有儀器的模擬才派）。
四份報告都在 `reports/<simId>/`。任何「不通過」「不一致」「卡住」「必改」都回 1.3–1.8 修正，然後按 `references/loop.md` 的對應表重派：改 model 重派核數員與第二實作者，改 plan / Scene 重派核數員與儀器審核員，改標籤與 guide 重派學生試用者，改 controls 全部重派。三輪封頂，超限寫升級報告交老師，該模擬設 `"blocked"`，進入下一個。修正者不得刪改規格衍生的測試，改 model / plan 必須遞增版本。全部通過才到閘 3。
無人值守批量跑：`.claude/workflows/verify-loop.js`（修正者為 `sim-fixer` agent），需用戶明確說「用 workflow」。

### 1.13 老師簽收與凍結（閘 3）
生成 `src/sims/<simId>/verification.json`（由 reports 匯總），把截圖、「學生應該看見的現象」對照表、`pendingTerms`、`beyondSpec`、`pendingPapers` 放入本輪的審核面板交老師。老師簽收後：把簽收版本的截圖與逐幀輸出複製到 `baselines/<simId>/`，catalogue 該項 `status: "approved"`，跑 `node tools/build-catalogue.mjs`。
`pending*` 任何一項非空，狀態只能是 `"preview"`，CI 不會把它發佈給學生（閘 4）。

## 2. 檔案契約
七個檔案的型別、shell 提供的共用元件、向量顏色表、`Scenario` 結構，見 `references/module-contract.md`。第一次做模擬先讀它；之後只在需要時查。

## 3. 不要做的事
- 不自行翻譯術語；不用別稱代替「採用」欄。
- 不改規格的參數範圍、預設值、方程。
- 不把 3D 必要性「必須」或「高」的模擬做成 2D。
- 不用外部 3D 模型檔；儀器用程式幾何。
- 不在 model.ts 內 import three.js；不在 Scene.tsx 內算物理。
- 不作 DSE 題冒充真題。
- 未跑測試、未實機看過，不說「完成」。
