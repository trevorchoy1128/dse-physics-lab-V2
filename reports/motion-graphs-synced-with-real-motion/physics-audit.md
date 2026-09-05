# 物理核數：motion-graphs-synced-with-real-motion
規格：reference/11_Book2_難點與3D模擬器規格.md「模擬器 7　運動線圖與真實運動同步」（第 384–421 行），並用 §0.2、§0.3 通用規範　數據：10 個運行、100 010 幀（每運行 10 001 幀，dt = 0.001 s）　**第 5 輪**（老師批准的額外三輪之第 2 輪；實作版本 0.4.0；manifest.ts 21:29、數據 2026-09-05 21:30 重新導出、截圖 21:30–21:31；controls.ts 16:53、scenarios.ts 16:03 與第 1–4 輪相同）

核數方法：不讀 model.ts / plan.ts / Scene.tsx。自寫 Node 程式（scratchpad/audit5.js，由第 4 輪 audit4.js 加入：(i) 末幀 t 是否**嚴格等於** T（`===`）、全部幀 t 是否在 [0, T] 內且單調；(ii) 每幀**所有欄位**（obs、arrows、labels、scales）遞歸檢查無 NaN／Infinity；(iii) 標籤數值、標籤位置、兩支箭嘴起點是否**嚴格等於** obs.s（不再用 1e-12 容差）；(iv) 凍結幀逐幀與第一個凍結幀 JSON 逐字相同；(v) 與第 4 輪 audit4-out.json 逐運行、逐讀數比對最大誤差），按規格方程獨立計算每幀 s、v、a、路程、速率、線下面積、平均速率、平均速度，再與導出數據逐幀比對。
- live 模式：v = u + at，s = ut + ½at²，a = 參數 a；路程 = ∫|v|dt 用解析式（反向時刻 t₀ = −u/a 分段）。
- draw 模式：v(t) 為以 vt 陣列在整數秒為節點的折線，只取時間窗內 T 段；a = 該段斜率；s、路程按每段梯形解析積分（段內過零另分段）。
- t ≥ T 的凍結幀：預期全部讀數（含 a）保持 t = T 的值。
- 兩種模式均為解析解，容差取相對誤差 1e-6（分母取 max(1, |預期|)）。
- 截圖：以 Node 純 zlib 解 PNG（png5.js、png5b.js），逐行列出軌道區（y 140–400、x 20–1050）的綠色像素線段，量度每支箭嘴的起點、箭頭尖端與標籤位置；另以 crop5.ps1 放大六張軌道區（r5-s1end-track.png、r5-s1early-track.png、r5-s4end-track.png、r5-s3early-track.png、r5-s3end-track.png、r5-desktop-track.png）目視確認箭頭與標籤。

**數據檔是否改變（模型 0.3.0 → 0.4.0）**：index.json 十個運行的 params 與第 4 輪逐字相同。以 audit5.js 重跑後與第 4 輪逐運行、逐讀數比對「最大誤差、出現時刻、導出值」：**80 項中 79 項逐位相同**；唯一改動是 scenario-below-axis 的 avgSpeed 最大誤差幀由 t = 9.9999999999999 s（第 4 輪末幀 t 值）移到 t = 9.999 s，因為本輪末幀 t 已改為恰等於 10（該幀 avgSpeed = 1.0000000000001446，與我的解析值 1 差 1.4 × 10⁻¹³，仍通過）。即 0.4.0 的模型改動只影響末幀的 t 與 plan() 的歸零，其他幀不受影響。

## 結論
**通過**。第 4 輪餘下的 F6、F7、F8 全部修正並經數據與截圖證實；F1–F5 維持通過。無新失敗項。

- **F6（已修）**：plan() 的標籤與箭嘴起點已用 observe() 歸零後的值。100 010 幀 labels[0].value、labels[0].position[0]、arrows[0].origin[0]、arrows[1].origin[0] 與 obs.s **嚴格相等（`===`）**，0 幀例外；第 4 輪的兩個問題幀——scenario-below-axis i = 10000（第 4 輪 −7.08 × 10⁻¹³）與 scenario-area-not-distance i = 9000（第 4 輪 +6.48 × 10⁻¹³）——本輪 obs.s、標籤、兩個起點全部恰為 0。截圖 scenario-1-end.png（t = 10.0 s）軌道標籤「s = 0.00 m」與面板「s 位移 0.00 m」一致（r5-s1end-track.png）。
- **F7（已修）**：scenario-1-end.png 軌道區有 v 實線箭嘴（x 533 → 488，向左，箭頭 x 488–498，標籤「v」x 479–484）與 a 虛線箭頭（x 533 → 524，向左，標籤「a」x 513–518）；scenario-4-end.png 有 v 實線箭嘴（x 438 → 393，向左，箭頭 393–403，標籤「v」384–389；a = 0 故無 a 箭嘴）。第 4 輪同兩張軌道區綠色像素為 0，本輪分別 315、204 個。末幀 t：10 個運行 `lastTisExactlyT: true`（T = 10 運行末幀 t 的字串表示為 "10"，T = 5 運行為 "5"；第 4 輪為 9.999999999999897 與 5.000000000000004）；全部 100 010 幀所有欄位無 NaN／Infinity。
- **F8（已修）**：箭嘴像素比例在同一運行內恆定、由參數決定。證據：(a) scenario-1（a = −0.4 全程不變）a 箭嘴 early 9.5 px（x 591.5 → 582）、end 9.5 px（x 533.5 → 524），相同；v 箭嘴 early 43 px（v = +1.876）、end 45 px（v = −2.00），比 0.956 對模型 0.938（量度 ±1 px 即 0.91–1.00）。(b) scenario-3（a = −9.81 全程不變）a 箭嘴 early 62 px（x 578 → 516，第 4 輪為 226 px）；end 51 px，但畫布左上已註「箭嘴已按邊緣空間同步縮短（比例不變）」，同幀 v 箭嘴 239 px、239/51 = 4.69 = 模型 46.05/9.81 = 4.694，反推未縮短 v 箭嘴 46.05 × (62/9.81) = 291 px > 小車到左邊可用 259 px，縮短係數 0.82 對兩支箭嘴相同，未縮短 a 長度 = early 的 62 px。(c) 預設參數三張不同時刻截圖 v 箭嘴隨 v 增長：desktop v = 3.88 → 86 px、ipad-landscape v = 4.30 → 96 px（比 1.116 對 1.108）；a = 1.00 兩張都是 22–23 px。第 4 輪三張 v 箭嘴同為 87 px 的現象消失。
- 物理數值全部通過：10 個運行 100 010 幀，八個讀數與我的解析解最大相對誤差 2.1 × 10⁻¹²；規格三條驗證條件全部成立；plan() 的箭嘴向量、標籤、縮放係數逐幀無誤。

