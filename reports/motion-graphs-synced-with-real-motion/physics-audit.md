# 物理核數：motion-graphs-synced-with-real-motion
規格：reference/11_Book2_難點與3D模擬器規格.md「模擬器 7　運動線圖與真實運動同步」（第 384–421 行；檔案時間 2026-09-05 01:10，六輪未變），並用 §0.2、§0.3 通用規範　數據：10 個運行、100 010 幀（每運行 10 001 幀，dt = 0.001 s）　**第 6 輪（最後一輪）**（實作版本 0.4.1；model.ts 21:29 與第 5 輪相同、plan.ts 22:00、Scene.tsx 22:00、manifest.ts 22:00；數據 22:00:51–52 重新導出、截圖 22:01:00–22:02:15 重拍；controls.ts 16:53、scenarios.ts 16:03 與第 1–5 輪相同）

核數方法：不讀 model.ts / plan.ts / Scene.tsx。第 5 輪的獨立程式 audit5.js 改為 audit6.js（scratchpad），唯二改動：(i) 比對基準由第 4 輪改為第 5 輪 audit5-out.json，並新增**整份核數記錄逐欄深度比對**（每運行的時間軸、NaN、八讀數最大誤差／出現時刻／導出值、三條驗證條件、箭嘴／標籤／縮放係數統計、F6 歸零統計、v/a 比例、最接近零幀、末幀完整 JSON）；(ii) 掃描導出幀有沒有新的 `meta` 欄位。獨立模型與第 5 輪相同：
- live 模式：v = u + at，s = ut + ½at²，a = 參數 a；路程 = ∫|v|dt 用解析式（反向時刻 t₀ = −u/a 分段）。
- draw 模式：v(t) 為以 vt 陣列在整數秒為節點的折線，只取時間窗內 T 段；a = 該段斜率；s、路程按每段梯形解析積分（段內過零另分段）。
- t ≥ T 的凍結幀：預期全部讀數（含 a）保持 t = T 的值。
- 兩種模式均為解析解，容差取相對誤差 1e-6（分母取 max(1, |預期|)）。
- 截圖：第 5 輪的 png5.js（區域統計）、png5b.js（逐行綠色線段）原樣重跑於 11 張新截圖；crop6.ps1（= crop5.ps1 改輸出名）產生六張放大軌道區 r6-s1end-track.png、r6-s1early-track.png、r6-s4end-track.png、r6-s3early-track.png、r6-s3end-track.png、r6-desktop-track.png 目視確認箭頭、標籤與線型。

**數據是否與第 5 輪相同（model.ts 未改）**：
- index.json 十個運行的 params 與第 5 輪逐字相同（audit6 的 paramsChanged 0 個）。
- audit6-out.json 與 audit5-out.json（各去掉互相比對的 `_diffVs` 欄位後）解析後 `JSON.stringify` **完全相等（true）**。即 10 個運行 × 8 讀數的最大誤差、出現時刻、導出值，10 個末幀的完整 JSON（t、八讀數、兩支箭嘴、標籤、scales），時間軸統計（末幀 t 恰等於 T、凍結幀數、凍結幀逐字相同數），三條驗證條件的全部數字，箭嘴／標籤／縮放統計，F6 歸零統計，全部逐位相同。
- 深度比對列出 12 個「差異」，全部是第 5 輪 JSON 檔把 `Infinity` / `-Infinity` 存成 `null`、本輪記憶體內為 `Infinity` 的序列化假差異（default／st-not-path／random-0／random-2／random-3／random-4 的 `minGap_after`，無反向運行未定義；below-axis／area-not-distance／random-2 的 `aLenMin`／`aLenMax`，draw 運行不統計）。逐項印出後兩輪值相同（表列於 audit6-console.txt 末段）。
- 第 5 輪未記錄數據檔雜湊，故檔案層面「逐位元組相同」無法回溯證明；本輪記錄 SHA-256 供日後比對：default 61a09f24…, scenario-below-axis 9fa2bd6e…, scenario-st-not-path 1f574fc5…, scenario-v-zero-a-not 3eb0b8b1…, scenario-area-not-distance c86ab70d…, random-0 2c86a864…, random-1 d0a31e36…, random-2 ceee2d87…, random-3 1f7a7916…, random-4 6a81728b…, index 7cdd13e9…（完整值見 audit6-console.txt 前段）。
- 導出幀**沒有** `meta` 欄位（100 010 幀中 0 幀），所以「plan 的 meta 改為與讀數面板同一來源」只能由截圖的圖內標籤文字核對（§3、§5），不能由數據核對（見 §7 第 8 點）。

## 結論
**通過**。零失敗項。第 1–5 輪的 F1–F8 全部維持通過；本輪畫面層改動（meta 同源、拖動就近、播放列行為）沒有引入任何數據或畫面偏差。

