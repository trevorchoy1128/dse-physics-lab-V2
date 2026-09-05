# 第二實作比對：motion-graphs-synced-with-real-motion（#023）— 第 4 輪

積分方法：解析逐段積分（兩種模式下 v(t) 都是分段線性，每段 s 為精確二次式 s = v₀τ + ½mτ²；路程在段內以 v = 0 的交叉點 τ* = −v₀/m 分割後取絕對值相加，不用數值積分）。幀時刻以整數除法 t_k = k / 1000 產生，避免累加誤差。
步長：dt = 0.001 s（取自 index.json）。幀數：10001（t = 0 … 10 s）。
運行：index.json 全部 10 個（live × 7：default、scenario-st-not-path、scenario-v-zero-a-not、random-0/1/3/4；draw × 3：scenario-below-axis、scenario-area-not-distance、**random-2**）。
實作檔：`second-impl/model.mjs`（模型；第 4 輪加入 `snapZero()` 顯示層歸零函式，observe 本身仍輸出純解析值）、`run.mjs`（產生各運行 JSON）、`compare.mjs`（逐幀比對 + 歸零專項，結果在 `compare-result.json`、`compare-output.txt`）、`checks.mjs`（額外檢查，輸出在 `checks-output.txt`）。

## 第 4 輪改動（主實作 0.3.0）

主實作 observe 把 |x| < 10⁻⁹ 的 s、dist、v、area、avgSpeed、avgVel 歸零（顯示層消除捨入殘餘）。第二實作**不**把歸零寫進模型（規格沒有這條），而是：
1. 仍用純解析值與主實作做容限比對（容限 1e-6 遠大於 1e-9，歸零不可能造成超限，但可確認歸零沒有動到大於閾值的值）。
2. 另加歸零專項：對每個被主實作歸零的 (幀, 鍵)，以主實作**自身的 t**（累加值，如 9.999999999999897）代入解析式，真值必須 < 1e-9；主實作非零的值，真值必須 ≥ 1e-9；a 不得被歸零；speed 必須仍等於 |v|。
3. 檢查解析值恰為 0 的幀（奇對稱 v–t 的 s(10)、v(5)；area-not-distance 的 s(9)、v(4.5)）主實作是否恰為 0。
4. 第 2 輪「規格待釐清」第 2 點（draw 且 T 恰落在非末節點）本輪由 random-2（draw、T = 5、vt 節點 5 處左段斜率 0、右段斜率 −1）覆蓋。

## 結論

**一致。** 10 個運行 × 8 個 key × 10001 幀全部在容限內（全部量皆有解析解，容限 1e-6）。最大絕對誤差 1.43e-11（random-1 的 s / area，|s| ~ 220 m，雙精度累積誤差）。a 沒有任何一幀差異（含凍結後幀與 draw 節點跳變幀），事件時刻容限（2 dt）未動用。幀時刻 t 最大差 1.01e-12。

歸零專項（全部 10 運行）：
- 主實作歸零的值，解析真值最大 9.02e-13（scenario-area-not-distance 的 s(9)）——全部 < 1e-9。**歸零沒有影響任何 |x| ≥ 1e-9 的值。**
- 主實作非零的值，解析真值最小 5.00e-7（t = 0.001 的 s = ½·1·0.001²）——沒有「應歸零而未歸零」的值，也沒有落在閾值 ±1e-11 內的歧義值。
- a 零幀數與解析一致（draw 段斜率為 0 的段：scenario-area-not-distance 9001 幀、random-2 7001 幀 = [3, 5) 段 2000 幀 + 凍結 5001 幀），a 未被歸零。
- speed === |v| 在全部 80010 幀成立（主實作的 speed 取歸零後的 v，與 speed = |v| 自洽）。
- 主實作與第二實作套同一歸零規則後，各鍵的零幀數完全相同（見下表）。

解析值恰為 0 的幀，主實作全部恰為 0：

| 運行 | t（格點） | key | 第二實作純解析值 | 主實作 | 主實作恰為 0 |
|---|---|---|---|---|---|
| scenario-below-axis | 5 | v | 0 | 0 | 是 |
| scenario-below-axis | 10 | s | 1.1102230246251565e-15 | 0 | 是 |
| scenario-below-axis | 10 | area | 1.1102230246251565e-15 | 0 | 是 |
| scenario-below-axis | 10 | avgVel | 1.1102230246251565e-16 | 0 | 是 |
| scenario-area-not-distance | 4.5 | v | 0 | 0 | 是 |
| scenario-area-not-distance | 9 | s | 0 | 0 | 是 |
| scenario-area-not-distance | 9 | area | 0 | 0 | 是 |
| scenario-area-not-distance | 9 | avgVel | 0 | 0 | 是 |