## 1. 驗證條件（規格逐條）
| # | 條件原文 | 我的計算 | 導出數據 | 誤差 | 通過 |
|---|---|---|---|---|---|
| 1 | v–t 圖的線下面積必須等於 s–t 圖上的位移變化（數值比對） | (i) 對每運行用導出 v 作梯形積分 Σ½(vᵢ₋₁+vᵢ)Δt（含 t = T 幀），與導出 s 比對；(ii) obs.area 與 obs.s 比對 | (i) 最大 \|∫v dt − s\| = 3.35 × 10⁻¹¹ m（random-1，t = 7.996 s）；default 7.2 × 10⁻¹²、v-zero-a-not 7.1 × 10⁻¹²、random-0 8.5 × 10⁻¹²、random-3 9.0 × 10⁻¹²、random-4 5.4 × 10⁻¹²；draw 運行 below-axis 9.1 × 10⁻¹³、area-not-distance 2.7 × 10⁻¹²、random-2 4.4 × 10⁻¹³。(ii) 100 010 幀 area − s 恆為 0（含歸零幀 below-axis i = 10000、area-not-distance i = 9000 兩者同時為 0） | ≤ 3.4 × 10⁻¹¹ m | 是 |
| 2 | 勻加速情況下三條運動方程互相一致 | 七個 live 運行（default、st-not-path、v-zero-a-not、random-0/1/3/4；random-2 為 draw 不適用），t ≤ T 每幀（本輪含 t = T 幀）：v − (u + at)、s − (ut + ½at²)、v² − (u² + 2as) | max\|v − (u+at)\| = 6.5 × 10⁻¹²（v-zero-a-not）；max\|s − (ut+½at²)\| = 3.3 × 10⁻¹¹ m（random-1）；max\|v² − (u²+2as)\| = 4.8 × 10⁻¹⁰ m² s⁻²（random-3，v ≈ 51 m s⁻¹ 量級）；末幀 t = T 恰為整數後三式在 t = T 亦成立（default t = 10：v = 10、s = 50.00000000000279） | 相對 ≤ 2 × 10⁻¹³ | 是 |
| 3 | 位移讀數與路程讀數在物體從未反向時必須相等，反向後必須不等 | 以導出 v 的符號嚴格變號定反向時刻；反向前檢查 \|s\| = 路程，反向後檢查 路程 − \|s\| > 0 | 反向前 max\|\|s\| − 路程\| = 0（10/10 運行）。有反向的四個運行：scenario-below-axis v 在 t = 5.000 s 恰為 0，t = 5.001 s 起 s = 4.9999998 ≠ 路程 5.0000002，t = 10 s 為 0（恰為 0）對 10.000；scenario-v-zero-a-not 反向 t = 0.306 s，末幀 −107.625 對 108.542；scenario-area-not-distance 反向 t = 4.501 s（v 在 4.500 s 恰為 0），t = 9.000 s 為 0 對 17.000，末幀 −2.000 對 19.000；random-1 反向 t = 0.845 s，末幀 220.903 對 224.693。反向後每幀 路程 − \|s\| 最小值 > 3.6 × 10⁻⁶ m。不反向的六個運行末幀 \|s\| = 路程（default 50.000、random-0 128.625、random-2 10.500、random-3 135.606、random-4 81.742、st-not-path 0） | — | 是（random-4 全程向負方向，s = −路程，見 §7 第 3 點） |

## 2. 逐幀比對
所有運行、所有幀（含 t ≥ T 的凍結幀）。「量」欄列最大者；完整結果見 scratchpad/audit5-out.json。除 below-axis 的 avgSpeed 一項（末幀 t 改為 10 引致最大誤差幀移位）外，各行與第 4 輪逐位相同。