- **數據**：與第 5 輪在全部核數量上逐位相同（上段）。10 個運行 100 010 幀，八個讀數與我的解析解最大相對誤差 2.1 × 10⁻¹²；規格三條驗證條件全部成立；plan() 的箭嘴向量、標籤、縮放係數逐幀無誤；NaN／Infinity 0 個。
- **11 張截圖**：畫面向量（方向、長度、v/a 比例、同運行內比例恆定、箭頭、標籤、線型）與第 5 輪量度一致，其中六張時刻相同者像素位置逐一相同（§3 表）；三張時刻略異者（desktop 3.88 → 3.90 s、ipad-landscape 4.30 → 4.02 s、scenario-3-early 0.308 → 0.306 s、scenario-4-early 0.309 → 0.308 s）長度按模型 v 改變、每單位像素不變。
- **圖內「斜率 =」「面積 =」標籤**：11 張截圖共 24 個圖內數值標籤，全部與讀數面板同一幀的 v、a、s 三位有效數字逐字相同；其中六個為零的標籤（scenario-2-early 兩個、scenario-2-end 兩個、scenario-4-early 與 scenario-4-end 的 v–t 斜率）均顯示「0.00」，沒有「-0.00」、指數形式或 10⁻¹⁵ 級殘餘。s = 0 的三張截圖（scenario-1-end、scenario-2-early、scenario-2-end）軌道標籤均為「s = 0.00 m」。

## 1. 驗證條件（規格逐條）
本輪重算，數字與第 5 輪逐位相同。
| # | 條件原文 | 我的計算 | 導出數據 | 誤差 | 通過 |
|---|---|---|---|---|---|
| 1 | v–t 圖的線下面積必須等於 s–t 圖上的位移變化（數值比對） | (i) 對每運行用導出 v 作梯形積分 Σ½(vᵢ₋₁+vᵢ)Δt（含 t = T 幀），與導出 s 比對；(ii) obs.area 與 obs.s 比對 | (i) 最大 \|∫v dt − s\| = 3.35 × 10⁻¹¹ m（random-1，t = 7.996 s）；default 7.2 × 10⁻¹²、v-zero-a-not 7.1 × 10⁻¹²、random-0 8.5 × 10⁻¹²、random-3 9.0 × 10⁻¹²、random-4 5.4 × 10⁻¹²；draw 運行 below-axis 9.1 × 10⁻¹³、area-not-distance 2.7 × 10⁻¹²、random-2 4.4 × 10⁻¹³。(ii) 100 010 幀 area − s 恆為 0（含歸零幀 below-axis i = 10000、area-not-distance i = 9000 兩者同時為 0） | ≤ 3.4 × 10⁻¹¹ m | 是 |
| 2 | 勻加速情況下三條運動方程互相一致 | 七個 live 運行（default、st-not-path、v-zero-a-not、random-0/1/3/4；random-2 為 draw 不適用），t ≤ T 每幀（含 t = T 幀）：v − (u + at)、s − (ut + ½at²)、v² − (u² + 2as) | max\|v − (u+at)\| = 6.5 × 10⁻¹²（v-zero-a-not）；max\|s − (ut+½at²)\| = 3.3 × 10⁻¹¹ m（random-1）；max\|v² − (u²+2as)\| = 4.8 × 10⁻¹⁰ m² s⁻²（random-3，v ≈ 51 m s⁻¹ 量級）；t = T 恰為整數後三式在 t = T 亦成立（default t = 10：v = 10、s = 50.00000000000279） | 相對 ≤ 2 × 10⁻¹³ | 是 |
| 3 | 位移讀數與路程讀數在物體從未反向時必須相等，反向後必須不等 | 以導出 v 的符號嚴格變號定反向時刻；反向前檢查 \|s\| = 路程，反向後檢查 路程 − \|s\| > 0 | 反向前 max\|\|s\| − 路程\| = 0（10/10 運行）。有反向的四個運行：scenario-below-axis v 在 t = 5.000 s 恰為 0，t = 5.001 s 起 s = 4.9999998 ≠ 路程 5.0000002，t = 10 s 為 0（恰為 0）對 10.000；scenario-v-zero-a-not 反向 t = 0.306 s，末幀 −107.625 對 108.542；scenario-area-not-distance 反向 t = 4.501 s（v 在 4.500 s 恰為 0），t = 9.000 s 為 0 對 17.000，末幀 −2.000 對 19.000；random-1 反向 t = 0.845 s，末幀 220.903 對 224.693。反向後每幀 路程 − \|s\| 最小值 > 3.6 × 10⁻⁶ m。不反向的六個運行末幀 \|s\| = 路程（default 50.000、random-0 128.625、random-2 10.500、random-3 135.606、random-4 81.742、st-not-path 0） | — | 是（random-4 全程向負方向，s = −路程，見 §7 第 3 點） |

## 2. 逐幀比對
所有運行、所有幀（含 t ≥ T 的凍結幀）。「量」欄列最大者；完整結果見 scratchpad/audit6-out.json。**每一行與第 5 輪逐位相同。**

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

時間軸、凍結幀、NaN、F6 歸零逐幀檢查：全部數字與第 5 輪 §2 相同——末幀 t 嚴格等於 T（10/10，字串 "10" / "5"）；t < T 的幀 t 與 i·dt 差 ≤ 1e-9 s、在 [0, T] 內、單調（tBad = tOutside = tNonMono = 0）；T = 5 運行 5001 個凍結幀 JSON 逐字相同（frozenMismatch = 0）；凍結幀 a = 參數 a／末段斜率（below-axis t = 10 → −0.3999999999999999、area-not-distance → 0、random-2 → 0、v-zero-a-not → −9.81）；100 010 幀 × 8 讀數及全部 arrows／labels／scales 欄位 NaN／Infinity 0 個；六個讀數 × 100 010 幀 = 600 060 個值中，解析值 |x| < 10⁻⁹ 而導出非恰為 0：0 個，誤歸零 0 個，殘留 0 < |x| < 10⁻⁹：0 個；obs.s 恰為 0 的幀 labels[0].value、labels[0].position[0]、arrows[0].origin[0]、arrows[1].origin[0] 全部恰為 0（planNotZero = 0）。情境 3 的 v = 0 瞬間：t = 0.305 / 0.306 / 0.307 s，v = +0.00795 / −0.00186 / −0.01167，a = −9.81 三幀不變，a 箭嘴向量長 9.81 不變。

