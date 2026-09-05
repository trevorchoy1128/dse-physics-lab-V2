# 第二實作比對：motion-graphs-synced-with-real-motion（#023）

積分方法：解析逐段積分（兩種模式下 v(t) 都是分段線性，每段 s 為精確二次式 s = v₀τ + ½mτ²；路程在段內以 v = 0 的交叉點 τ* = −v₀/m 分割後取絕對值相加，不用數值積分）。幀時刻以整數除法 t_k = k / 1000 產生，避免累加誤差。
步長：dt = 0.001 s（取自 index.json）。幀數：10001（t = 0 … 10 s）。
運行：index.json 全部 10 個（live × 7、draw × 3）。
實作檔：`second-impl/model.mjs`（模型）、`run.mjs`（產生各運行 JSON）、`compare.mjs`（逐幀比對，結果在 `compare-result.json`）、`checks.mjs`（額外檢查，輸出在 `checks-output.txt`）。

第二實作採用的慣例（規格未寫明，由 controls.ts / index.json 與參數語義推得）：
- live：a 恆定、初速 u；v = u + at，s = ut + ½at²。
- draw：vt[i] 為 t = i s 的節點，段內線性插值，a 為該段斜率；超出末節點後 v 保持末值、a = 0。
- t ≥ T 後運動停止，狀態凍結於 t = T，a 讀數為 0。
- area = s（v–t 線下含號面積），speed = |v|，avgSpeed = dist / t，avgVel = s / t，t = 0 時兩者取 0。

## 結論

**一致。** 10 個運行 × 8 個 key × 10001 幀全部在容限內（全部量皆有解析解，容限 1e-6）。最大絕對誤差 1.4e-11（random-1 的 s / area，|s| 量級 ~250 m，屬雙精度累積誤差）。a 沒有任何一幀差異，包括 draw 模式的節點跳變幀，故事件時刻容限（2 dt）未動用。幀時刻 t 最大差 1.0e-12（主實作用累加 t，本實作用 k/1000）。

## 逐鍵比對

（相對誤差以 |Δ| / max(|主|, |第二|) 計；通過準則為絕對誤差 ≤ 1e-6 **或** 相對誤差 ≤ 1e-6。表中 scenario-below-axis、scenario-area-not-distance 的 s / area / v / avgVel 出現 0.07–0.7 的「最大相對誤差」，全部發生在該量穿越零的幀（|值| ~ 1e-13、絕對差 ~ 7e-13），是相對誤差的分母趨零所致，不是真差異。「(t)」列為幀時刻的比對。）