| 運行 | 量 | 最大相對誤差 | 出現於 t | 通過 |
|---|---|---|---|---|
| default（live u=0, a=1, T=10） | s / dist / area / avgSpeed / avgVel | 2.2 × 10⁻¹³ | 7.999 s | 是 |
| default | v、a、speed | 0 | — | 是 |
| scenario-below-axis（draw） | s / area | 9.1 × 10⁻¹³（絕對 9 × 10⁻¹³ m，預期 0.0019998） | 9.999 s | 是 |
| scenario-below-axis | v / speed | 1.8 × 10⁻¹⁵（我的解析值 −1.8 × 10⁻¹⁵，導出 0） | 5.000 s | 是 |
| scenario-below-axis | dist、avgSpeed | 1.4 × 10⁻¹³ | 9.999 s | 是 |
| scenario-below-axis | avgVel | 1.1 × 10⁻¹³ | 7.999 s | 是 |
| scenario-st-not-path（live u=0, a=0） | 全部八量 | 0（10 001 幀全部恰為 0） | — | 是 |
| scenario-v-zero-a-not（live u=3, a=−9.81, T=5） | s / area / avgVel | 2.3 × 10⁻¹³ | 4.000 s | 是 |
| scenario-v-zero-a-not | v、speed、dist、avgSpeed | ≤ 2.2 × 10⁻¹³ | 3.999–4.000 s | 是 |
| scenario-area-not-distance（draw） | s / area | 2.1 × 10⁻¹² | 8.500 s | 是 |
| scenario-area-not-distance | v、speed、dist、avgSpeed、avgVel | ≤ 6.6 × 10⁻¹³ | 4.000–7.999 s | 是 |
| random-0（live u=3.340, a=8.954, T=5） | s / dist / area | 1.8 × 10⁻¹³ | 3.889 s | 是 |
| random-1（live u=−4.488, a=5.316, T=10） | s / area | 6.8 × 10⁻¹³ | 1.888 s | 是 |
| random-2（draw，vt 預設，T=5） | s / dist / area / avgSpeed / avgVel | 1.2 × 10⁻¹³ | 3.997 s | 是 |
| random-2 | a | 0（[0,3) 為 1、[3,5] 為 0；t = 5 凍結 0） | — | 是 |
| random-3（live u=2.927, a=9.678, T=5） | s / dist / area / avg | 1.4 × 10⁻¹³ | 3.998 s | 是 |
| random-4（live u=−4.659, a=−4.676, T=5） | s / dist / area / avg | 1.0 × 10⁻¹³ | 3.982 s | 是 |
| 全部 10 運行 | a（全程含 t ≥ T） | 0 | — | 是 |

**時間軸與末幀（F7 根因檢查，本輪重點）**：
- 末幀 t 嚴格等於 T：10/10 運行 `last.t === p.T` 為 true；T = 10 的五個運行（default、below-axis、st-not-path、area-not-distance、random-1）末幀 t 的 JS 字串表示為 "10"，T = 5 的五個運行為 "5"。第 4 輪對應值為 9.999999999999897 與 5.000000000000004。
- 凍結前最後一幀：T = 10 運行 t = 9.998999999999898（i = 9999），T = 5 運行 t = 4.999000000000004（i = 4999）；凍結幀由 i = 10000（T = 10，共 1 幀）或 i = 5000（T = 5，共 5001 幀）起。
- 凍結幀一致性：T = 5 運行的 5001 個凍結幀 JSON 逐字相同（frozenMismatch = 0），含 t、八讀數、兩支箭嘴、標籤、scales。
- t < T 的幀 t 與 i·dt 差 ≤ 1e-9 s（tBad = 0）；t 在 [0, T] 內（tOutside = 0）；單調不減（tNonMono = 0）。
- 凍結幀 a 值：below-axis t = 10 → a = −0.4（末段斜率）、v = −2、s = 0；area-not-distance t = 10 → a = 0、v = −2、s = −1.9999999999995581；random-2 t = 5 → a = 0、v = 3、s = 10.5；v-zero-a-not t = 5 → a = −9.81、v = −46.05；其餘 live 運行 a = 參數 a。draw 模式末幀 a 不再是 NaN（第 4 輪 F7 根因）。
- **NaN / Infinity**：100 010 幀 × 8 讀數 0 個；同一 100 010 幀的 arrows（origin、vector）、labels（position、value）、scales 遞歸檢查 0 個。

**F6 歸零逐幀檢查**，對 s、dist、v、area、avgSpeed、avgVel 六個讀數 × 100 010 幀 = 600 060 個值：
- 我的解析值 |x| < 10⁻⁹ 而導出值不是恰為 0：**0 個**。解析值 ≥ 10⁻⁹ 而導出值為 0（誤歸零）：**0 個**。導出值殘留 0 < |x| < 10⁻⁹：**0 個**。
- 歸零幀：scenario-below-axis i = 5000（t = 5.000 s）v = 0、speed = 0；i = 10000（t = 10 s）s、area、avgVel = 0；scenario-area-not-distance i = 4500（t = 4.500 s）v = 0；i = 9000（t = 9.000 s）s、area、avgVel = 0。同幀其他讀數不受影響（below-axis i = 10000：dist 10.000000000001446、v −2、avgSpeed 1.0000000000001446）。
- **plan() 歸零（第 4 輪 F6 餘下部分）**：obs.s 恰為 0 的幀（各運行 i = 0、st-not-path 全部 10 001 幀、below-axis i = 10000、area-not-distance i = 9000），labels[0].value、labels[0].position[0]、arrows[0].origin[0]、arrows[1].origin[0] 全部恰為 0（planNotZero = 0）。below-axis i = 10000：s 0、label 0、position 0、origins 0、0；area-not-distance i = 9000 同。
- 不歸零的幀：area-not-distance i = 10000 s = −1.9999999999995581，label、origins 同值（嚴格相等），面板顯示 −2.00 m 正確。