## 3. 畫面向量
### 3a. plan() 層（數據，與第 5 輪逐位相同）
| 檢查 | 結果 | 證據（幀 / 數值） |
|---|---|---|
| velocity 箭嘴 vector = [obs.v, 0, 0]（模型值，非差分） | 通過 | 100 010 幀差 ≤ 1e-12；沿 x 軸，y、z 分量恆 0；歸零幀（below-axis i = 5000、area-not-distance i = 4500）向量恰為 [0,0,0] |
| acceleration 箭嘴 vector = [obs.a, 0, 0] | 通過 | 同上；凍結幀亦 = 段斜率／參數 a（v-zero-a-not 凍結 5001 幀 a 箭嘴 −9.81，v 箭嘴 −46.05） |
| 兩支箭嘴起點在小車：origin.x = obs.s（嚴格相等） | 通過 | 100 010 幀 `origin[0] === obs.s`，0 幀例外；origin.y 恆為 0.45（v）/ 0.75（a），z = 0 |
| 每幀恰有兩支箭嘴，kind / label / layer 正確 | 通過 | velocity→label "v"、layer "velocity"；acceleration→label "a"、layer "acceleration"；0 幀異常 |
| 同一 kind 縮放係數全程唯一 | 通過 | 每運行 scales.velocity = scales.acceleration = 0.25，10 001 幀不變；10 運行相同 |
| 同一幀內 v、a 兩支箭嘴同一比例 | 通過 | 10 運行 74 021 幀（v、a 皆非零者）(v 向量 × scales.velocity)/(a 向量 × scales.acceleration) 與 v/a 之差 0 |
| 應恆定的箭嘴（live 模式 a）每幀長度相同 | 通過 | 7 個 live 運行 \|a 箭嘴\| 極差 0（含凍結幀） |
| 應變化的箭嘴（v）變化率 = 模型 a | 通過 | live 運行 (vᵢ − vᵢ₋₁)/Δt 與 a 差 ≤ 5.9 × 10⁻¹²；draw 運行 below-axis 1.8 × 10⁻¹²、area-not-distance 1.3 × 10⁻⁹、random-2 2.2 × 10⁻¹⁰ |
| draw 模式 a 箭嘴 = 段斜率、在節點切換 | 通過 | area-not-distance：t ∈ [4, 5) a = −4，其餘 0；random-2：[0,3) 1、[3,5] 0；below-axis 全程 −0.4（節點幀 ±2 × 10⁻¹⁶） |
| 標籤 = obs（嚴格相等） | 通過 | 每幀 1 個標籤：symbol "s"、unit "m"、position.y −0.5；100 010 幀 `value === obs.s` 且 `position[0] === obs.s` |

### 3b. 截圖層（11 張新截圖，png5.js / png5b.js 量度；與第 5 輪比對）
軌道區（y 140–400、x 20–1050）綠色像素總數：desktop 416、ipad-landscape 1044（含該版面落入區內的 v–t 綠線 x 456–506 與 a–t 綠線 x 725–832，非箭嘴）、ipad-portrait 382、scenario-1-early 306、scenario-1-end 315、scenario-2-early 0、scenario-2-end 0、scenario-3-early 161、scenario-3-end 934、scenario-4-early 195、scenario-4-end 204。第 5 輪 scenario-1-end 315、scenario-4-end 204 相同；scenario-2 兩張 v = a = 0 故 0，正確。