（第二實作 s(10) = 1.1e-15 是 11 段二次式相加的浮點殘餘；主實作在其 t = 9.999999999999897 的真值 ≈ 2.07e-13，歸零後為 0。兩者均在 1e-9 以下。）

random-2（draw、T = 5，T 恰落在節點 5）：
- random-2 凍結幀 主 t=5.000000000000004 a=0 v=2.9999999999999956 s=10.50000000000001；T−dt a=0 v=3；末幀 a=0 v=2.9999999999999956；第二 a=0 v=3 s=10.5
- random-2 主 v(凍結) − 3 = -4.441e-15；若以未截斷 t=5.000000000000004 代入右段 v=3−(t−5)：0.000e+0（差 0 表示主實作用未截斷 t 在右段插值）
- random-2 a 凍結 = 左段斜率 0（兩實作一致）、v 與 3 差 < 1e-12: true

兩實作在凍結幀 a 都取左段斜率 0（T⁻ 的值），v 都是節點值 3（主實作 3 − 4.4e-15）。主實作凍結幀 v 的 −4.4e-15 恰等於用未截斷的 t = 5.000000000000004 在右段（斜率 −1）插值：v = 3 − (t − 5)。這說明主實作凍結時 a 是保持 T⁻ 值，而 v 仍以原始 t 計算；在 dt 整除 T 的情況下差異只有 1e-15 量級，不構成問題，但列入「規格待釐清」。

### 每個運行最後一幀（主實作數據；第二實作的同一檢查亦全部通過，見 checks-output.txt）

判準：(a) 凍結後所有幀 a、v、s 完全不變；(b) a(T) = a(T − dt)；(c) live 的 v_last = u + aT、a_last = a；draw 的 a_last = T⁻ 所在段斜率、v_last = 節點值；(d) 凍結前最後兩幀的差分斜率 = a_last。

- 主實作 default：凍結後狀態不變:true a(T)=a(T−dt):true a_last=1.000000 期望 1.000000:true v_last=10.000000 期望(v = u + aT) 10.000000:true 差分斜率 1.000000=a_last:true
- 主實作 scenario-below-axis：凍結後狀態不變:true a(T)=a(T−dt):true a_last=-0.400000 期望 -0.400000:true v_last=-2.000000 期望(折線末段斜率) -2.000000:true 差分斜率 -0.400000=a_last:true
- 主實作 scenario-st-not-path：凍結後狀態不變:true a(T)=a(T−dt):true a_last=0.000000 期望 0.000000:true v_last=0.000000 期望(v = u + aT) 0.000000:true 差分斜率 0.000000=a_last:true
- 主實作 scenario-v-zero-a-not：凍結後狀態不變:true a(T)=a(T−dt):true a_last=-9.810000 期望 -9.810000:true v_last=-46.050000 期望(v = u + aT) -46.050000:true 差分斜率 -9.810000=a_last:true
- 主實作 scenario-area-not-distance：凍結後狀態不變:true a(T)=a(T−dt):true a_last=0.000000 期望 0.000000:true v_last=-2.000000 期望(折線末段斜率) -2.000000:true 差分斜率 0.000000=a_last:true
- 主實作 random-0：凍結後狀態不變:true a(T)=a(T−dt):true a_last=8.954050 期望 8.954050:true v_last=48.110196 期望(v = u + aT) 48.110196:true 差分斜率 8.954050=a_last:true
- 主實作 random-1：凍結後狀態不變:true a(T)=a(T−dt):true a_last=5.315743 期望 5.315743:true v_last=48.668986 期望(v = u + aT) 48.668986:true 差分斜率 5.315743=a_last:true
- 主實作 random-2：凍結後狀態不變:true a(T)=a(T−dt):true a_last=0.000000 期望 0.000000:true v_last=3.000000 期望(折線末段斜率) 3.000000:true 差分斜率 -0.000000=a_last:true
- 主實作 random-3：凍結後狀態不變:true a(T)=a(T−dt):true a_last=9.677692 期望 9.677692:true v_last=51.315507 期望(v = u + aT) 51.315507:true 差分斜率 9.677692=a_last:true
- 主實作 random-4：凍結後狀態不變:true a(T)=a(T−dt):true a_last=-4.675829 期望 -4.675829:true v_last=-28.038055 期望(v = u + aT) -28.038055:true 差分斜率 -4.675829=a_last:true