其他逐幀檢查：
- 平均速率、平均速度：t > 0 時等於 路程/t、s/t（誤差 ≤ 2.4 × 10⁻¹³）；t = 0 時導出為 0。
- 情境 3 的 v = 0 瞬間：t = 0.305 / 0.306 / 0.307 s，v = +0.00795 / −0.00186 / −0.01167，a = −9.81 三幀不變，a 箭嘴向量長 9.81 不變（nearZero 幀 t = 0.306 s，aArrow = −9.81）。

## 3. 畫面向量
| 檢查 | 結果 | 證據（幀 / 數值） |
|---|---|---|
| velocity 箭嘴 vector = [obs.v, 0, 0]（模型值，非差分） | 通過 | 100 010 幀差 ≤ 1e-12；沿 x 軸，y、z 分量恆 0；歸零幀（below-axis i = 5000、area-not-distance i = 4500）向量恰為 [0,0,0] |
| acceleration 箭嘴 vector = [obs.a, 0, 0] | 通過 | 同上；凍結幀亦 = 段斜率／參數 a（v-zero-a-not 凍結 5001 幀 a 箭嘴 −9.81，v 箭嘴 −46.05；below-axis t = 10 a 箭嘴 −0.4） |
| 兩支箭嘴起點在小車：origin.x = obs.s | **通過（嚴格相等，F6 已修）** | 100 010 幀 `origin[0] === obs.s`，0 幀例外（第 4 輪 2 幀差 7 × 10⁻¹³）；origin.y 恆為 0.45（v）/ 0.75（a），z = 0 |
| 每幀恰有兩支箭嘴，kind / label / layer 正確 | 通過 | velocity→label "v"、layer "velocity"；acceleration→label "a"、layer "acceleration"；0 幀異常 |
| 同一 kind 縮放係數全程唯一 | 通過 | 每運行 scales.velocity = scales.acceleration = 0.25，10 001 幀不變；10 運行相同 |
| 同一幀內 v、a 兩支箭嘴同一比例（plan 層） | 通過 | 10 運行 74 021 幀（v、a 皆非零者）(v 向量 × scales.velocity)/(a 向量 × scales.acceleration) 與 v/a 之差 0 |
| 應恆定的箭嘴（live 模式 a）每幀長度相同（plan 層） | 通過 | 7 個 live 運行 \|a 箭嘴\| 極差 0（含凍結幀） |
| 應變化的箭嘴（v）變化率 = 模型 a（plan 層） | 通過 | live 運行 (vᵢ − vᵢ₋₁)/Δt 與 a 差 ≤ 5.9 × 10⁻¹²；draw 運行以區間起點所在段的斜率比對：below-axis 1.8 × 10⁻¹²、area-not-distance 1.3 × 10⁻⁹、random-2 2.2 × 10⁻¹⁰ |
| draw 模式 a 箭嘴 = 段斜率、在節點切換 | 通過 | area-not-distance：t ∈ [4, 5) a = −4，其餘 0（i = 4000 幀 a = −4、i = 3999 幀 0；i = 5000 幀 0）；random-2：[0,3) a = 1、[3,5] 0；below-axis 全程 −0.4（節點幀 −0.4000000000000001 與 −0.3999999999999999 交替，差 2 × 10⁻¹⁶） |
| 標籤 = obs（嚴格相等） | **通過（F6 已修）** | 每幀 1 個標籤：symbol "s"、unit "m"、position.y −0.5；100 010 幀 `value === obs.s` 且 `position[0] === obs.s`，0 幀例外 |
| **截圖有箭嘴（圖層開啟且 v ≠ 0）（F7）** | **通過（已修）** | scenario-1-end.png 軌道區綠色像素 315 個：v 箭嘴列 y 272–275 x 488–533、a 箭頭列 y 249–250 x 524–533；scenario-4-end.png 204 個：v 箭嘴列 y 277–279 x 393–438。第 4 輪兩張均為 0 |
| 截圖箭嘴附箭頭與標籤（§0.2 第 5 條） | 通過 | r5-s1end-track.png：v 箭頭三角 y 267–280 尖端 x 488、標籤「v」x 479–484；a 箭頭 y 243–256 尖端 x 524、標籤「a」x 513–518。r5-s4end-track.png：v 箭頭尖端 x 393、標籤 x 384–389。r5-s3end-track.png：v 箭頭尖端 x 37、標籤 x 28–33；a 箭頭尖端 x 225、標籤 x 214–220。r5-s1early、r5-desktop、ipad 兩張箭頭與標籤完整 |
| 截圖箭嘴方向 = 模型符號 | 通過 | s1-end v、a 向左（v = −2.00、a = −0.400）；s4-end v 向左（−2.00）；s1-early v 向右（+1.88）、a 向左（−0.400）；s3-early a 向左（−9.81）；s3-end v、a 向左（−46.1、−9.81）；desktop / ipad v、a 向右 |
| 截圖箭嘴外觀（§0.3）：v 綠實線、a 綠虛線、可分辨 | 通過 | 六張放大圖：v 實線 3 px 粗、a 虛線（節 5 px、隔 5 px）；同色系不同線型 |
| **同一情境內 a 不變時 a 箭嘴長度 early = end（F8）** | **通過（已修）** | scenario-1（a = −0.4）：early 9.5 px（起點 x 591.5、尖端 582）、end 9.5 px（533.5 → 524）。scenario-3（a = −9.81）：early 62 px（578 → 516）；end 51 px 但畫布註「箭嘴已按邊緣空間同步縮短（比例不變）」，同幀 v 239 px，239/51 = 4.69 = 46.05/9.81，未縮短 v = 291 px > 可用 259 px，係數 0.82，未縮短 a = 51/0.82 = 62 px = early。第 4 輪 scenario-3 為 226 px → 51 px |
| **v 箭嘴長度 ∝ \|v\|、同一運行比例恆定（F8）** | **通過（已修）** | scenario-1：early 43 px（v 1.876）、end 45 px（v 2.00）→ 22.9 / 22.5 px 每 m s⁻¹；scenario-4：early 45 px（2.00）、end 45 px（−2.00）；預設參數：desktop 86 px（3.88，22.2 px/unit）、ipad-landscape 96 px（4.30，22.3 px/unit）、ipad-portrait 77 px（3.87，19.9 px/unit，畫布較窄）；scenario-3 6.32 px/unit（a 62/9.81；v 縮短前 291/46.05）。第 4 輪三張 v 3.87–3.93 的 v 箭嘴同為 87 px 的現象消失 |
| 截圖同一幀 v、a 箭嘴比例 = 模型 v/a | 通過 | s3-end 239/51 = 4.69 對 4.694；desktop 86/22 = 3.91 對 3.88；ipad-portrait 77/20 = 3.85 對 3.87；ipad-landscape 96/23 = 4.17 對 4.30（a 箭嘴 ±1 px → 4.0–4.4）；s1-early 43/9.5 = 4.5 對 4.69（a 只有 9.5 px 箭頭，±1 px → 4.1–5.1）；s1-end 45/9.5 = 4.7 對 5.0 |
| 截圖：軌道標籤與面板 s 同一幀 | **通過（F6 已修）** | 11/11 一致：desktop 7.54 / 7.54（t = 3.88）、ipad-portrait 7.47 / 7.47（3.87）、ipad-landscape 9.24 / 9.24（4.30）、s1-early 0.603 / 0.603、**s1-end 0.00 / 0.00**（第 4 輪 −7.08 × 10⁻¹³ / 0.00）、s2-early 0.00 / 0.00、s2-end 0.00 / 0.00、s3-early 0.459 / 0.459、s3-end −108 / −108、s4-early 0.618 / 0.618、s4-end −2.00 / −2.00 |
| 截圖讀數與我的模型（三位有效數字） | 通過 | desktop t = 3.88（實際 3.883）：s = ½·3.883² = 7.539 → 7.54 ✓、v 3.88 ✓、平均 1.94 ✓；ipad-portrait t = 3.87（3.865）：7.47 ✓、平均 1.93 ✓；ipad-landscape t = 4.30：9.24 ✓、平均 2.15 ✓；s1-early t = 0.311：v = 2 − 0.4·0.311 = 1.876 ✓ 1.88、s = 0.6027 ✓ 0.603、平均 1.94 ✓；s1-end t = 10：s 0.00 ✓、d 10.0 ✓、v −2.00 ✓、a −0.400 ✓、面積 0.00 ✓、平均速率 1.00 ✓、平均速度 0.00 ✓；s2：全 0.00 ✓；s3-early t = 0.308：v = 3 − 9.81·0.308 = −0.0215 ✓、s = 0.4587 ✓ 0.459、d 0.4588 ✓ 0.459、平均速率 1.49 ✓、平均速度 1.49 ✓；s3-end t = 5：s = −107.6 ✓ −108、d = 108.5 ✓ 109、v = −46.05 ✓ −46.1、平均速率 21.7 ✓、平均速度 −21.5 ✓；s4-early t = 0.309：s 0.618 ✓、面積 0.618 ✓、平均 2.00 ✓；s4-end t = 10：s −2.00 ✓、d 19.0 ✓、面積 −2.00 ✓、平均速率 1.90 ✓、平均速度 −0.200 ✓ |
| 截圖切線斜率 = 模型 v、a | 通過 | desktop 3.88、1.00；ipad-portrait 3.87、1.00；ipad-landscape 4.30、1.00；s1-early 1.88、−0.400；s1-end −2.00、−0.400；s3-early −0.0215、−9.81；s3-end −46.1、−9.81；s4-early 2.00、0.00；s4-end −2.00、0.00；s2 0.00、0.00 |
| 截圖線下面積陰影 = 讀數 | 通過 | s4-end：v–t 圖 0–4.5 s 軸上陰影（青）、4.5–10 s 軸下陰影（橙），「面積 = −2.00 m」= s；s4-early：0–0.309 s 陰影、「面積 = 0.618 m」 |
| 座標軸「只放大不縮小」、畫圖模式 v ±5、a ±10 固定 | 通過 | desktop（t = 3.88）s ±10、v ±5、a ±2、軌道 ±10；ipad-landscape（t = 4.30，s = 9.24）s ±20、v ±10、軌道 ±20（接近 ±10 邊緣時放大）；s3-early s ±5、v ±5、a ±20、軌道 ±5；s3-end s ±200、v ±100、a ±20、軌道 ±200；draw 四張 v–t 縱軸 −5…5、a–t −10…10 |
| 播放列（本輪移到畫布上方）與「跳到 t =」 | 通過 | 11 張截圖畫布上方均有「暫停／播放」「逐格 0.1 s」「重播」「還原預設」「速度」「跳到 t =」滑桿與數字框（desktop 3.88、s1-end 10、s3-end 5、ipad-landscape 4.3）；ipad-portrait 的「跳到 t =」換行至第二列 |