| 截圖 | t（面板） | 箭嘴 | 第 6 輪量度（起點 → 尖端，px） | 第 5 輪 | 一致 |
|---|---|---|---|---|---|
| scenario-1-early | 0.311 s（同） | v 實線向右 | 591 → 634，43 px（列 y 272–275；箭頭 y 267–280；標籤「v」x 641–646） | 43 px | 是（相同） |
| scenario-1-early | | a 虛線向左 | 590 → 582，9 px 箭頭（列 y 249–250；標籤「a」x 570–576） | 9.5 px | 是（相同） |
| scenario-1-end | 10.0 s（同） | v 實線向左 | 533 → 488，45 px（列 y 272–275；箭頭 y 267–280 尖端 x 488；標籤「v」x 479–484） | 533 → 488，45 px | 是（逐像素相同） |
| scenario-1-end | | a 虛線向左 | 533 → 524，9.5 px（列 y 249–250；箭頭 y 243–256；標籤「a」x 513–518） | 533 → 524 | 是（逐像素相同） |
| scenario-3-early | 0.306 s（第 5 輪 0.308） | a 虛線向左 | 577 → 516，62 px（虛線節 522–577 每節 5 px 隔 5 px；箭頭 y 280–292 尖端 x 505–516；標籤「a」x 505–510） | 578 → 516，62 px | 是（a = −9.81 不變 → 長度不變） |
| scenario-3-early | | v | 未畫（\|v\| = 0.00186 m s⁻¹ × 6.32 px/unit = 0.01 px） | 未畫（0.14 px） | 是 |
| scenario-3-end | 5.00 s（同） | v 實線向左 | 276 → 37，239 px（列 y 309–311；箭頭 y 304–316；標籤「v」x 28–33） | 239 px | 是（逐像素相同） |
| scenario-3-end | | a 虛線向左 | 276 → 225，51 px（列 y 285–287；標籤「a」x 214–220）；畫布左上註「箭嘴已按邊緣空間同步縮短（比例不變）」 | 51 px | 是（逐像素相同）；239/51 = 4.69 對模型 46.05/9.81 = 4.694 |
| scenario-4-early | 0.308 s（第 5 輪 0.309） | v 實線向右 | 593 → 638，45 px（列 y 277–279；標籤「v」x 645–650）；a = 0 無 a 箭嘴 | 45 px | 是 |
| scenario-4-end | 10.0 s（同） | v 實線向左 | 438 → 393，45 px（列 y 277–279；箭頭 y 271–285；標籤「v」x 384–389）；a = 0 無 a 箭嘴 | 438 → 393，45 px | 是（逐像素相同） |
| desktop | 3.90 s（第 5 輪 3.88） | v 實線向右 | 897 → 983，86 px（列 y 286–288；箭頭 y 281–294；標籤「v」x 990–995） | 86 px（v 3.88） | 是：22.1 px/unit 對第 5 輪 22.2 |
| desktop | | a 虛線向右 | 897 → 919，22 px（節 897–902、907–912；箭頭 y 260–269 尖端 919；標籤「a」x 926–931） | 22–23 px | 是；86/22 = 3.91 對模型 v/a = 3.90 |
| ipad-landscape | 4.02 s（第 5 輪 4.30） | v 實線向右 | 879 → 968，89 px（列 y 179–181；箭頭 y 174–187；標籤「v」x 975–980） | 96 px（v 4.30） | 是：22.1 px/unit 對第 5 輪 22.3 |
| ipad-landscape | | a 虛線向右 | 879 → 901，22 px（節 879–884、889–894；箭頭 y 150–162 尖端 901；標籤「a」x 908–914） | 23 px | 是；89/22 = 4.05 對模型 4.02（a ±1 px → 3.9–4.2） |
| ipad-portrait | 3.88 s（同） | v 實線向右 | 631 → 708，77 px（列 y 241–243；箭頭 y 235–248；標籤「v」x 715–720） | 77 px | 是（相同） |
| ipad-portrait | | a 虛線向右 | 631 → 651，20 px（列 y 217–218；箭頭 y 212–224；標籤「a」x 657–663） | 20 px | 是；77/20 = 3.85 對 3.88 |

| 檢查 | 結果 | 證據 |
|---|---|---|
| 截圖箭嘴方向 = 模型符號 | 通過 | 上表 15 支箭嘴方向全部與同幀面板 v、a 的符號一致（r6-*.png 六張放大圖目視：箭頭指向與表列相同） |
| 截圖箭嘴外觀（§0.3）：v 綠實線、a 綠虛線、附箭頭與標籤 | 通過 | r6-s1end、r6-s1early、r6-s3early、r6-s3end、r6-desktop：v 實線 3 px 粗、a 虛線節 5 px 隔 5 px，兩者都有三角箭頭與斜體 v / a 標籤；r6-s4end 只有 v（a = 0） |
| 同一運行內 a 不變時 a 箭嘴長度 early = end | 通過 | scenario-1：9 / 9.5 px；scenario-3：62 px 對 51 px（縮短係數 0.82，51/0.82 = 62；同幀 v 亦同係數縮短，比例 4.69 保持） |
| v 箭嘴長度 ∝ \|v\|、同一運行比例恆定 | 通過 | 預設參數三張：desktop 86/3.90 = 22.1、ipad-landscape 89/4.02 = 22.1、ipad-portrait 77/3.88 = 19.8（畫布較窄）px/unit；draw 情境 v = 2.00 的三張 45 px、v = 1.88 的 43 px（22.5–22.9 px/unit）；情境 3 6.32 px/unit（a 62/9.81） |
| 軌道標籤與面板 s 同一幀 | 通過 | 11/11：desktop 7.60 / 7.60、ipad-landscape 8.06 / 8.06、ipad-portrait 7.54 / 7.54、s1-early 0.603 / 0.603、s1-end 0.00 / 0.00、s2-early 0.00 / 0.00、s2-end 0.00 / 0.00、s3-early 0.459 / 0.459、s3-end −108 / −108、s4-early 0.616 / 0.616、s4-end −2.00 / −2.00 |
| **圖內「斜率 =」「面積 =」標籤 = 同幀面板 v / a / s（本輪重點）** | **通過** | 見下表：24 個標籤 24 個一致；六個零值全部顯示「0.00」，無「-0.00」、無指數式、無殘餘 |
| 截圖讀數與我的模型（三位有效數字） | 通過 | desktop t = 3.90（導出 i = 3898–3900 皆為 s 7.60、v 3.90、平均 1.95）：s = ½t² = 7.60 ✓、平均 = t/2 = 1.95 ✓；ipad-landscape t = 4.02（i = 4016：s 8.06、v 4.02、平均 2.01）✓；ipad-portrait t = 3.88：7.54 ✓、1.94 ✓；s1-early t = 0.311：v = 2 − 0.4·0.311 = 1.876 → 1.88 ✓、s = 0.6027 → 0.603 ✓、平均 1.94 ✓；s1-end t = 10：s 0.00、d 10.0、v −2.00、a −0.400、面積 0.00、平均速率 1.00、平均速度 0.00 ✓；s2 兩張全 0.00 ✓；s3-early t = 0.306：v = 3 − 9.81·0.306 = −0.00186 ✓、s = 0.918 − 4.905·0.306² = 0.45872 → 0.459 ✓、d = 0.45872（反向於 0.30581 s，回程 1.8 × 10⁻⁷ m）→ 0.459 ✓、平均 1.499 → 1.50 ✓；s3-end t = 5：s −107.6 → −108 ✓、d 108.5 → 109 ✓、v −46.05 → −46.1 ✓、平均速率 21.7 ✓、平均速度 −21.5 ✓；s4-early t = 0.308：s = 2·0.308 = 0.616 ✓、面積 0.616 ✓、平均 2.00 ✓；s4-end t = 10：s −2.00、d 19.0、面積 −2.00、平均速率 1.90、平均速度 −0.200 ✓ |
| 座標軸「只放大不縮小」、畫圖模式 v ±5、a ±10 固定 | 通過 | desktop（s = 7.60）s ±10、v ±5、a ±2、軌道 ±10；ipad-landscape（s = 8.06）仍 ±10（第 5 輪 s = 9.24 時已放大到 ±20，本輪未到門檻，見 §7 第 7 點）；ipad-portrait ±10；s3-early s ±5、v ±5、a ±20、軌道 ±5；s3-end s ±200、v ±100、a ±20、軌道 ±200；draw 四張 v–t 縱軸 −5…5、a–t −10…10 |
| 播放列與「跳到 t =」 | 通過 | 11 張截圖畫布上方均有「暫停／播放」「逐格 0.1 s」「重播」「還原預設」「速度」「跳到 t =」滑桿與數字框（desktop 3.9、ipad-landscape 4.02、ipad-portrait 3.88、early 四張 0.31、s1/s2/s4-end 10、s3-end 5）；ipad-portrait 的「跳到 t =」換行至第二列 |

