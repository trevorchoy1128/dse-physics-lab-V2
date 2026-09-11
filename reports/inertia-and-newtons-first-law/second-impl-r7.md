# 第二實作比對：inertia-and-newtons-first-law（#024，S15）——第 7 輪（規格 v0.4）

**第 7 輪（2026-09-11）**，對照主實作版本 0.4.0。本輪原因：老師 2026-09-11 全站規則，摩擦不用摩擦係數 *μ*，學生直接設定摩擦力 *f*（N）；規格 v0.4 把情景 1 的 *f*₁、*f*₂，情景 2 的 *f*布、*f*桌，情景 3 乘客的 *f* 全部改為力。第二實作按 v0.4 §7 重寫（前一版 *μ* 版存於 `second-impl-r6/`）。

積分方法：**事件分段解析積分**（event-split closed-form），與第 6 輪相同。四個情景的加速度都是分段常數，每一步 [t, t+dt] 內先解出最早的事件時刻（v 過零、越過 B、桌布尾邊追到物件／物件追上布速、巴士換相 t₁/t₂/t₃、乘客相對速度過零），用 s += vτ + ½aτ²、v += aτ 精確推進到事件，改模式後再推進餘下時間；事件時刻落在步末 10⁻⁹·dt 之內即算本步命中。除浮點捨入外沒有截斷誤差。
步長：主運行 0.001 s（`data/index.json`，17 個運行）、extra 運行 0.005 s（`data/index-extra.json`，8 個運行）。幀數：主運行 2000（0–1.999 s）、extra 運行 3200（0–16 s，過時間窗 T 後凍結於 T）。運行：**25 個**。
參數切換規則（extra 運行的 `change`）：幀的 t ≥ change.t（容差 10⁻⁹）起 observe 與 step 都改用新參數，之後保持。
第二實作檔：`reports/inertia-and-newtons-first-law/second-impl/model.mjs`（純 JavaScript；未讀 model.ts／plan.ts／model.test.ts）；`run.mjs` 產生 25 個 `<run>.json`；`compare.mjs` 逐幀比對並輸出 `compare-table.md`（全部 415 列 + 45 個事件幀）與 `compare.json`；`checks.mjs` 做 63 項額外檢查。

v0.4 對 model.mjs 的方程改動（§7「摩擦（全模擬統一）」）：