## 4. 參數範圍與預設
**規格無參數表**（manifest.beyondSpec 已註明範圍由開發端定、待老師定奪）。controls.ts 檔案時間 16:53，與第 1–4 輪相同，內容逐行相同。

| 參數 | 規格 | controls.ts | 一致 / 評估 |
|---|---|---|---|
| mode | 「兩種操作模式：由運動生成圖／由圖生成運動」 | segment：live（由運動生成圖：我控制小車）、draw（由圖生成運動：我畫 v–t 圖），預設 live | 一致 |
| u 初速 | 無 | −5 至 5 m s⁻¹，步 0.5，預設 0，只在 live 顯示 | 合理：涵蓋正負初速 |
| a 加速度 | 無（迷思 3 需 9.81） | −10 至 10 m s⁻²，步 0.5，預設 1，只在 live 顯示 | 合理：涵蓋 ±9.81；情境 3 以 −9.81 覆寫（數字框顯示 −9.81，scenario-3-early.png） |
| T 時間窗 | 無 | select 5 / 10 / 20 s，預設 10 | 合理；極端 T = 20、u = 5、a = 10 時 v = 205 m s⁻¹、s = 2100 m，數值無問題 |
| vt（draw 折線節點） | 「在 v–t 圖上拖曳畫出線段」 | 不在 controls；預設 [0,1,2,3,3,3,2,1,0,0,0]（11 個整數秒節點，T = 5 時只用前 6 個） | 實作為每秒一節點折線，manifest.beyondSpec 已列待老師定奪 |
| g | §0.2：預設 9.81，可切 9.8 / 10 | 無 g 參數 | 本模擬器不含重力，a 由學生直接設定；可接受 |
| 預設 | — | mode live、u 0、a 1、T 10 | 與 desktop.png 一致（u 0、a 1、10 s） |