**圖內數值標籤逐張核對（本輪重點）**
| 截圖 | s–t 圖「斜率 =」 | 面板 v | v–t 圖「斜率 =」 | 面板 a | v–t 圖「面積 =」 | 面板 s | 一致 |
|---|---|---|---|---|---|---|---|
| desktop（3.90 s） | 3.90 m s⁻¹ | 3.90 | 1.00 m s⁻² | 1.00 | （圖層關） | 7.60 | 是 |
| ipad-landscape（4.02 s） | 4.02 m s⁻¹ | 4.02 | 1.00 m s⁻² | 1.00 | （關） | 8.06 | 是 |
| ipad-portrait（3.88 s） | 3.88 m s⁻¹ | 3.88 | 1.00 m s⁻² | 1.00 | （關） | 7.54 | 是 |
| scenario-1-early（0.311 s） | 1.88 m s⁻¹ | 1.88 | −0.400 m s⁻² | −0.400 | （關） | 0.603 | 是 |
| scenario-1-end（10.0 s，**s = 0**） | −2.00 m s⁻¹ | −2.00 | −0.400 m s⁻² | −0.400 | （關） | 0.00 | 是 |
| scenario-2-early（0.308 s，**s = 0**） | **0.00** m s⁻¹ | 0.00 | **0.00** m s⁻² | 0.00 | （關） | 0.00 | 是 |
| scenario-2-end（10.0 s，**s = 0**） | **0.00** m s⁻¹ | 0.00 | **0.00** m s⁻² | 0.00 | （關） | 0.00 | 是 |
| scenario-3-early（0.306 s） | −0.00186 m s⁻¹ | −0.00186 | −9.81 m s⁻² | −9.81 | （關） | 0.459 | 是 |
| scenario-3-end（5.00 s） | −46.1 m s⁻¹ | −46.1 | −9.81 m s⁻² | −9.81 | （關） | −108 | 是 |
| scenario-4-early（0.308 s） | 2.00 m s⁻¹ | 2.00 | **0.00** m s⁻² | 0.00 | 0.616 m | 0.616 | 是 |
| scenario-4-end（10.0 s） | −2.00 m s⁻¹ | −2.00 | **0.00** m s⁻² | 0.00 | −2.00 m | −2.00 | 是 |

## 4. 參數範圍與預設
**規格無參數表**（manifest.beyondSpec 已註明範圍由開發端定、待老師定奪）。controls.ts 檔案時間 16:53、scenarios.ts 16:03，六輪內容逐行相同；本輪重讀確認。