## 逐鍵比對

（相對誤差以 |Δ| / max(|主|, |第二|, 1e-12) 計；通過準則為絕對誤差 ≤ 1e-6 **或** 相對誤差 ≤ 1e-6。scenario-below-axis 的 s / area / avgVel 最大相對誤差 1.1e-3 / 1.1e-4 是 t = 10 幀主實作歸零為 0、第二實作 1.1e-15，分母取下限 1e-12 所致，絕對差 ~1e-15，不是真差異。「(t)」列為幀時刻的比對。）

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
| scenario-below-axis | s | 7.15e-13 | 1.11e-3 | — | 是 |
| scenario-below-axis | dist | 1.25e-12 | 1.41e-13 | — | 是 |
| scenario-below-axis | v | 4.03e-13 | 4.44e-12 | — | 是 |
| scenario-below-axis | a | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-below-axis | speed | 4.03e-13 | 4.44e-12 | — | 是 |
| scenario-below-axis | area | 7.15e-13 | 1.11e-3 | — | 是 |
| scenario-below-axis | avgSpeed | 1.48e-13 | 1.34e-13 | — | 是 |
| scenario-below-axis | avgVel | 1.48e-13 | 1.11e-4 | — | 是 |
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
| scenario-area-not-distance | s | 6.59e-13 | 3.25e-10 | — | 是 |
| scenario-area-not-distance | dist | 2.01e-12 | 1.26e-13 | — | 是 |
| scenario-area-not-distance | v | 1.32e-12 | 1.63e-10 | — | 是 |
| scenario-area-not-distance | a | 0.00e+0 | 0.00e+0 | — | 是 |
| scenario-area-not-distance | speed | 1.32e-12 | 1.63e-10 | — | 是 |
| scenario-area-not-distance | area | 6.59e-13 | 3.25e-10 | — | 是 |
| scenario-area-not-distance | avgSpeed | 7.53e-14 | 4.00e-14 | — | 是 |
| scenario-area-not-distance | avgVel | 7.24e-14 | 3.25e-10 | — | 是 |
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

### 歸零專項逐運行

| 運行 | 模式 | T | 主 0 但第二 ≥ 1e-9 | 主 0 < abs(x) < 1e-9 未歸零 | 第二 < 1e-9 但主 ≠ 0 | a 被歸零 | speed ≠ abs(v) | s 與 avgVel 歸零不同步 | 主實作各鍵零幀數 |
|---|---|---|---|---|---|---|---|---|---|
| default | live | 10 | 0 | 0 | 0 | 0 | 0 | 0 | s:1 dist:1 v:1 speed:1 area:1 avgSpeed:1 avgVel:1 |
| scenario-below-axis | draw | 10 | 0 | 0 | 0 | 0 | 0 | 0 | s:2 dist:1 v:1 speed:1 area:2 avgSpeed:1 avgVel:2 |
| scenario-st-not-path | live | 10 | 0 | 0 | 0 | 0 | 0 | 0 | s:10001 dist:10001 v:10001 speed:10001 area:10001 avgSpeed:10001 avgVel:10001 |
| scenario-v-zero-a-not | live | 5 | 0 | 0 | 0 | 0 | 0 | 0 | s:1 dist:1 v:0 speed:0 area:1 avgSpeed:1 avgVel:1 |
| scenario-area-not-distance | draw | 10 | 0 | 0 | 0 | 0 | 0 | 0 | s:2 dist:1 v:1 speed:1 area:2 avgSpeed:1 avgVel:2 |
| random-0 | live | 5 | 0 | 0 | 0 | 0 | 0 | 0 | s:1 dist:1 v:0 speed:0 area:1 avgSpeed:1 avgVel:1 |
| random-1 | live | 10 | 0 | 0 | 0 | 0 | 0 | 0 | s:1 dist:1 v:0 speed:0 area:1 avgSpeed:1 avgVel:1 |
| random-2 | draw | 5 | 0 | 0 | 0 | 0 | 0 | 0 | s:1 dist:1 v:1 speed:1 area:1 avgSpeed:1 avgVel:1 |
| random-3 | live | 5 | 0 | 0 | 0 | 0 | 0 | 0 | s:1 dist:1 v:0 speed:0 area:1 avgSpeed:1 avgVel:1 |
| random-4 | live | 5 | 0 | 0 | 0 | 0 | 0 | 0 | s:1 dist:1 v:0 speed:0 area:1 avgSpeed:1 avgVel:1 |