scenarios.ts（16:03，未變）與規格「常見迷思與反駁設計」表逐行對應（四條四個情境），misconception 文字與規格原文一致。manifest.ts version 0.4.0，註釋記錄 0.2.0（F1）、0.3.0（F6）、0.4.0（F6 plan 歸零、F7 末節點 NaN、凍結 t 截斷）改動。

## 5. 學生應該看見的現象
規格無獨立「學生應該看見的現象」小節；以「常見迷思與反駁設計」表、「場景」、「即時顯示」及 §0.2/§0.3 逐項對照。截圖時刻：desktop t = 3.88 s（播放中 1×）、ipad-portrait 3.87 s、ipad-landscape 4.30 s、scenario-N-early t = 0.308–0.311 s（0.1× 播放中）、scenario-1/2/4-end t = 10.0 s、scenario-3-end t = 5.00 s（時間窗末端，已停）。

| # | 現象 | 截圖位置 | 看到 |
|---|---|---|---|
| 1 | v–t 線在軸以下時物體向反方向移動；另設 a–t 圖判別加速／減速 | scenario-1-end.png（t = 10.0 s）：v–t 圖 6–10 s 節點在軸下（−0.4 … −2）；小車回到 s = 0；**小車上方 v 實線箭嘴向左（x 533 → 488）、a 虛線箭頭向左（533 → 524）**；a–t 圖全程水平線於 −0.4；讀數 v = −2.00、a = −0.400、d 路程 10.0 m 對 s 0.00。scenario-1-early.png（0.311 s）小車向右、v 箭嘴向右 43 px、a 箭頭向左作對照 | 是（F7 已修） |
| 2 | 靜止時 s–t 為水平線，物體卻不在移動 | scenario-2-end.png（t = 10.0 s）：小車在 s = 0 不動；s–t 圖為 0 的水平線延伸到 t = 10 s；讀數 s、d、v、a 全為 0.00；軌道區綠色像素 0（v = a = 0 無箭嘴）。scenario-2-early.png（0.308 s）同 | 是 |
| 3 | 速度為零時加速度仍為 9.81 m s⁻² | scenario-3-early.png（t = 0.308 s）：讀數 v = −0.0215 m s⁻¹、a = −9.81 m s⁻²；v–t 切線「斜率 = −9.81」正穿過零；a–t 圖水平線於 −9.81；小車上方虛線 a 箭嘴向左 62 px（r5-s3early-track.png），v 箭嘴因 \|v\| = 0.0215 換算 0.14 px 未畫出。同一運行終點 scenario-3-end.png 的 a 箭嘴未縮短長度亦為 62 px（見 §3），「加速度箭嘴長度不變」成立 | 是（F8 已修） |
| 4 | 面積在軸以下為負，總和是位移；另設路程讀數對照 | scenario-4-end.png（t = 10.0 s）：v–t 圖 0–4.5 s 軸上陰影（青）、4.5–10 s 軸下陰影（橙），「面積 = −2.00 m」；讀數「s 位移 −2.00 m」「d 路程 19.0 m」「v–t 線下面積 −2.00 m」；小車在 s = −2；**小車上方 v 箭嘴向左（x 438 → 393）**；s–t 圖先升至 8 m 再降到 −2 m；a–t 圖在 4–5 s 見 −4 的凹陷 | 是（F7 已修） |
| 5 | 場景：直軌道、小車、下方三個線圖 s–t、v–t、a–t | desktop.png：上方直軌道（−10 至 10 m 刻度）與小車，下方三圖 | 是 |
| 6 | 即時顯示：當前點切線（斜率） | desktop.png：s–t 圖「斜率 = 3.88 m s⁻¹」= v 讀數 3.88；v–t 圖「斜率 = 1.00 m s⁻²」= a | 是 |
| 7 | 即時顯示：0 到當前時刻的線下面積（陰影） | scenario-4-end.png：0–10 s 正負兩色陰影、「面積 = −2.00 m」；scenario-4-early.png：0–0.309 s 陰影、「面積 = 0.618 m」 | 是 |
| 8 | 即時顯示：位移與路程兩個獨立讀數 | desktop.png「s 位移 7.54 m」「d 路程 7.54 m」；scenario-3-end.png「−108 m」「109 m」；scenario-4-end.png「−2.00 m」「19.0 m」；scenario-1-end.png「0.00 m」「10.0 m」 | 是 |
| 9 | 兩種操作模式 | desktop.png 模式「由運動生成圖：我控制小車」含 u、a 滑桿；scenario-1 / scenario-4 截圖模式「由圖生成運動：我畫 v–t 圖」，v–t 圖上有可拖節點與「上下拖動圓點改變該秒的 v（每格 0.5）」提示，u、a 滑桿隱藏 | 是 |
| 10 | §0.3：速度綠實線、加速度綠虛線 | r5-desktop-track.png、r5-s1end-track.png、r5-s3end-track.png、ipad-portrait.png | 是 |
| 11 | §0.2 第 5 條：向量以箭嘴表示（附箭頭） | 九張有非零 v 或 a 的截圖箭頭完整（含 scenario-1-end、scenario-4-end，第 4 輪缺）；scenario-2 兩張 v = a = 0 無箭嘴 | 是（F7 已修） |
| 12 | §0.2 / §4.1：單位指數式、三位有效數字 | 所有截圖讀數：7.54 m、1.00 m s⁻²、−0.0215 m s⁻¹、−108 m、21.7 m s⁻¹ | 是 |
| 13 | 接近零的量顯示為 0.00 | 讀數面板：scenario-1-end s、面積、平均速度 0.00；scenario-2 全 0.00；**軌道標籤 scenario-1-end「s = 0.00 m」**（第 4 輪 −7.08 × 10⁻¹³ m） | 是（F6 已修） |
| 14 | 暫停與逐格、向量開關、數值面板、跳到 t、還原預設、重播 | desktop.png 畫布上方：「暫停」「逐格 0.1 s」「重播」「還原預設」「速度 1×」「跳到 t = 3.88」；顯示層開關「速度箭嘴」「加速度箭嘴」「切線（斜率）」「線下面積」；讀數面板 | 是 |
| 15 | 平均速率／平均速度符號不再同用 v̄ | 全部截圖讀數面板：「平均速率（路程 ÷ 時間）」「平均速度（位移 ÷ 時間）」，無符號 | 是 |
| 16 | 軌道標籤與讀數面板同步 | 11/11 截圖一致（§3） | 是（F6 已修） |
| 17 | 時間窗末端畫面 | scenario-1/2/4-end 讀數 t = 10.0 s、scenario-3-end t = 5.00 s；滑桿 100%、數字框 10 / 5；按鈕「播放」；數據末幀 t 恰為 10 / 5 | 是 |
| 18 | iPad 版面 | ipad-portrait.png、ipad-landscape.png：軌道、三圖、控制、讀數齊全；面板讀數與模型一致（t = 3.87 s：s = 7.47；t = 4.30 s：9.24）；v、a 箭嘴有箭頭有標籤 | 是 |
| 19 | 箭嘴長度隨速度增長（v 箭嘴）、加速度箭嘴恆定（a 箭嘴） | desktop v 3.88 → 86 px、ipad-landscape v 4.30 → 96 px，a = 1 兩張 22–23 px；scenario-1 a 箭頭 early / end 同為 9.5 px；scenario-3 a 早 62 px、末 62 px（縮短前） | 是（F8 已修） |