| 參數 | 規格 | controls.ts | 一致 / 評估 |
|---|---|---|---|
| mode | 「兩種操作模式：由運動生成圖／由圖生成運動」 | segment：live（由運動生成圖：我控制小車）、draw（由圖生成運動：我畫 v–t 圖），預設 live | 一致 |
| u 初速 | 無 | −5 至 5 m s⁻¹，步 0.5，預設 0，只在 live 顯示 | 合理：涵蓋正負初速 |
| a 加速度 | 無（迷思 3 需 9.81） | −10 至 10 m s⁻²，步 0.5，預設 1，只在 live 顯示 | 合理：涵蓋 ±9.81；情境 3 以 −9.81 覆寫（數字框顯示 −9.81，scenario-3-early.png） |
| T 時間窗 | 無 | select 5 / 10 / 20 s，預設 10 | 合理；極端 T = 20、u = 5、a = 10 時 v = 205 m s⁻¹、s = 2100 m，數值無問題 |
| vt（draw 折線節點） | 「在 v–t 圖上拖曳畫出線段」 | 不在 controls；預設 [0,1,2,3,3,3,2,1,0,0,0]（11 個整數秒節點，T = 5 時只用前 6 個） | 實作為每秒一節點折線，manifest.beyondSpec 已列待老師定奪 |
| g | §0.2：預設 9.81，可切 9.8 / 10 | 無 g 參數 | 本模擬器不含重力，a 由學生直接設定；可接受 |
| 預設 | — | mode live、u 0、a 1、T 10 | 與 desktop.png 一致（u 0、a 1、10 s） |

scenarios.ts 與規格「常見迷思與反駁設計」表逐行對應（四條四個情境），misconception 文字與規格原文一致。manifest.ts version 0.4.1，註釋記錄 0.4.1（meta 用歸零值、拖動改為按時間就近、還原預設不改播放狀態）、0.4.0、0.3.0、0.2.0 改動。

## 5. 學生應該看見的現象
規格無獨立「學生應該看見的現象」小節；以「常見迷思與反駁設計」表、「場景」、「即時顯示」及 §0.2/§0.3 逐項對照。截圖時刻：desktop t = 3.90 s（播放中 1×）、ipad-landscape 4.02 s、ipad-portrait 3.88 s、scenario-N-early t = 0.306–0.311 s（0.1× 播放中）、scenario-1/2/4-end t = 10.0 s、scenario-3-end t = 5.00 s（時間窗末端，已停，按鈕顯示「播放」）。

| # | 現象 | 截圖位置 | 看到 |
|---|---|---|---|
| 1 | v–t 線在軸以下時物體向反方向移動；另設 a–t 圖判別加速／減速 | scenario-1-end.png（t = 10.0 s）：v–t 圖 6–10 s 節點在軸下（−0.4 … −2）；小車回到 s = 0；小車上方 v 實線箭嘴向左（x 533 → 488）、a 虛線箭頭向左（533 → 524）；a–t 圖全程水平線於 −0.4；讀數 v = −2.00、a = −0.400、d 路程 10.0 m 對 s 0.00。scenario-1-early.png（0.311 s）小車向右、v 箭嘴向右 43 px、a 箭頭向左作對照 | 是 |
| 2 | 靜止時 s–t 為水平線，物體卻不在移動 | scenario-2-end.png（t = 10.0 s）：小車在 s = 0 不動；s–t 圖為 0 的水平線延伸到 t = 10 s；讀數 s、d、v、a 全為 0.00；「斜率 = 0.00」兩個；軌道區綠色像素 0（v = a = 0 無箭嘴）。scenario-2-early.png（0.308 s）同 | 是 |
| 3 | 速度為零時加速度仍為 9.81 m s⁻² | scenario-3-early.png（t = 0.306 s，比第 5 輪更接近 v = 0 的 0.30581 s）：讀數 v = −0.00186 m s⁻¹、a = −9.81 m s⁻²；s–t 圖「斜率 = −0.00186」切線幾乎水平、v–t 切線「斜率 = −9.81」正穿過零；a–t 圖水平線於 −9.81；小車上方虛線 a 箭嘴向左 62 px（r6-s3early-track.png），v 箭嘴 0.01 px 未畫出。同一運行終點 scenario-3-end.png 的 a 箭嘴未縮短長度亦為 62 px（§3），「加速度箭嘴長度不變」成立 | 是 |
| 4 | 面積在軸以下為負，總和是位移；另設路程讀數對照 | scenario-4-end.png（t = 10.0 s）：v–t 圖 0–4.5 s 軸上陰影（青）、4.5–10 s 軸下陰影（橙），「面積 = −2.00 m」；讀數「s 位移 −2.00 m」「d 路程 19.0 m」「v–t 線下面積 −2.00 m」；小車在 s = −2；小車上方 v 箭嘴向左（x 438 → 393）；s–t 圖先升至 8 m 再降到 −2 m；a–t 圖在 4–5 s 見 −4 的凹陷 | 是 |
| 5 | 場景：直軌道、小車、下方三個線圖 s–t、v–t、a–t | desktop.png：上方直軌道（−10 至 10 m 刻度）與小車，下方三圖 | 是 |
| 6 | 即時顯示：當前點切線（斜率） | desktop.png：s–t 圖「斜率 = 3.90 m s⁻¹」= v 讀數 3.90；v–t 圖「斜率 = 1.00 m s⁻²」= a；11 張 22 個斜率標籤全部與面板一致（§3 表） | 是 |
| 7 | 即時顯示：0 到當前時刻的線下面積（陰影） | scenario-4-end.png：0–10 s 正負兩色陰影、「面積 = −2.00 m」；scenario-4-early.png：0–0.308 s 陰影、「面積 = 0.616 m」 | 是 |
| 8 | 即時顯示：位移與路程兩個獨立讀數 | desktop.png「s 位移 7.60 m」「d 路程 7.60 m」；scenario-3-end.png「−108 m」「109 m」；scenario-4-end.png「−2.00 m」「19.0 m」；scenario-1-end.png「0.00 m」「10.0 m」 | 是 |
| 9 | 兩種操作模式 | desktop.png 模式「由運動生成圖：我控制小車」含 u、a 滑桿；scenario-1 / scenario-4 截圖模式「由圖生成運動：我畫 v–t 圖」，v–t 圖上有可拖節點與「上下拖動圓點改變該秒的 v（每格 0.5）」提示，u、a 滑桿隱藏 | 是 |
| 10 | §0.3：速度綠實線、加速度綠虛線 | r6-desktop-track.png、r6-s1end-track.png、r6-s1early-track.png、r6-s3early-track.png、r6-s3end-track.png | 是 |
| 11 | §0.2 第 5 條：向量以箭嘴表示（附箭頭） | 九張有非零 v 或 a 的截圖箭頭完整（含 scenario-1-end、scenario-4-end）；scenario-2 兩張 v = a = 0 無箭嘴 | 是 |
| 12 | §0.2 / §4.1：單位指數式、三位有效數字 | 所有截圖讀數：7.60 m、1.00 m s⁻²、−0.00186 m s⁻¹、−108 m、21.7 m s⁻¹ | 是 |
| 13 | 接近零的量顯示為 0.00（面板、軌道標籤、**圖內斜率標籤**） | 讀數面板：scenario-1-end s、面積、平均速度 0.00；scenario-2 全 0.00；軌道標籤 scenario-1-end、scenario-2 兩張「s = 0.00 m」；圖內「斜率 = 0.00」scenario-2 兩張各兩個、scenario-4 兩張 v–t 圖各一個，共六個，全是「0.00」 | 是 |
| 14 | 暫停與逐格、向量開關、數值面板、跳到 t、還原預設、重播 | desktop.png 畫布上方：「暫停」「逐格 0.1 s」「重播」「還原預設」「速度 1×」「跳到 t = 3.9」；顯示層開關「速度箭嘴」「加速度箭嘴」「切線（斜率）」「線下面積」；讀數面板 | 是 |
| 15 | 平均速率／平均速度符號不再同用 v̄ | 全部截圖讀數面板：「平均速率（路程 ÷ 時間）」「平均速度（位移 ÷ 時間）」，無符號 | 是 |
| 16 | 軌道標籤與讀數面板同步 | 11/11 截圖一致（§3） | 是 |
| 17 | 時間窗末端畫面 | scenario-1/2/4-end 讀數 t = 10.0 s、scenario-3-end t = 5.00 s；滑桿 100%、數字框 10 / 5；按鈕「播放」；數據末幀 t 恰為 10 / 5 | 是 |
| 18 | iPad 版面 | ipad-portrait.png、ipad-landscape.png：軌道、三圖、控制、讀數齊全；面板讀數與模型一致（t = 3.88 s：s = 7.54；t = 4.02 s：8.06）；v、a 箭嘴有箭頭有標籤；畫布寬度貼合 768 / 1024 版面 | 是 |
| 19 | 箭嘴長度隨速度增長（v 箭嘴）、加速度箭嘴恆定（a 箭嘴） | desktop v 3.90 → 86 px、ipad-landscape v 4.02 → 89 px（22.1 px/unit 兩者相同），a = 1 兩張都是 22 px；scenario-1 a 箭頭 early / end 9–9.5 px；scenario-3 a 早 62 px、末 62 px（縮短前） | 是 |