| 項目 | v0.3（第 6 輪） | v0.4（本輪） |
|---|---|---|
| 情景 1 摩擦上限 | μ₁mg／μ₂mg | *f*₁／*f*₂（直接取控制項） |
| 情景 1 靜止判斷 | F ≤ μmg 則摩擦 = −F | F ≤ *f* 則摩擦 = −F，不動；F > *f* 起動 |
| 情景 2 加速度 | a = μ布g | a = *f*布/*m*（*m* = 1.0 kg 固定） |
| 情景 2 抽出後減速 | μ桌g | *f*桌/*m* |
| 情景 2 摩擦讀數 | m·a | +*f*布（抽出前）／−*f*桌（抽出後） |
| 情景 2 臨界 | v布² ≤ 2μ布gL | v布² ≤ 2(*f*布/*m*)L（預設 1.0954 ≈ 1.10 m s⁻¹） |
| 情景 3 乘客加速度上限 | μg | *f*/*m*（預設 120/60 = 2.00 m s⁻²） |
| 情景 3 握扶手 | f = clamp(m a車, ±μmg) | f = clamp(m a車, ±*f*)，扶手力 = m a車 − f |
| 情景 3 時間窗 | t₃ + 0.5 + min(v/μg, 6) | t₃ + 0.5 + min(v/(*f*/*m*), 6)；*f* = 0 → 6；握扶手 → 0.5 |
| 情景 4 | 不變 | 不變 |

## 結論

**一致。** 25 個運行 × 全部 observe 鍵（含 t）共 **415 列**（316 列連續量、99 列離散量），每一列逐幀最大絕對誤差均 ≤ 1.6 × 10⁻¹³（容限 10⁻⁶），連續量最大相對誤差 ≤ 1.7 × 10⁻¹¹（`scenario-inertia-not-speed` 的 sC 在過零附近，絕對誤差 3.7 × 10⁻¹⁴）；99 列離散量（scene、phase、busPhase、sliding、stuck、nForces、nHoriz、engineOn）逐幀完全相等；**45 個事件**（放手、越過 B、抽出／追上布、停下、巴士換相、關引擎）的幀差全部為 0（容限 2 dt）。10 個運行（含 `extra-bus-handrail`、`extra-bus-f0`、`scenario-bus-start`、`random-0/2`、`scenario-rest-not-no-force`、`scenario-stop-not-inertia`）所有鍵逐位相同（誤差 0）。

v0.4 新方程的關鍵畫面兩者一致：
- **情景 1 F < f₂ 保持施力進入粗糙段**（`default`、`scenario-stop-is-friction`：F = 0.30 N、*f*₂ = 0.40 N）：t = 1.000 s 越過 B，摩擦 −0.40 N 出現、Fnet = −0.10 N、a = −0.50 m s⁻²、nForces 3 → 4（施力仍在）；兩者幀 1000 同步。
- **F = f₂ 勻速**（`scenario-constant-v-zero-net`：F = *f*₂ = 1 N、m = 0.5 kg）：t = 0.867 s 越過 B 後 Fnet = 0、v 恆為 √3 = 1.7320508 m s⁻¹。
- **桌布**（`scenario-cloth-impulse` 預設）：Δt = 0.08098 s、Δv = 0.12148 m s⁻¹（§10 條件 9 的 0.121）、J = 0.12148 N s、滑行 0.003689 m，幀 81 抽出、幀 142 停下；`extra-cloth-critical-above`（v布 = 1.2 > 1.0954）Δt = 0.47340 s、Δv = 0.71010 m s⁻¹、滑行 0.12606 m；`extra-cloth-stuck`（v布 = 1.0）幀 134（t = 0.6667 s = v布/(f布/m)）追上，之後 v ≡ 1、dtPull 凍結 0.6667、J = 1 N s、stuck = 1。
- **巴士**（`scenario-bus-brake` 預設 *f*/*m* = 2 < a = 3）：起步即滑（sliding = 1 於 t = 0）、a乘 = 2、f = +120 N；`extra-bus-handrail`：f = 120 N（上限）、Fhand = 60 N、Fnet = 180 N、sRel ≡ 0；`extra-bus-f0`：乘客 s ≡ 0。
- **太空**：不受 v0.4 影響，全部逐位相同或 10⁻¹³ 級捨入差。

額外檢查 63/63 通過（§10 條件 1–16 的解析核對 34 項、對稱 5 項、極限 15 項、量綱 9 項）。

## 逐鍵比對

每個運行取最差的一鍵（全部 415 列見 `second-impl/compare-table.md`；8 個 extra 運行的 138 列另列於附錄 A）。容限：本模型所有量皆有分段解析解，一律用 10⁻⁶（同時檢查 10⁻⁴，自然全過）；離散量逐幀相等或事件幀差 ≤ 2。

| 運行 | 情景 | dt | 最差 key | 最大絕對誤差 | 最大相對誤差 | 首次超限 t | 通過 |
|---|---|---|---|---|---|---|---|
| default | 1 | 0.001 | s | 4.4e-14 | 2.2e-14 | — | ✓ |
| scenario-moving-needs-force | 1 | 0.001 | s | 4.0e-14 | 2.0e-14 | — | ✓ |
| scenario-stop-is-friction | 1 | 0.001 | s | 4.4e-14 | 2.2e-14 | — | ✓ |
| scenario-stop-not-inertia | 4 | 0.001 | （全部 0） | 0 | 0 | — | ✓ |
| scenario-constant-v-zero-net | 1 | 0.001 | s | 4.9e-15 | 1.0e-14 | — | ✓ |
| scenario-rest-not-no-force | 1 | 0.001 | （全部 0） | 0 | 0 | — | ✓ |
| scenario-bus-brake | 3 | 0.001 | s | 5.0e-14 | 1.6e-14 | — | ✓ |
| scenario-bus-start | 3 | 0.001 | （全部 0） | 0 | 0 | — | ✓ |
| scenario-heavy-not-farther | 1 | 0.001 | s | 1.0e-13 | 1.5e-14 | — | ✓ |
| scenario-inertia-not-speed | 4 | 0.001 | sB | 1.5e-13 | 1.9e-14（sC 過零處 1.6e-11） | — | ✓ |
| scenario-cloth-impulse | 2 | 0.001 | sCloth | 2.8e-16 | 0 | — | ✓ |
| scenario-engine-off | 4 | 0.001 | s | 5.0e-14 | 1.6e-14 | — | ✓ |
| random-0 | 1 | 0.001 | （全部 0） | 0 | 0 | — | ✓ |
| random-1 | 4 | 0.001 | sB | 5.6e-14 | 1.5e-14 | — | ✓ |
| random-2 | 4 | 0.001 | （全部 0） | 0 | 0 | — | ✓ |
| random-3 | 3 | 0.001 | s | 4.2e-14 | 1.7e-14 | — | ✓ |
| random-4 | 2 | 0.001 | v | 2.8e-17 | 1.8e-14 | — | ✓ |
| extra-release-1s | 1 | 0.005 | s | 3.7e-15 | 3.8e-15 | — | ✓ |
| extra-release-smooth | 1 | 0.005 | s | 4.4e-16 | 7.4e-16 | — | ✓ |
| extra-release-two-blocks | 1 | 0.005 | sB | 5.3e-15 | 6.7e-15 | — | ✓ |
| extra-cloth-stuck | 2 | 0.005 | s | 8.9e-16 | 1.5e-15 | — | ✓ |
| extra-cloth-critical-above | 2 | 0.005 | sCloth | 5.0e-14 | 1.6e-14 | — | ✓ |
| extra-bus-handrail | 3 | 0.005 | （全部 0） | 0 | 0 | — | ✓ |
| extra-bus-f0 | 3 | 0.005 | （全部 0） | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | 4 | 0.005 | sC | 7.3e-15 | 7.3e-15 | — | ✓ |

事件幀（45 個，全表見 `compare-table.md` 下半）：幀差全部 0。

| 事件 | 運行 | 幀（主＝第二） |
|---|---|---|
| 越過 B、摩擦出現（nForces 3→4、nHoriz 1→2） | default、scenario-stop-is-friction | 1000（t = 1.000） |
| 越過 B、F = f₂ | scenario-constant-v-zero-net | 867（t = 0.867） |
| 桌布抽出（phase 0→2）／停下（2→3，nForces 3→2） | scenario-cloth-impulse | 81／142 |
| 桌布抽出／停下 | random-4 | 103／166 |
| 桌布抽出／停下 | extra-cloth-critical-above | 95／166 |
| 追上布速（phase 0→1、stuck 0→1、nForces 3→2） | extra-cloth-stuck | 134（t = 0.670） |
| 放手（nForces 3→2） | extra-release-smooth、extra-release-two-blocks | 100（t = 0.500） |
| 在 B 放手後停下（nForces 3→2） | extra-release-1s | 350（t = 1.750） |
| 巴士換相 0→1 | random-3 | 958 |
| 巴士換相 0→1／1→2／2→3（nHoriz 2→0→2→0） | extra-bus-handrail | 667／1467／2134 |
| 巴士換相、停定後 sliding 1→0 | extra-bus-f0 | 667／1467／2134 |
| 關引擎（engineOn、nForces、nHoriz 1→0） | extra-space-engine-off-1s | 200（t = 1.000） |

## 不一致的判斷

沒有超出容限的不一致。記錄四點供覆核：

1. **`extra-release-1s` 停下時刻由 v0.3 的 1.7645 s 變為 1.750 s。** v_B = 1.5 m s⁻¹，v0.4 減速度 *f*₂/*m* = 0.40/0.20 = 2.00 m s⁻²（v0.3 為 μ₂g = 1.962），滑行 *m*v²/(2*f*₂) = 0.5625 m（v0.3 為 0.5734 m），停於 s = 1.3125 m。兩實作幀 350 同步，且與解析解相對誤差 3 × 10⁻¹⁶。這是規格改動的必然結果，不是錯誤。
2. **預設參數（保持施力）在粗糙段會減速停下。** F = 0.30 N < *f*₂ = 0.40 N，越過 B 後 Fnet = −0.10 N、a = −0.50 m s⁻²，t = 4.0 s 停於 s = 3.0 m；停下後按 §7「靜止且 F ≤ *f* 時摩擦 = −F，不動」，摩擦讀數由 −0.40 N 跳到 −0.30 N、Fnet = 0、nHoriz 保持 2。主運行只導出 0–2 s（dt 0.001 × 2000），停下與靜摩擦切換**不在比對範圍**；第二實作已跑到 6 s 確認上述行為（見 `checks.mjs` 之外的手動核對）。建議下輪加一個 extra 運行覆蓋這一幕（見待釐清 1）。
3. **桌布臨界值本身是浮點刀鋒。** v布 = √(2·1.5·0.4/1) 在 JavaScript 中 v布² = 1.2000000000000002 > 1.2，故落在「抽得出」一側；此處根式的條件數無限大，任何方法只剩約 √ε ≈ 10⁻⁸ 的時刻精度，實測 Δv 相對偏差 10⁻⁷。兩分支的物理相同（尾邊離開的一瞬物件恰達布速），滑桿步長 0.1 令學生不會踩到。§10 條件 10 用「臨界值兩側各取 5 點」，不取臨界值本身，是合理的寫法。
4. **`scenario-inertia-not-speed` 的 sC 相對誤差 1.6 × 10⁻¹¹。** sC = −2t + t² 在 t ≈ 1.7 s 接近過零（t = 2 s），絕對誤差 3.7 × 10⁻¹⁴ 除以小量值所致；無物理意義。

## 額外檢查

`checks.mjs` 63 項全過。

### 量綱（由 §5 參數單位推，v0.4 全部改為 N 後重推）

| 式 | 推導 | 結果 |
|---|---|---|
| a = (F − *f*)/*m* | N/kg = kg m s⁻²/kg = m s⁻² | ✓ |
| d = *m*v²/(2*f*₂) | kg (m s⁻¹)²/N = kg m² s⁻²/(kg m s⁻²) = m | ✓ |
| a布 = *f*布/*m* | N/kg = m s⁻² | ✓ |
| t抽 = (v布 − √(v布² − 2aL))/a | √(m² s⁻² − m s⁻²·m) = m s⁻¹；(m s⁻¹)/(m s⁻²) = s | ✓ |
| J = *f*布Δt = *m*Δv | N s = kg m s⁻¹ | ✓ |
| 滑行 = *m*Δv²/(2*f*桌) | kg m² s⁻²/N = m | ✓ |
| v臨界 = √(2*f*布L/*m*) | √(N m/kg) = √(m² s⁻²) = m s⁻¹ | ✓ |
| a乘 上限 = *f*/*m*；扶手力 = *m*a車 − *f* | N/kg = m s⁻²；kg m s⁻² − N = N | ✓ |
| fuel = 0.05 × F引擎 | 0.05 無單位（規格未定，見待釐清 6） | ✓ |

v0.4 令 *g* 不再進入任何水平方程：只出現在 W = N = *m*g。第二實作在情景 1 用 g = 10（`scenario-constant-v-zero-net`）與 9.81 的水平運動完全相同，符合預期。

### 對稱

| 檢查 | 結果 |
|---|---|
| 巴士起步／煞車鏡像（預設 *f* = 120）：起步段 a乘 = +2、f = +120；煞車段 a乘 = −2、f = −120 | ✓ |
| 太空引擎關：sC = −sB 逐幀 | ✓ |
| 引擎反向：s、v、Fe 變號 | ✓ |
| 伽利略對稱：三艘同受 a = 2 一秒後關引擎 → Δv 相同，之後 s_B + s_C = 2 s_A（sA = 23、sB = 47、sC = −1） | ✓ |
| W = N 等長反向（情景 1、2、3） | ✓ |

### 極限

| 極限 | 預期 | 第二實作 |
|---|---|---|
| *f*₁ = *f*₂ = 0、持續施力 12 s | v = Ft/*m* = 18 m s⁻¹，永不停 | ✓ |
| *f*₂ = 3 N（上限）在 B 放手 | 滑行 0.2·2.25/6 = 0.075 m | ✓（相對誤差 5 × 10⁻¹⁵） |
| F = 0、*f*₁ = 0.4 靜止 | 摩擦 0（不是 −*f*）、nHoriz 0、不動 | ✓ |
| F = *f*₁ = 0.5 靜止 | a = 0、摩擦 = −0.5、不動；F = 0.5001 即起動 a = (F − *f*)/*m* | ✓ |
| *f*布 = 0 | Δv = J = 0、Δt = L/v布 = 0.08 s、物件不動 | ✓ |
| *f*桌 = 0 | 抽出後永不停、slide 隨 t 增 | ✓ |
| v布 10 vs 2、L 1.0 vs 0.1 | Δv 隨 v布 減、隨 L 增 | ✓ |
| *f*布 掃 0–3 N（20 點） | 抽出前 \|a\| ≤ *f*布/*m*、v ≤ v布；Δv 嚴格單調上升，與精確解 < 10⁻⁹（實測 2 × 10⁻¹⁴） | ✓ |
| v布 掃 1.5–10（20 點） | Δv 嚴格單調下降，與精確解 < 10⁻⁹（實測 1 × 10⁻¹⁴）；5.0 → 0.12148、10 → 0.06018 | ✓ |
| 臨界兩側各 5 點（±2%…±10%） | 以下 stuck = 1、終速 = v布；以上抽得出 | ✓ |
| 情景 2 物件 *m* 加倍（模型內 mObj） | v0.4 下 a 減半 → Δv ≈ 減半（0.0602 → 0.0300）；v0.3 的「Δv 與 *m* 無關」已不成立，與規格 §10 條件 11 的說明相符 | ✓ |
| 巴士 *f* = 0 | 乘客 s ≡ 0、sRel = −s車 | ✓ |
| 巴士 *f* = 300 N（*f*/*m* = 5 ≥ a = 3） | 全程不滑、sRel ≡ 0、摩擦 = *m*a車 | ✓ |
| 巴士 *f* = 200 N（*f*/*m* = 3.33 ≥ 3） | 不滑 | ✓ |
| 巴士預設（*f*/*m* = 2 < 3） | 滑動時 \|a乘\| = 2；煞車期間 v乘 ≥ v車；巴士停定後乘客再滑 3.333/2 = 1.667 s，停於 12.333 s（幀 2467） | ✓ |
| a車 = 0（控制項下限） | 巴士與乘客皆不動、T 有限、無 NaN | ✓ |
| 握扶手預設 | sRel ≡ 0、f + Fhand = *m*a車、\|f\| ≤ 120、起步 f = 120、Fhand = 60、Fnet = 180 | ✓ |
| 飛船 *m* × 10 | a ÷ 10 | ✓ |
| 引擎開但 F引擎 = 0 | nForces 0、fuel 0 | ✓ |
| 能量：F·L_AB = ½*m*v_B² = *f*₂·d = 0.225 J；無摩擦放手後動能漂移 0；桌布 ½*m*Δv² = *f*桌·滑行 | ✓ | ✓ |

## 規格待釐清

第 6 輪的 9 項中，*μ* 相關者已由 v0.4 解決；其餘保留並更新如下。

1. **（新）主運行只導出 0–2 s，預設參數的「保持施力進入粗糙段減速停下」（t = 4.0 s）與停下後靜摩擦 −F 的切換不在比對範圍。** 這是 v0.4 新增的畫面（F = 0.30 < *f*₂ = 0.40，§7「靜止且 F ≤ *f* 時摩擦 = −F，不動」）。建議下輪在 index-extra.json 加一個「預設、不放手、跑 6 s」的運行；亦建議 §8 補一句學生會看到的現象：「保持施力但 F < *f*₂ 時方塊在粗糙段減速停下，之後摩擦縮小到剛好抵消 F」。
2. **B 點本身屬光滑段還是粗糙段。**（第 6 輪第 1 項）§7 沒說；兩實作都取 s ≥ 0.75 m 即粗糙（閉於 B）。預設參數下 t_B = 1.000 s 恰落在幀上，`extra-release-1s` 正是在這幀放手，看到的是施力換摩擦（nForces 3 → 3）而不是 §8 第 1 點的 3 → 2（該畫面須在光滑段放手，`extra-release-smooth`）。
3. **`stuck` 是預測還是事件。**（第 6 輪第 2 項）兩實作都在追上布速後才報 1；學生把 v布 調到 1.10 以下時，追上前（預設 0.67 s）畫面仍顯示「抽得出中」。顯示決定，請老師定奪。
4. **握扶手時摩擦的取法。**（第 6 輪第 3 項）本輪按「f = clamp(*m*a車, ±*f*)、餘量由扶手補」比對，一致；規格 §7 只寫「扶手力 = *m*a車 − *f*」而沒定 *f* 的取法。另一讀法 f = 0、扶手力 = *m*a車。兩讀法 Fnet、a、s 相同，f、Fhand、nHoriz 不同。
5. **時間窗 T 的公式不在規格也不在 manifest。**（第 6 輪第 4 項，v0.4 換算後仍由數據反推）情景 1、4 = 12 s；情景 2 = 3 s，抽不出時 t追上 + 4 s；情景 3 = t₃ + 0.5 + min(v/(*f*/*m*), 6)，*f* = 0 時 t₃ + 6.5，握扶手時 t₃ + 1.0。
6. **fuel = 0.05 × F引擎 的 0.05 沒有單位。**（第 6 輪第 7 項）
7. **零量值的力算不算一支力。**（第 6 輪第 6 項）「施力中」但 F = 0、「引擎開」但 F引擎 = 0；兩實作都取「量值為 0 不計」。
8. **a車 = 0（控制項下限）** 令 t₁ = v/a 無定義；第二實作當作巴士永不起步，T = 12。（第 6 輪第 5 項）
9. **（新）v0.4 §5 範圍與預設待老師核准。** 比對用的數值（*f*₁ 0、*f*₂ 0.40、*f*布 1.50、*f*桌 2.00、乘客 *f* 120 N）與 controls.ts 一致；若老師改預設，§8 第 6 點的 Δv 0.121／0.060 與臨界 1.10 m s⁻¹ 須同步重算。

---

## 附錄 A：8 個 extra 運行全部 138 列逐鍵比對（compare.mjs 輸出；17 個主運行的 277 列見 `second-impl/compare-table.md`）

| 運行 | key | 最大絕對誤差 | 最大相對誤差 | 首次超限 t (1e-6) | 通過 |
|---|---|---|---|---|---|
| extra-release-1s | t | 0 | 0 | — | ✓ |
| extra-release-1s | scene | 0 | 0 | — | ✓ |
| extra-release-1s | s | 3.66e-15 | 3.85e-15 | — | ✓ |
| extra-release-1s | v | 0 | 0 | — | ✓ |
| extra-release-1s | T | 0 | 0 | — | ✓ |
| extra-release-1s | a | 0 | 0 | — | ✓ |
| extra-release-1s | f | 0 | 0 | — | ✓ |
| extra-release-1s | Fapp | 0 | 0 | — | ✓ |
| extra-release-1s | Fnet | 0 | 0 | — | ✓ |
| extra-release-1s | W | 0 | 0 | — | ✓ |
| extra-release-1s | N | 0 | 0 | — | ✓ |
| extra-release-1s | nForces | 0 | 0 | — | ✓ |
| extra-release-1s | nHoriz | 0 | 0 | — | ✓ |
| extra-release-smooth | t | 0 | 0 | — | ✓ |
| extra-release-smooth | scene | 0 | 0 | — | ✓ |
| extra-release-smooth | s | 4.44e-16 | 7.40e-16 | — | ✓ |
| extra-release-smooth | v | 0 | 0 | — | ✓ |
| extra-release-smooth | T | 0 | 0 | — | ✓ |
| extra-release-smooth | a | 0 | 0 | — | ✓ |
| extra-release-smooth | f | 0 | 0 | — | ✓ |
| extra-release-smooth | Fapp | 0 | 0 | — | ✓ |
| extra-release-smooth | Fnet | 0 | 0 | — | ✓ |
| extra-release-smooth | W | 0 | 0 | — | ✓ |
| extra-release-smooth | N | 0 | 0 | — | ✓ |
| extra-release-smooth | nForces | 0 | 0 | — | ✓ |
| extra-release-smooth | nHoriz | 0 | 0 | — | ✓ |
| extra-release-two-blocks | t | 0 | 0 | — | ✓ |
| extra-release-two-blocks | scene | 0 | 0 | — | ✓ |
| extra-release-two-blocks | s | 9.99e-16 | 1.33e-15 | — | ✓ |
| extra-release-two-blocks | v | 0 | 0 | — | ✓ |
| extra-release-two-blocks | T | 0 | 0 | — | ✓ |
| extra-release-two-blocks | a | 0 | 0 | — | ✓ |
| extra-release-two-blocks | f | 0 | 0 | — | ✓ |
| extra-release-two-blocks | Fapp | 0 | 0 | — | ✓ |
| extra-release-two-blocks | Fnet | 0 | 0 | — | ✓ |
| extra-release-two-blocks | W | 0 | 0 | — | ✓ |
| extra-release-two-blocks | N | 0 | 0 | — | ✓ |
| extra-release-two-blocks | nForces | 0 | 0 | — | ✓ |
| extra-release-two-blocks | nHoriz | 0 | 0 | — | ✓ |
| extra-release-two-blocks | sB | 5.33e-15 | 6.66e-15 | — | ✓ |
| extra-release-two-blocks | vB | 0 | 0 | — | ✓ |
| extra-release-two-blocks | aB | 0 | 0 | — | ✓ |
| extra-cloth-stuck | t | 0 | 0 | — | ✓ |
| extra-cloth-stuck | scene | 0 | 0 | — | ✓ |
| extra-cloth-stuck | s | 8.88e-16 | 1.48e-15 | — | ✓ |
| extra-cloth-stuck | v | 0 | 0 | — | ✓ |
| extra-cloth-stuck | T | 0 | 0 | — | ✓ |
| extra-cloth-stuck | a | 0 | 0 | — | ✓ |
| extra-cloth-stuck | f | 0 | 0 | — | ✓ |
| extra-cloth-stuck | Fnet | 0 | 0 | — | ✓ |
| extra-cloth-stuck | W | 0 | 0 | — | ✓ |
| extra-cloth-stuck | N | 0 | 0 | — | ✓ |
| extra-cloth-stuck | nForces | 0 | 0 | — | ✓ |
| extra-cloth-stuck | nHoriz | 0 | 0 | — | ✓ |
| extra-cloth-stuck | vCloth | 0 | 0 | — | ✓ |
| extra-cloth-stuck | sCloth | 2.22e-16 | 0 | — | ✓ |
| extra-cloth-stuck | phase | 0 | 0 | — | ✓ |
| extra-cloth-stuck | dtPull | 0 | 0 | — | ✓ |
| extra-cloth-stuck | dv | 0 | 0 | — | ✓ |
| extra-cloth-stuck | J | 0 | 0 | — | ✓ |
| extra-cloth-stuck | slide | 0 | 0 | — | ✓ |
| extra-cloth-stuck | stuck | 0 | 0 | — | ✓ |
| extra-cloth-critical-above | t | 4.17e-14 | 1.39e-14 | — | ✓ |
| extra-cloth-critical-above | scene | 0 | 0 | — | ✓ |
| extra-cloth-critical-above | s | 2.78e-16 | 9.45e-16 | — | ✓ |
| extra-cloth-critical-above | v | 3.33e-16 | 4.82e-14 | — | ✓ |
| extra-cloth-critical-above | T | 0 | 0 | — | ✓ |
| extra-cloth-critical-above | a | 0 | 0 | — | ✓ |
| extra-cloth-critical-above | f | 0 | 0 | — | ✓ |
| extra-cloth-critical-above | Fnet | 0 | 0 | — | ✓ |
| extra-cloth-critical-above | W | 0 | 0 | — | ✓ |
| extra-cloth-critical-above | N | 0 | 0 | — | ✓ |
| extra-cloth-critical-above | nForces | 0 | 0 | — | ✓ |
| extra-cloth-critical-above | nHoriz | 0 | 0 | — | ✓ |
| extra-cloth-critical-above | vCloth | 0 | 0 | — | ✓ |
| extra-cloth-critical-above | sCloth | 4.97e-14 | 1.55e-14 | — | ✓ |
| extra-cloth-critical-above | phase | 0 | 0 | — | ✓ |
| extra-cloth-critical-above | dtPull | 1.11e-16 | 2.35e-16 | — | ✓ |
| extra-cloth-critical-above | dv | 1.11e-16 | 1.56e-16 | — | ✓ |
| extra-cloth-critical-above | J | 1.11e-16 | 1.56e-16 | — | ✓ |
| extra-cloth-critical-above | slide | 1.39e-16 | 7.35e-14 | — | ✓ |
| extra-cloth-critical-above | stuck | 0 | 0 | — | ✓ |
| extra-bus-handrail | t | 0 | 0 | — | ✓ |
| extra-bus-handrail | scene | 0 | 0 | — | ✓ |
| extra-bus-handrail | s | 0 | 0 | — | ✓ |
| extra-bus-handrail | v | 0 | 0 | — | ✓ |
| extra-bus-handrail | T | 0 | 0 | — | ✓ |
| extra-bus-handrail | a | 0 | 0 | — | ✓ |
| extra-bus-handrail | f | 0 | 0 | — | ✓ |
| extra-bus-handrail | Fhand | 0 | 0 | — | ✓ |
| extra-bus-handrail | Fnet | 0 | 0 | — | ✓ |
| extra-bus-handrail | W | 0 | 0 | — | ✓ |
| extra-bus-handrail | N | 0 | 0 | — | ✓ |
| extra-bus-handrail | nForces | 0 | 0 | — | ✓ |
| extra-bus-handrail | nHoriz | 0 | 0 | — | ✓ |
| extra-bus-handrail | vBus | 0 | 0 | — | ✓ |
| extra-bus-handrail | aBusNow | 0 | 0 | — | ✓ |
| extra-bus-handrail | sBus | 0 | 0 | — | ✓ |
| extra-bus-handrail | sRel | 0 | 0 | — | ✓ |
| extra-bus-handrail | busPhase | 0 | 0 | — | ✓ |
| extra-bus-handrail | sliding | 0 | 0 | — | ✓ |
| extra-bus-f0 | t | 0 | 0 | — | ✓ |
| extra-bus-f0 | scene | 0 | 0 | — | ✓ |
| extra-bus-f0 | s | 0 | 0 | — | ✓ |
| extra-bus-f0 | v | 0 | 0 | — | ✓ |
| extra-bus-f0 | T | 0 | 0 | — | ✓ |
| extra-bus-f0 | a | 0 | 0 | — | ✓ |
| extra-bus-f0 | f | 0 | 0 | — | ✓ |
| extra-bus-f0 | Fhand | 0 | 0 | — | ✓ |
| extra-bus-f0 | Fnet | 0 | 0 | — | ✓ |
| extra-bus-f0 | W | 0 | 0 | — | ✓ |
| extra-bus-f0 | N | 0 | 0 | — | ✓ |
| extra-bus-f0 | nForces | 0 | 0 | — | ✓ |
| extra-bus-f0 | nHoriz | 0 | 0 | — | ✓ |
| extra-bus-f0 | vBus | 0 | 0 | — | ✓ |
| extra-bus-f0 | aBusNow | 0 | 0 | — | ✓ |
| extra-bus-f0 | sBus | 0 | 0 | — | ✓ |
| extra-bus-f0 | sRel | 0 | 0 | — | ✓ |
| extra-bus-f0 | busPhase | 0 | 0 | — | ✓ |
| extra-bus-f0 | sliding | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | t | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | scene | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | s | 3.55e-15 | 2.69e-15 | — | ✓ |
| extra-space-engine-off-1s | v | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | T | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | a | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | Fe | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | Fnet | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | W | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | N | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | nForces | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | nHoriz | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | fuel | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | engineOn | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | sB | 7.11e-15 | 2.09e-15 | — | ✓ |
| extra-space-engine-off-1s | vB | 0 | 0 | — | ✓ |
| extra-space-engine-off-1s | sC | 7.33e-15 | 7.33e-15 | — | ✓ |
| extra-space-engine-off-1s | vC | 1.64e-15 | 0 | — | ✓ |