## 6. 守恆量與邊界
- 本模擬無守恆量（外加加速度的運動學）。可核的一致性：area ≡ s（100 010 幀差 0）；∫v dt 對 s 漂移 ≤ 3.4 × 10⁻¹¹ m（10 s）；v² = u² + 2as 漂移 ≤ 4.8 × 10⁻¹⁰。
- a = 0、u = 0（scenario-st-not-path）：10 001 幀全部讀數恰為 0，無 NaN；末幀 t = 10 恰為整數。
- F6 歸零門檻 10⁻⁹ m：本數據內最小的非零 |s| 是 default i = 1 的 5 × 10⁻⁷ m，draw 運行 i = 1 的 2 × 10⁻³ m；最小非零 |v| 是 v-zero-a-not i = 306 的 1.86 × 10⁻³ m s⁻¹。全部遠大於門檻，誤歸零 0 個。極端情況：live 模式 a = 0.5、u = 0 時 s(0.001) = 2.5 × 10⁻⁷ m，仍高於門檻 250 倍。
- draw 模式 T = 5 而 vt 有 11 節點（random-2）：只用前 6 節點，t = 5 凍結 a = 段 [4,5] 斜率 0，s = 10.5、路程 10.5，無 NaN。draw 模式 T = 10 的末節點（below-axis、area-not-distance）：t = 10 幀 a 分別為 −0.4、0（末段斜率），不是 NaN（F7 根因已除）。
- 參數極端（解析估算，數據內無此運行）：u = ±5、a = ±10、T = 20 → |v| ≤ 205 m s⁻¹、|s| ≤ 2100 m；數值上無溢出。random-3（a = 9.68、T = 5）已見 s = 135.6 m、v = 51.3 m s⁻¹ 正常；scenario-3 軌道軸自動放大到 ±200 m。
- 時間窗末端：t ≥ T 後 t、全部八讀數、兩支箭嘴向量、標籤全部凍結，T = 5 運行 5001 幀 JSON 逐字相同；a 保持參數值／末段斜率。
- 箭嘴像素邊界（F5 規則保留）：scenario-3 末端小車距左邊 259 px，未縮短 v 箭嘴 291 px，縮至 239 px（末端 x 37，在畫布內邊 x 17 之內），a 同步縮至 51 px，畫布註記顯示。其餘十張截圖箭嘴未觸及邊緣、未縮短（scenario-1-end v 箭嘴末端 x 488 距左邊 470 px）。
- 箭嘴比例規則（F8 修正後由參數決定）：由截圖反推每 m s⁻¹（或 m s⁻²）像素：vmax = 2 的 draw 情境 22.5–22.9 px；預設（vmax = 10）desktop 22.2、ipad-landscape 22.3、ipad-portrait 19.9；vmax = 46.05 的情境 3 為 6.32 px。同一運行內（early 對 end、desktop 對 landscape）恆定。

