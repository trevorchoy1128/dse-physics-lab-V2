# 第二實作比對：motion-graphs-synced-with-real-motion（#023）— 第 2 輪

積分方法：解析逐段積分（兩種模式下 v(t) 都是分段線性，每段 s 為精確二次式 s = v₀τ + ½mτ²；路程在段內以 v = 0 的交叉點 τ* = −v₀/m 分割後取絕對值相加，不用數值積分）。幀時刻以整數除法 t_k = k / 1000 產生，避免累加誤差。
步長：dt = 0.001 s（取自 index.json）。幀數：10001（t = 0 … 10 s）。
運行：index.json 全部 10 個（live × 7、draw × 3；mode = null 的 5 個 random 運行按 live 處理，與主實作輸出吻合）。
實作檔：`second-impl/model.mjs`（模型）、`run.mjs`（產生各運行 JSON）、`compare.mjs`（逐幀比對，結果在 `compare-result.json`）、`checks.mjs`（額外檢查，輸出在 `checks-output.txt`）。

## 第 2 輪改動

第 1 輪「規格待釐清」第 2 點（核數員 F1）：主實作已改為 t ≥ T 畫面凍結後 a 讀數**保持 T⁻ 的值**而不歸零。第二實作對應修改（`model.mjs` 新增 `aLeft(p, T)`）：
- live：a(T⁻) = 參數 a（恆定）。
- draw：a(T⁻) = 包含 T⁻ 的那一段折線的斜率，即段 ⌈T⌉−1 的斜率 vt[seg+1] − vt[seg]；T 超出末節點則為 0。
其他慣例不變：t ≥ T 狀態凍結於 t = T；draw 節點 vt[i] 在 t = i s，段內線性插值，超出末節點 v 保持末值、a = 0；area = s，speed = |v|，avgSpeed = dist/t，avgVel = s/t，t = 0 時取 0。

主實作重新導出的 10 個運行（10001 幀）已全部重新比對。

## 結論

**一致。** 10 個運行 × 8 個 key × 10001 幀全部在容限內（全部量皆有解析解，容限 1e-6）。最大絕對誤差 1.4e-11（random-1 的 s / area，|s| ~ 220 m，雙精度累積誤差）。a 沒有任何一幀差異（含凍結後的 5001 幀與 draw 節點跳變幀），事件時刻容限（2 dt）未動用。幀時刻 t 最大差 1.0e-12。

### 每個運行最後一幀的 a 與 v（主實作數據；第二實作的同一檢查亦全部通過，見 checks-output.txt）

判準：(a) 凍結後所有幀 a、v、s 完全不變；(b) a(T) = a(T − dt)，即 a 跨越 T 不跳變、保持 T⁻ 值；(c) live 的 v_last = u + aT、a_last = a；draw 的 a_last = 折線末段斜率、v_last = 末節點值；(d) 凍結前最後兩幀的差分斜率 (v(T) − v(T−dt))/dt = a_last。