以主實作自身 t 代入解析式的檢查：
- 歸零[default] 主實作歸零(幀×鍵)=6 歸零處真值最大=0.00e+0 非零處真值最小=5.00e-7 歸零但真值≥1e-9:0 真值<1e-9但未歸零:0 近閾值歧義:0
- 歸零[scenario-below-axis] 主實作歸零(幀×鍵)=9 歸零處真值最大=2.07e-13 非零處真值最小=2.00e-4 歸零但真值≥1e-9:0 真值<1e-9但未歸零:0 近閾值歧義:0
- 歸零[scenario-st-not-path] 主實作歸零(幀×鍵)=60006 歸零處真值最大=0.00e+0 非零處真值最小=— 歸零但真值≥1e-9:0 真值<1e-9但未歸零:0 近閾值歧義:0
- 歸零[scenario-v-zero-a-not] 主實作歸零(幀×鍵)=5 歸零處真值最大=0.00e+0 非零處真值最小=1.14e-3 歸零但真值≥1e-9:0 真值<1e-9但未歸零:0 近閾值歧義:0
- 歸零[scenario-area-not-distance] 主實作歸零(幀×鍵)=9 歸零處真值最大=9.02e-13 非零處真值最小=2.22e-4 歸零但真值≥1e-9:0 真值<1e-9但未歸零:0 近閾值歧義:0
- 歸零[random-0] 主實作歸零(幀×鍵)=5 歸零處真值最大=0.00e+0 非零處真值最小=3.34e-3 歸零但真值≥1e-9:0 真值<1e-9但未歸零:0 近閾值歧義:0
- 歸零[random-1] 主實作歸零(幀×鍵)=5 歸零處真值最大=0.00e+0 非零處真值最小=6.97e-4 歸零但真值≥1e-9:0 真值<1e-9但未歸零:0 近閾值歧義:0
- 歸零[random-2] 主實作歸零(幀×鍵)=6 歸零處真值最大=0.00e+0 非零處真值最小=5.00e-7 歸零但真值≥1e-9:0 真值<1e-9但未歸零:0 近閾值歧義:0
- 歸零[random-3] 主實作歸零(幀×鍵)=5 歸零處真值最大=0.00e+0 非零處真值最小=2.93e-3 歸零但真值≥1e-9:0 真值<1e-9但未歸零:0 近閾值歧義:0
- 歸零[random-4] 主實作歸零(幀×鍵)=5 歸零處真值最大=0.00e+0 非零處真值最小=4.66e-3 歸零但真值≥1e-9:0 真值<1e-9但未歸零:0 近閾值歧義:0

## 不一致的判斷

無不一致。獨立核對（不依賴主實作）：
- scenario-below-axis（vt 對 t = 5 奇對稱）：s(10) = 0、dist(10) = 10、v(5) = 0 為解析必然；主實作 s、area、avgVel 在 t ≈ 10 幀恰為 0，v、speed 在 t ≈ 5 幀恰為 0；dist = 10.000000000001242 未被歸零（正確，dist 不該為 0）。
- scenario-area-not-distance：s = 2t（t < 4），s(4.5) = 9，之後 s = 9 − 2(t − 4.5)（t > 5 段內）……s(9) = 8 − 2·4 = 0，v(4.5) = 0；主實作兩者恰為 0。
- random-2：s(5) = 0.5 + 1.5 + 2.5 + 3 + 3 = 10.5，主實作 10.50000000000001；a(T⁻) = vt[5] − vt[4] = 0。
- 歸零閾值兩側：最接近閾值的非零值是 5e-7（t = 0.001 幀的 s），距 1e-9 有 500 倍，本組運行不存在閾值歧義。

## 額外檢查

### 量綱
- 參數單位：u [m s⁻¹]、a [m s⁻²]、T [s]、vt [m s⁻¹]；輸出 s、dist、area [m]，v、speed、avgSpeed、avgVel [m s⁻¹]，a [m s⁻²]。s = ut + ½at² 每項 [m]；v² = u² + 2as 每項 [m² s⁻²]。
- 數值驗證：長度換 cm（×100）、時間換 ms（×1000），各輸出按各自量綱縮放——通過。draw 只縮放長度——通過。
- 歸零閾值 1e-9 是帶量綱的常數（對 s 是 1e-9 m，對 v 是 1e-9 m s⁻¹），換單位後行為會變（例如以 mm 計時 1e-9 m = 1e-6 mm 不再歸零）。對本模擬器固定 SI 單位無影響，但屬顯示層而非物理。