## 7. 規格待釐清
1. draw 模式 vt 節點數（T + 1 = 11 對應 T = 10）多於時間窗（T = 5）時，實作只用前 T + 1 個節點，t = T 的凍結 a 取窗內末段斜率（random-2 得 0，而非 vt[5]→vt[6] 的 −1）。本核數按此解讀通過；建議 manifest 或規格說明「時間窗外的節點不生效」。
2. random-2 的 params 同時記錄 u = 2.838、a = −3.337（draw 模式下不生效）；導出器宜只記錄生效參數，或註明。
3. 驗證條件三「從未反向時位移讀數與路程讀數必須相等」：物體一直向負方向走時 s = −路程（random-4 全程、random-1 反向前）。本核數以「大小相等」解讀（通過）。建議規格改為「數值上 |s| = 路程」或說明正方向約定。
4. 「由圖生成運動：學生在 v–t 圖上拖曳畫出線段」：實作是每秒一個節點的折線（manifest 已列 beyondSpec）。折線在節點處 a 不連續（scenario-4 於 t ∈ [4, 5) a = −4，其餘 0；random-2 在 t = 3 由 1 跳到 0），a–t 圖出現垂直跳變，是否可接受待老師定奪。
5. 導出的 plan().scales（velocity = acceleration = 0.25，10 運行全同、全程不變）與畫面實際像素比例無關（畫面每 m s⁻¹ 像素由 6.32 到 22.9 不等）。本輪畫面比例已由截圖量度證實符合「運行內恆定、v/a 比例正確」，但若 scales 欄位意在讓核數員核對畫面比例，建議輸出每幀實際採用的像素比例（含邊緣縮短係數），令畫面層可由數據核對。
6. 接近零的 v 箭嘴：scenario-3-early.png v = −0.0215 m s⁻¹（0.14 px）未畫出（第 4 輪 v = −0.0509 時畫了 17 px 箭頭）。物理上 |v| ≈ 0 不畫是合理的，但規格沒有規定接近零的箭嘴要不要畫、門檻多少，待老師定奪。
7. 軌道座標軸放大時機：ipad-landscape.png 在 s = 9.24 m 時軌道與 s–t 軸已由 ±10 放大到 ±20，desktop.png 在 s = 7.54 m 仍為 ±10；即接近 ±10 邊緣（約 90%）即放大。「只放大不縮小」成立；放大門檻規格未定，記錄備查。

---
核數程式與逐運行完整結果：`C:\Users\trevor\AppData\Local\Temp\claude\C--Users-trevor-OneDrive-DSE-Physics-Lab\518529cb-95ec-48b7-b334-4ccdcf91c4a5\scratchpad\audit5.js`、`audit5-out.json`、`audit5-console.txt`；截圖像素掃描 `png5.js`（區域統計）、`png5b.js`（逐行線段）；放大圖 `r5-s1end-track.png`、`r5-s1early-track.png`、`r5-s4end-track.png`、`r5-s3early-track.png`、`r5-s3end-track.png`、`r5-desktop-track.png`（由 `crop5.ps1` 產生）；第 4 輪結果 `audit4-out.json` 供逐位比對。