## 6. 守恆量與邊界
- 本模擬無守恆量（外加加速度的運動學）。可核的一致性：area ≡ s（100 010 幀差 0）；∫v dt 對 s 漂移 ≤ 3.4 × 10⁻¹¹ m（10 s）；v² = u² + 2as 漂移 ≤ 4.8 × 10⁻¹⁰。與第 5 輪相同。
- a = 0、u = 0（scenario-st-not-path）：10 001 幀全部讀數恰為 0，無 NaN；末幀 t = 10 恰為整數。
- F6 歸零門檻 10⁻⁹ m：本數據內最小的非零 |s| 是 default i = 1 的 5 × 10⁻⁷ m，draw 運行 i = 1 的 2 × 10⁻³ m；最小非零 |v| 是 v-zero-a-not i = 306 的 1.86 × 10⁻³ m s⁻¹（本輪 scenario-3-early.png 正是此幀，面板與圖內標籤均顯示 −0.00186，證明歸零門檻沒有把真實的小量誤歸零）。極端情況：live 模式 a = 0.5、u = 0 時 s(0.001) = 2.5 × 10⁻⁷ m，仍高於門檻 250 倍。
- draw 模式 T = 5 而 vt 有 11 節點（random-2）：只用前 6 節點，t = 5 凍結 a = 段 [4,5] 斜率 0，s = 10.5、路程 10.5，無 NaN。draw 模式 T = 10 的末節點（below-axis、area-not-distance）：t = 10 幀 a 分別為 −0.4、0（末段斜率），不是 NaN。
- 參數極端（解析估算，數據內無此運行）：u = ±5、a = ±10、T = 20 → |v| ≤ 205 m s⁻¹、|s| ≤ 2100 m；數值上無溢出。random-3（a = 9.68、T = 5）已見 s = 135.6 m、v = 51.3 m s⁻¹ 正常；scenario-3 軌道軸自動放大到 ±200 m。
- 時間窗末端：t ≥ T 後 t、全部八讀數、兩支箭嘴向量、標籤全部凍結，T = 5 運行 5001 幀 JSON 逐字相同；a 保持參數值／末段斜率。
- 箭嘴像素邊界：scenario-3 末端小車距左邊 259 px，未縮短 v 箭嘴 291 px，縮至 239 px（末端 x 37，在畫布內邊 x 17 之內），a 同步縮至 51 px，畫布註記顯示。其餘十張截圖箭嘴未觸及邊緣、未縮短（scenario-1-end v 箭嘴末端 x 488 距左邊 470 px；desktop v 箭嘴末端 x 983 距右邊 x 1050 有 67 px）。
- 箭嘴比例規則（由參數決定）：由截圖反推每 m s⁻¹（或 m s⁻²）像素：vmax = 2 的 draw 情境 22.5–22.9 px；預設（vmax = 10）desktop 22.1、ipad-landscape 22.1、ipad-portrait 19.8；vmax = 46.05 的情境 3 為 6.32 px。同一運行內（early 對 end、desktop 對 landscape）恆定；本輪 desktop 與 ipad-landscape 時刻與第 5 輪不同而每單位像素不變，再次證實比例只由參數決定。