- 主實作 default： 凍結後狀態不變:true a(T)=a(T−dt):true a_last=1.000000 期望 1.000000:true v_last=10.000000 期望(v = u + aT) 10.000000:true 差分斜率 1.000000=a_last:true
- 主實作 scenario-below-axis： 凍結後狀態不變:true a(T)=a(T−dt):true a_last=-0.400000 期望 -0.400000:true v_last=-2.000000 期望(折線末段斜率) -2.000000:true 差分斜率 -0.400000=a_last:true
- 主實作 scenario-st-not-path： 凍結後狀態不變:true a(T)=a(T−dt):true a_last=0.000000 期望 0.000000:true v_last=0.000000 期望(v = u + aT) 0.000000:true 差分斜率 0.000000=a_last:true
- 主實作 scenario-v-zero-a-not： 凍結後狀態不變:true a(T)=a(T−dt):true a_last=-9.810000 期望 -9.810000:true v_last=-46.050000 期望(v = u + aT) -46.050000:true 差分斜率 -9.810000=a_last:true
- 主實作 scenario-area-not-distance： 凍結後狀態不變:true a(T)=a(T−dt):true a_last=0.000000 期望 0.000000:true v_last=-2.000000 期望(折線末段斜率) -2.000000:true 差分斜率 0.000000=a_last:true
- 主實作 random-0： 凍結後狀態不變:true a(T)=a(T−dt):true a_last=8.954050 期望 8.954050:true v_last=48.110196 期望(v = u + aT) 48.110196:true 差分斜率 8.954050=a_last:true
- 主實作 random-1： 凍結後狀態不變:true a(T)=a(T−dt):true a_last=5.315743 期望 5.315743:true v_last=48.668986 期望(v = u + aT) 48.668986:true 差分斜率 5.315743=a_last:true
- 主實作 random-2： 凍結後狀態不變:true a(T)=a(T−dt):true a_last=-3.337068 期望 -3.337068:true v_last=-13.847335 期望(v = u + aT) -13.847335:true 差分斜率 -3.337068=a_last:true
- 主實作 random-3： 凍結後狀態不變:true a(T)=a(T−dt):true a_last=9.677692 期望 9.677692:true v_last=51.315507 期望(v = u + aT) 51.315507:true 差分斜率 9.677692=a_last:true
- 主實作 random-4： 凍結後狀態不變:true a(T)=a(T−dt):true a_last=-4.675829 期望 -4.675829:true v_last=-28.038055 期望(v = u + aT) -28.038055:true 差分斜率 -4.675829=a_last:true

補充：主實作以累加產生 t，T = 10 的 5 個運行最後一幀 t = 9.999999999999897（< T，尚未凍結），T = 5 的 5 個運行 t = 5.000000000000004（已凍結，之後 5001 幀狀態全等）。兩種情形 a 均與 T⁻ 一致，故不影響比對。

## 逐鍵比對

（相對誤差以 |Δ| / max(|主|, |第二|) 計；通過準則為絕對誤差 ≤ 1e-6 **或** 相對誤差 ≤ 1e-6。scenario-below-axis、scenario-area-not-distance 與 random-2 的 s / area / v / avgVel 出現較大「最大相對誤差」，全部發生在該量穿越零的幀（|值| ~ 1e-13、絕對差 ~ 1e-12），是分母趨零所致，不是真差異。「(t)」列為幀時刻的比對。）

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
| random-2 | s | 2.29e-13 | 1.81e-10 | — | 是 |
| random-2 | dist | 2.74e-13 | 1.70e-14 | — | 是 |
| random-2 | v | 5.29e-13 | 2.10e-11 | — | 是 |
| random-2 | a | 0.00e+0 | 0.00e+0 | — | 是 |
| random-2 | speed | 5.29e-13 | 2.10e-11 | — | 是 |
| random-2 | area | 2.29e-13 | 1.81e-10 | — | 是 |
| random-2 | avgSpeed | 2.99e-13 | 7.34e-14 | — | 是 |
| random-2 | avgVel | 2.61e-13 | 1.81e-10 | — | 是 |
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

無不一致。獨立核對（不依賴主實作）：
- 凍結後 a 保持 T⁻ 值：scenario-v-zero-a-not（u = 3, a = −9.81, T = 5）凍結後 a = −9.81、v = 3 − 9.81×5 = −46.05、s = 15 − 122.625 = −107.625；主實作最後一幀 a = −9.81、v = −46.0500000000049、s = −107.6250000000071，與解析值一致。
- scenario-below-axis（draw, T = 10）：末段斜率 (−2) − (−1.6) = −0.4，主實作最後一幀 a = −0.4、v = −2.0；s(10) = 0（奇對稱折線），主實作 s = −7.1e-13。
- scenario-area-not-distance（vt 由 +2 跳到 −2 於第 4–5 s 段）：t = 4.999 s 手算 s = 8.001998、dist = 8.998002，兩實作均得此值。
- scenario-v-zero-a-not 反向時刻 t* = 3/9.81 = 0.30581 s，最高點 s* = 0.458716 m；t = 0.306 s 時 dist = 2s* − s(0.306) = 0.4587158，兩者一致（主實作在步內處理零交叉點）。