| 運行 | key | 最大絕對誤差 | 最大相對誤差 | 首次超限 t | 通過 |
|---|---|---|---|---|---|
| default | s | 1.80e-12 | 6.27e-14 | — | 是 |
| default | dist | 1.80e-12 | 6.27e-14 | — | 是 |
| default | v | 1.01e-12 | 1.26e-13 | — | 是 |
| default | a | 0.00e+0 | 0.00e+0 | — | 是 |
| default | speed | 1.01e-12 | 1.26e-13 | — | 是 |
| default | area | 1.80e-12 | 6.27e-14 | — | 是 |
| default | avgSpeed | 3.95e-13 | 9.87e-14 | — | 是 |
| default | avgVel | 3.95e-13 | 9.87e-14 | — | 是 |
| default | (t) | 1.01e-12 | 0.00e+0 | — | 是 |
| scenario-below-axis | s | 7.15e-13 | 7.09e-1 | — | 是 |
| scenario-below-axis | dist | 1.25e-12 | 1.41e-13 | — | 是 |
| scenario-below-axis | v | 4.03e-13 | 1.78e-3 | — | 是 |
| scenario-below-axis | a | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-below-axis | speed | 4.03e-13 | 1.78e-3 | — | 是 |
| scenario-below-axis | area | 7.15e-13 | 7.09e-1 | — | 是 |
| scenario-below-axis | avgSpeed | 1.48e-13 | 1.34e-13 | — | 是 |
| scenario-below-axis | avgVel | 1.48e-13 | 7.09e-2 | — | 是 |
| scenario-below-axis | (t) | 1.01e-12 | 0.00e+0 | — | 是 |
| scenario-st-not-path | s | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-st-not-path | dist | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-st-not-path | v | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-st-not-path | a | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-st-not-path | speed | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-st-not-path | area | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-st-not-path | avgSpeed | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-st-not-path | avgVel | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-st-not-path | (t) | 1.01e-12 | 0.00e+0 | — | 是 |
| scenario-v-zero-a-not | s | 7.09e-12 | 2.18e-12 | — | 是 |
| scenario-v-zero-a-not | dist | 7.06e-12 | 6.52e-14 | — | 是 |
| scenario-v-zero-a-not | v | 4.87e-12 | 2.15e-12 | — | 是 |
| scenario-v-zero-a-not | a | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-v-zero-a-not | speed | 4.87e-12 | 2.15e-12 | — | 是 |
| scenario-v-zero-a-not | area | 7.09e-12 | 2.18e-12 | — | 是 |
| scenario-v-zero-a-not | avgSpeed | 2.15e-12 | 1.27e-13 | — | 是 |
| scenario-v-zero-a-not | avgVel | 2.13e-12 | 2.18e-12 | — | 是 |
| scenario-v-zero-a-not | (t) | 3.30e-13 | 0.00e+0 | — | 是 |
| scenario-area-not-distance | s | 6.59e-13 | 6.48e-1 | — | 是 |
| scenario-area-not-distance | dist | 2.01e-12 | 1.26e-13 | — | 是 |
| scenario-area-not-distance | v | 1.32e-12 | 6.50e-1 | — | 是 |
| scenario-area-not-distance | a | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-area-not-distance | speed | 1.32e-12 | 6.50e-1 | — | 是 |
| scenario-area-not-distance | area | 6.59e-13 | 6.48e-1 | — | 是 |
| scenario-area-not-distance | avgSpeed | 7.53e-14 | 4.00e-14 | — | 是 |
| scenario-area-not-distance | avgVel | 7.24e-14 | 7.20e-2 | — | 是 |
| scenario-area-not-distance | (t) | 1.01e-12 | 0.00e+0 | — | 是 |
| random-0 | s | 2.34e-12 | 3.47e-14 | — | 是 |
| random-0 | dist | 2.34e-12 | 3.47e-14 | — | 是 |
| random-0 | v | 3.72e-12 | 7.73e-14 | — | 是 |
| random-0 | a | 0.00e+0 | 0.00e+0 | — | 是 |
| random-0 | speed | 3.72e-12 | 7.73e-14 | — | 是 |
| random-0 | area | 2.34e-12 | 3.47e-14 | — | 是 |
| random-0 | avgSpeed | 2.31e-12 | 1.12e-13 | — | 是 |
| random-0 | avgVel | 2.31e-12 | 1.12e-13 | — | 是 |
| random-0 | (t) | 3.30e-13 | 0.00e+0 | — | 是 |
| random-1 | s | 1.43e-11 | 9.51e-11 | — | 是 |
| random-1 | dist | 1.42e-11 | 6.34e-14 | — | 是 |
| random-1 | v | 5.58e-12 | 3.43e-11 | — | 是 |
| random-1 | a | 0.00e+0 | 0.00e+0 | — | 是 |
| random-1 | speed | 5.58e-12 | 3.43e-11 | — | 是 |
| random-1 | area | 1.43e-11 | 9.51e-11 | — | 是 |
| random-1 | avgSpeed | 1.65e-12 | 8.87e-14 | — | 是 |
| random-1 | avgVel | 1.66e-12 | 9.52e-11 | — | 是 |
| random-1 | (t) | 1.01e-12 | 0.00e+0 | — | 是 |
| random-2 | s | 2.17e-13 | 4.82e-14 | — | 是 |
| random-2 | dist | 2.17e-13 | 4.82e-14 | — | 是 |
| random-2 | v | 2.19e-13 | 7.32e-14 | — | 是 |
| random-2 | a | 0.00e+0 | 0.00e+0 | — | 是 |
| random-2 | speed | 2.19e-13 | 7.32e-14 | — | 是 |
| random-2 | area | 2.17e-13 | 4.82e-14 | — | 是 |
| random-2 | avgSpeed | 1.29e-13 | 6.87e-14 | — | 是 |
| random-2 | avgVel | 1.29e-13 | 6.87e-14 | — | 是 |
| random-2 | (t) | 3.30e-13 | 0.00e+0 | — | 是 |
| random-3 | s | 2.36e-12 | 3.21e-14 | — | 是 |
| random-3 | dist | 2.36e-12 | 3.21e-14 | — | 是 |
| random-3 | v | 5.12e-12 | 9.97e-14 | — | 是 |
| random-3 | a | 0.00e+0 | 0.00e+0 | — | 是 |
| random-3 | speed | 5.12e-12 | 9.97e-14 | — | 是 |
| random-3 | area | 2.36e-12 | 3.21e-14 | — | 是 |
| random-3 | avgSpeed | 1.53e-12 | 6.88e-14 | — | 是 |
| random-3 | avgVel | 1.53e-12 | 6.88e-14 | — | 是 |
| random-3 | (t) | 3.30e-13 | 0.00e+0 | — | 是 |
| random-4 | s | 3.72e-12 | 4.57e-14 | — | 是 |
| random-4 | dist | 3.72e-12 | 4.57e-14 | — | 是 |
| random-4 | v | 2.03e-12 | 7.26e-14 | — | 是 |
| random-4 | a | 0.00e+0 | 0.00e+0 | — | 是 |
| random-4 | speed | 2.03e-12 | 7.26e-14 | — | 是 |
| random-4 | area | 3.72e-12 | 4.57e-14 | — | 是 |
| random-4 | avgSpeed | 7.60e-13 | 5.43e-14 | — | 是 |
| random-4 | avgVel | 7.60e-13 | 5.43e-14 | — | 是 |
| random-4 | (t) | 3.30e-13 | 0.00e+0 | — | 是 |

## 不一致的判斷