## 7. 規格待釐清
1. draw 模式 vt 節點數（T + 1 = 11 對應 T = 10）多於時間窗（T = 5）時，實作只用前 T + 1 個節點，t = T 的凍結 a 取窗內末段斜率（random-2 得 0，而非 vt[5]→vt[6] 的 −1）。本核數按此解讀通過；建議 manifest 或規格說明「時間窗外的節點不生效」。
2. random-2 的 params 同時記錄 u = 2.838、a = −3.337（draw 模式下不生效）；導出器宜只記錄生效參數，或註明。
3. 驗證條件三「從未反向時位移讀數與路程讀數必須相等」：物體一直向負方向走時 s = −路程（random-4 全程、random-1 反向前）。本核數以「大小相等」解讀（通過）。建議規格改為「數值上 |s| = 路程」或說明正方向約定。
4. 「由圖生成運動：學生在 v–t 圖上拖曳畫出線段」：實作是每秒一個節點的折線（manifest 已列 beyondSpec；0.4.1 改為在圖框內任何位置按下即拖動時間最接近的節點，仍是折線）。折線在節點處 a 不連續（scenario-4 於 t ∈ [4, 5) a = −4，其餘 0），a–t 圖出現垂直跳變，是否可接受待老師定奪。
5. 導出的 plan().scales（velocity = acceleration = 0.25，10 運行全同、全程不變）與畫面實際像素比例無關（畫面每 m s⁻¹ 像素由 6.32 到 22.9 不等）。畫面比例已由截圖量度證實符合「運行內恆定、v/a 比例正確」，但若 scales 欄位意在讓核數員核對畫面比例，建議輸出每幀實際採用的像素比例（含邊緣縮短係數）。
6. 接近零的 v 箭嘴：scenario-3-early.png v = −0.00186 m s⁻¹（0.01 px）未畫出。物理上 |v| ≈ 0 不畫是合理的，但規格沒有規定接近零的箭嘴要不要畫、門檻多少，待老師定奪。
7. 軌道座標軸放大時機：第 5 輪 ipad-landscape.png 在 s = 9.24 m 時已由 ±10 放大到 ±20，本輪 ipad-landscape s = 8.06 m 與 desktop s = 7.60 m 仍為 ±10；即門檻在 8.06 與 9.24 m 之間（約 ±10 的 90%）。「只放大不縮小」成立；放大門檻規格未定，記錄備查。
8. **（本輪新增）** 0.4.1 的「plan 的 meta（畫面用的 s、v、a）改為與讀數面板同一來源」：導出幀沒有 `meta` 欄位（0/100 010 幀），本核數只能由 11 張截圖的 24 個圖內標籤與面板逐字一致來間接證實（§3 表）。若日後仍有畫面層改動，建議導出器把 meta 一併輸出，讓「圖內標籤 = 面板 = obs」可由數據逐幀核對而不限於截圖時刻。
9. **（本輪新增，非物理項）** 0.4.1 的四項互動行為——畫圖模式圖框內按任何位置拖動最接近的節點、「還原預設」不改播放狀態、「跳到 t」數字框 Enter 收起焦點、每幀推進上限 1 s——屬互動層，靜態數據與截圖無法核對，本核數未核；請由學生測試報告（student-test）覆蓋。「畫布監聽容器尺寸重繪」只見於 ipad 兩張畫布寬度貼合版面，未測試動態改變尺寸。

---
核數程式與逐運行完整結果：`C:\Users\trevor\AppData\Local\Temp\claude\C--Users-trevor-OneDrive-DSE-Physics-Lab\518529cb-95ec-48b7-b334-4ccdcf91c4a5\scratchpad\audit6.js`、`audit6-out.json`、`audit6-console.txt`（末段含與第 5 輪的深度比對結果與 meta 掃描）；第 5 輪結果 `audit5-out.json` 供比對；截圖像素掃描 `png5.js`（區域統計）、`png5b.js`（逐行線段）原樣重用；放大圖 `r6-s1end-track.png`、`r6-s1early-track.png`、`r6-s4end-track.png`、`r6-s3early-track.png`、`r6-s3end-track.png`、`r6-desktop-track.png`（由 `crop6.ps1` 產生）。