### 對稱
- 反號對稱：(u, a) → (−u, −a) 或 vt → −vt 時，s、v、a、avgVel 反號，dist、speed、avgSpeed 不變——live 與 draw 均通過。歸零規則本身反號對稱（|x| < 1e-9 ⇔ |−x| < 1e-9）——通過。
- 時間鏡像：scenario-below-axis 的 vt 對 t = 5 s 奇對稱，s(5+τ) = s(5−τ)、s(10) = 0、dist(10) = 10 m——通過。
- 歸零規則冪等（套兩次 = 套一次）——通過。

### 極限
- a = 0：s = ut、dist = |u|t、a 讀數 0——通過。
- u = 0：s = ½at²、v² = 2as——通過。
- 一般 (u, a)：v = u + at、s = ut + ½at²、v² = u² + 2as 互相一致——通過（亦以主實作全部 live 運行每一幀驗證）。
- draw 每段 s 為二次：二階差分預測第四點吻合；二階差分 / h² = 段斜率 = a 讀數——通過。
- draw 超出末節點（T = 20、3 節點）：v 保持末值、a = 0、s 線性——通過。
- t = 0：s = dist = area = avgSpeed = avgVel = 0，v = u，a = a——通過。
- a 極大（1e6）：s = 2e6——通過。靜止（u = a = 0）：s = dist = v = 0——通過。
- 歸零極限：|x| 恰等於 1e-9 不歸零（嚴格小於）；本組運行沒有值落在 [1e-9 − 1e-11, 1e-9) 內。

### 規格驗證條件（用主實作輸出逐幀檢驗）
- v–t 線下面積 = s–t 位移（area === s）——10 運行全部通過（歸零同時作用於 s 與 area，未破壞相等）。
- 勻加速三式互相一致——全部 live 運行通過。
- 未反向時 dist = |s|、反向後 dist > |s|——全部通過（反向的 5 個運行：scenario-below-axis 5 s、scenario-v-zero-a-not 0.306 s、scenario-area-not-distance 4.5 s、random-1 0.845 s；random-2 改為 draw 後不反向）。
- speed = |v|、avgSpeed·t = dist、avgVel·t = s——全部通過（s 與 avgVel 在同一幀同時歸零，沒有一方歸零另一方未歸零的情況）。

## 規格待釐清
1. 歸零（|x| < 1e-9 → 0）是顯示層慣例，規格沒有；本輪驗證它只影響真值 < 1e-9 的值。建議在規格或 manifest 註明閾值與適用鍵（不含 a、speed 取歸零後的 |v|）。
2. 凍結幀 v 的計算：主實作凍結時 a 保持 T⁻ 值，但 v 似以未截斷的 t（T + 4e-15）在右段插值（random-2 凍結幀 v = 3 − 4.4e-15 恰等於 3 − (t − 5)）。dt 整除 T 時差異 1e-15 量級、被容限吸收；若日後 dt 不整除 T（例如可變幀率），凍結幀 v 會取到右段值而 a 取左段值，建議凍結時把 t 截斷為 T 再算 v、s。
3. avgVel 與 s 各自獨立歸零：若 t < 1 且 1e-9 ≤ |s|/t 而 |s| < 1e-9，會出現 s = 0 但 avgVel ≠ 0（本組運行未發生，因最小非零值 5e-7）。若要嚴格自洽可改為先歸零 s 再算 avgVel。
4. （沿前輪）規格沒有參數表；u、a 範圍、T 選項、draw 節點間距（1 s）與節點數（11）皆由開發端定。
5. （沿前輪）draw 模式 T = 20 而 vt 只到 10 s 時，10 s 後 v 保持末值（兩實作一致，規格未寫）。
6. （沿前輪）avgSpeed / avgVel 在 t = 0 取 0（兩實作一致，規格未定義）。
7. （沿前輪）draw 節點處 a 不連續，未凍結時整數秒幀取右段斜率、凍結幀（T 恰在節點）取左段斜率——本輪 random-2 已驗證兩實作一致。