## 額外檢查

### 量綱
- 參數單位：u [m s⁻¹]、a [m s⁻²]、T [s]、vt [m s⁻¹]；輸出 s、dist、area [m]，v、speed、avgSpeed、avgVel [m s⁻¹]，a [m s⁻²]。s = ut + ½at² 每項 [m]；v² = u² + 2as 每項 [m² s⁻²]。
- 數值驗證：長度換 cm（×100）、時間換 ms（×1000），各輸出按各自量綱縮放（s×100、v×0.1、a×1e-4）——通過。draw 只縮放長度——通過。

### 對稱
- 反號對稱：(u, a) → (−u, −a) 或 vt → −vt 時，s、v、a、avgVel 反號，dist、speed、avgSpeed 不變——live 與 draw 均通過（含反向時刻與 t = T 的幀；t = T 幀現在 a 為 T⁻ 值，反號對稱仍成立）。
- 時間鏡像：scenario-below-axis 的 vt 對 t = 5 s 奇對稱，s(5+τ) = s(5−τ)、s(10) = 0、dist(10) = 10 m——通過。

### 極限
- a = 0：s = ut、dist = |u|t、a 讀數 0——通過。
- u = 0：s = ½at²、v² = 2as——通過。
- 一般 (u, a)：v = u + at、s = ut + ½at²、v² = u² + 2as 互相一致——通過（亦以主實作全部 live 運行每一幀驗證）。
- draw 每段 s 為二次：二階差分預測第四點吻合；二階差分 / h² = 段斜率 = a 讀數——通過。
- draw 超出末節點（T = 20、3 節點）：v 保持末值、a = 0、s 線性——通過。
- t = 0：s = dist = area = avgSpeed = avgVel = 0，v = u，a = a——通過。
- a 極大（1e6）：s = 2e6——通過。靜止（u = a = 0）：s = dist = v = 0——通過。

### 規格驗證條件（用主實作輸出逐幀檢驗）
- v–t 線下面積 = s–t 位移（area === s）——10 運行全部通過。
- 勻加速三式互相一致——全部 live 運行通過。
- 未反向時 dist = |s|、反向後 dist > |s|——全部通過（反向的 5 個運行：scenario-below-axis 5 s、scenario-v-zero-a-not 0.306 s、scenario-area-not-distance 4.501 s、random-1 0.845 s、random-2 0.851 s）。
- speed = |v|、avgSpeed·t = dist、avgVel·t = s——全部通過。

## 規格待釐清
1. （第 1 輪第 2 點，已由主實作按核數員 F1 處理）凍結後 a 保持 T⁻ 值——兩實作現已一致；仍建議在規格寫明。
2. **未被運行覆蓋的情形**：draw 模式且 T 恰落在折線節點而非末節點（例如 T = 5、11 個節點）時，T⁻ 取左段斜率 vt[5] − vt[4]、而未凍結時 t = 5 幀取右段斜率 vt[6] − vt[5]；本實作採左段。index.json 沒有 draw + T = 5 的運行，主實作此情形的取法未經比對，建議補一個運行。
3. 規格沒有參數表；u、a 範圍、T 選項、draw 節點間距（1 s）與節點數（11）皆由開發端定。
4. draw 模式 T = 20 而 vt 只到 10 s 時，10 s 後 v 保持末值（兩實作一致，規格未寫；替代方案是 v = 0）。
5. avgSpeed / avgVel 在 t = 0 取 0（兩實作一致，規格未定義）。
6. draw 節點處 a 不連續，未凍結時整數秒幀取右段斜率（兩實作一致）。