無不一致。以下是為排除「兩者同時錯」而做的獨立核對（不依賴主實作）：
- scenario-area-not-distance（vt 由 +2 跳到 −2 於第 4–5 s 段）：手算 t = 4.999 s：s = 8 + (2·0.999 − 2·0.999²) = 8.001998；dist = 8 + 0.5 + |0.998 − 2(0.999² − 0.25)| = 8.998002。主實作與第二實作均得此值。
- scenario-v-zero-a-not（u = 3, a = −9.81）：反向時刻 t* = 3/9.81 = 0.30581 s，最高點 s* = 9/(2·9.81) = 0.458716；t = 0.306 s 時 dist = 2s* − s(0.306) = 0.4587158，兩者一致，顯示主實作在步內處理了零交叉點而非用 Σ|v|dt 近似。
- 主實作 v 在 t = T 時與解析值差 ~3e-13，推測其 v 為逐步累加；差異遠低於容限。

## 額外檢查

### 量綱
- 參數單位：u [m s⁻¹]、a [m s⁻²]、T [s]、vt [m s⁻¹]；輸出 s、dist、area [m]，v、speed、avgSpeed、avgVel [m s⁻¹]，a [m s⁻²]。方程 s = ut + ½at² 每項均為 [m]；v² = u² + 2as 每項均為 [m² s⁻²]。
- 數值驗證：把長度單位換成 cm（×100）、時間換成 ms（×1000），即 u → u·100/1000、a → a·100/1000²、T → T·1000，第二實作各輸出按各自量綱縮放（s×100、v×0.1、a×1e-4）——通過。draw 模式只縮放長度（節點固定於整數秒）——通過。

### 對稱
- 反號對稱：(u, a) → (−u, −a) 或 vt → −vt 時，s、v、a、avgVel 反號，dist、speed、avgSpeed 不變——live 與 draw 均通過（含反向時刻與 t = T 的幀）。
- 時間鏡像：scenario-below-axis 的 vt 對 t = 5 s 奇對稱，故 s(5+τ) = s(5−τ)、s(10) = 0、dist(10) = 10 m——通過；主實作數據 s(10) = 8.9e-14（≈0）、dist(10) = 10.000。

### 極限
- a = 0：s = ut 線性、dist = |u|t、a 讀數 0——通過。
- u = 0、a 恆定：s = ½at²、v² = 2as——通過。
- 一般 (u, a)：v = u + at、s = ut + ½at²、v² = u² + 2as 三式互相一致——通過（亦以主實作全部 live 運行的每一幀驗證通過）。
- draw 每段 s 為二次：在每段取 τ = 0, 0.25, 0.5 三點以二階差分預測 τ = 0.75，吻合；二階差分 / h² = 段斜率 = a 讀數——通過。
- draw 超出末節點（T = 20、vt 只有 3 節點）：v 保持末值、a = 0、s 線性——通過。
- t = 0：s = dist = area = avgSpeed = avgVel = 0，v = u，a = a——通過。
- a 極大（1e6）：s = ½·1e6·2² = 2e6——通過。靜止（u = a = 0）：s = dist = v = 0，s–t 為水平線——通過（對應規格「s–t 圖不是路徑」迷思）。

### 規格驗證條件（用主實作輸出逐幀檢驗）
- v–t 線下面積 = s–t 位移：每幀 area === s——10 運行全部通過。
- 勻加速三式互相一致——全部 live 運行通過。
- 未反向時 dist = |s|、反向後 dist > |s|——全部運行通過（反向的 4 個運行：scenario-below-axis 於 t = 5 s、scenario-v-zero-a-not 於 0.306 s、scenario-area-not-distance 於 4.501 s、random-1 於 0.845 s；未反向的 6 個運行全程 dist = |s|）。
- 另：speed = |v|、avgSpeed·t = dist、avgVel·t = s——全部通過。

### 檢查腳本本身的修正
checks.mjs 初版把「是否已反向」的判斷放在 dist/|s| 檢查之後，導致反向後第一幀被當作未反向而誤報 3 個運行；改為先判斷再檢查後全部通過。這是檢查腳本的錯，與兩個實作無關，記錄以供覆核。

## 規格待釐清
1. 規格沒有參數表；u、a 範圍、T 選項、draw 模式節點間距（1 s）與節點數（11）皆由開發端定（controls.ts 已註明待老師定奪）。
2. t ≥ T 後的行為：主實作凍結狀態並把 a 讀數設為 0；規格未寫。若教學上希望 a–t 圖在 T 之後仍顯示最後一段的 a（例如豎直上拋停在 T = 5 s 時仍顯示 −9.81），需要老師定奪。
3. draw 模式當 T = 20 s 而 vt 只有 11 個節點（0–10 s）時，10 s 之後 v 保持末值——本實作與主實作一致，但規格未寫；替代方案是 v = 0（小車停下）。
4. avgSpeed / avgVel 在 t = 0 的取值（本實作與主實作均取 0）；規格未定義這兩個讀數。
5. draw 模式節點處 a 不連續，a 讀數在整數秒取右段斜率（主實作與本實作一致）；規格未寫，但只影響單一幀的顯示。
