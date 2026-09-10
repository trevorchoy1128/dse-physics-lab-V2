# 第二實作比對：inertia-and-newtons-first-law（#024，S15）——第 2 輪

**第 2 輪（2026-09-07）**，對照主實作版本 0.2.0（第 1 輪後主流程按 `fix-log.md` 修正並重新導出）。第 1 輪報告已由本檔覆蓋；第 1 輪的結論（17 個運行一致）在本輪重跑後不變，本輪新增 8 個 extra 運行（`data/index-extra.json`）的逐幀比對，以及對主實作 0.2.0 兩個離散旗標改動（`dtPull` 凍結、`sliding` 起滑一瞬）的核對。

積分方法：**事件分段解析積分**（event-split closed-form），與第 1 輪相同。四個情景的加速度都是分段常數，每一步 [t, t+dt] 內先解出最早的事件時刻（v 過零、越過 B、桌布尾邊追到物件／物件追上布速、巴士換相 t₁/t₂/t₃、乘客相對速度過零），用 s += vτ + ½aτ²、v += aτ 精確推進到事件，改模式後再推進餘下時間；事件時刻落在步末 10⁻⁹·dt 之內即算本步命中。除浮點捨入外沒有截斷誤差。
步長：0.005 s（index.json／index-extra.json 的 dt）。幀數：3200。運行：**25 個**（index.json 17 個 + index-extra.json 8 個）。
參數切換規則（extra 運行的 `change`）：幀的 t ≥ change.t（容差 10⁻⁹）起，observe 與 step 都改用新參數，之後保持——與 index-extra.json 的 note「由 t 起把 params 換成該值」相同。
第二實作檔：`reports/inertia-and-newtons-first-law/second-impl/model.mjs`（純 JavaScript；未讀 model.ts／plan.ts／Scene.tsx／測試；第 2 輪改動列在檔首註解）；`run.mjs` 產生 25 個 `<run>.json`；`compare.mjs` 逐幀比對並輸出 `compare-table.md`（全部 415 列 + 72 個事件幀）與 `compare.json`；`checks.mjs`（第 1 輪 26 項）與 `checks-r2.mjs`（第 2 輪新增 29 項）做額外檢查。

第 2 輪對 model.mjs 的改動（物理方程一行未改，只改離散旗標、時間窗與參數切換）：
| 項目 | 第 1 輪 | 第 2 輪 | 為何 |
|---|---|---|---|
| `stuck` | 自 t = 0 起按 v布² ≤ 2aL 報 1（預測） | 只在 phase = 1（已追上布速）時為 1 | 對照主實作約定（事件後置 1）；規格未定，見待釐清 3 |
| `sliding` | v_rel ≠ 0 | v_rel ≠ 0，或不握扶手且相對靜止但 \|a車\| > μg 的一瞬 | 主實作 0.2.0 已採納第 1 輪建議；該瞬 a乘 已 = μg，旗標與力一致 |
| 情景 2 時間窗 T | 固定 3 s | 抽不出時 t追上 + 4 s，否則 3 s | 由 `extra-cloth-stuck` 的 T = 4.6796 = 0.6796 + 4 反推；規格未定 |
| 情景 3 時間窗 T（握扶手） | t₃ + 0.5 + min(v/μg, 6) | 握扶手時 t₃ + 1.0（滑行項取 0.5） | 由 `extra-bus-handrail` 的 T = 11.6667 = 10.6667 + 1 反推；規格未定 |
| `run()` | 參數固定 | 支援 change = {t, params} | 比對 extra 運行 |

## 結論

**一致。** 25 個運行 × 全部 observe 鍵（含 t）共 **415 列**，每一列逐幀最大絕對誤差均 ≤ 1.1 × 10⁻¹¹（容限 10⁻⁶），相對誤差（sRel 除外，見註）≤ 1.5 × 10⁻¹²；**99 列離散量**（scene、phase、busPhase、sliding、stuck、nForces、nHoriz、engineOn）逐幀完全相等；**72 個事件**（放手、越過 B、抽出／追上布、停下、追上巴士、巴士換相、關引擎）的幀差全部為 0（容限 2 dt）。

8 個 extra 運行覆蓋了第 1 輪指出的三個缺口，全部一致：
- **放手事件**（M1 核心畫面、§10 條件 2、3、7、8）：`extra-release-smooth`（μ = 0，t = 0.5 s 放手）放手後 v 逐位不變、ΣF = 0、nForces 3 → 2；`extra-release-two-blocks` 放手後兩方塊各自保持 2.5 與 0.5 m s⁻¹（比 5 = m_B/m_A）；`extra-release-1s`（預設參數 t = 1.0 s 放手，方塊恰在 B）放手瞬施力換成摩擦、之後 a = −μ₂g、滑行 v_B²/(2μ₂g) = 0.57339 m 停於 s = 1.32339 m，停下後 v ≡ 0。
- **桌布抽不出**（§7 臨界條件、§10 條件 10、12）：`extra-cloth-stuck`（v布 = 1.0 < 1.085）追上時刻 v布/(μ布g) = 0.67958 s（幀 136），之後 v ≡ v布、a = f = 0、dtPull 凍結、J = m v布 = 1 N s、stuck = 1；`extra-cloth-critical-above`（v布 = 1.2）抽得出，Δt = 0.467115 s、Δv = 0.687360 m s⁻¹、滑行 0.120404 m。
- **握扶手**（§7 情景 3、§10 條件 13）：`extra-bus-handrail` 按「f = clamp(m a車, ±μmg)、餘量由扶手 Fhand 補」的**約定**（規格 §7 未定，見待釐清 4）逐幀一致：起步時 f = 117.72 N、Fhand = 62.28 N、Fnet = 180 N、sRel ≡ 0、sliding ≡ 0、nHoriz 加減速段 2／巡航 0。
- 另 `extra-bus-mu0`（乘客留在原地，全部 0 誤差）與 `extra-space-engine-off-1s`（t = 1 s 關引擎，三艘 v 自此逐位不變）亦一致。

主實作 0.2.0 兩個旗標改動核對：`dtPull` 追上後凍結於 v布/(μ布g)（第二實作同一取法，0 誤差）；`sliding` 在起滑一瞬報 1（`scenario-bus-brake`、`extra-bus-mu0`、`random-3` 的 t = 0 幀兩者皆 1；`extra-bus-handrail` 全程 0）。

額外檢查 55/55 通過（第 1 輪 26 項重跑 + 第 2 輪 29 項：放手、抽不出、握扶手約定、sliding 約定、change 規則極限、伽利略對稱、量綱）。

## 逐鍵比對

每個運行取最差的一鍵（8 個 extra 運行的全部 129 列見附錄 A；17 個主運行的 286 列與第 1 輪相同，全列見 `second-impl/compare-table.md`）。容限：本模型所有量皆有分段解析解，一律用 10⁻⁶（同時檢查 10⁻⁴，自然全過）；離散量逐幀相等或事件幀差 ≤ 2。

| 運行 | 情景 | 最差 key | 最大絕對誤差 | 最大相對誤差 | 首次超限 t | 通過 |
|---|---|---|---|---|---|---|
| default | 1 | s | 8.4e-15 | 2.6e-15 | — | ✓ |
| scenario-moving-needs-force | 1 | s | 1.7e-12 | 1.6e-14 | — | ✓ |
| scenario-stop-is-friction | 1 | s | 8.4e-15 | 2.6e-15 | — | ✓ |
| scenario-stop-not-inertia | 4 | （全部 0） | 0 | 0 | — | ✓ |
| scenario-constant-v-zero-net | 1 | s | 1.1e-15 | 1.3e-15 | — | ✓ |
| scenario-rest-not-no-force | 1 | （全部 0） | 0 | 0 | — | ✓ |
| scenario-bus-brake | 3 | sRel | 1.0e-12 | 1.0（見註） | — | ✓ |
| scenario-bus-start | 3 | （全部 0） | 0 | 0 | — | ✓ |
| scenario-heavy-not-farther | 1 | s | 1.1e-11 | 3.1e-14 | — | ✓ |
| scenario-inertia-not-speed | 4 | sB | 5.5e-12 | 3.3e-14 | — | ✓ |
| scenario-cloth-impulse | 2 | sCloth | 2.1e-13 | 1.4e-14 | — | ✓ |
| scenario-engine-off | 4 | s | 4.2e-12 | 3.0e-14 | — | ✓ |
| random-0 | 1 | （全部 0） | 0 | 0 | — | ✓ |
| random-1 | 4 | sB | 7.1e-13 | 6.0e-14 | — | ✓ |
| random-2 | 4 | （全部 0） | 0 | 0 | — | ✓ |
| random-3 | 3 | s | 3.6e-13 | 1.7e-14 | — | ✓ |
| random-4 | 2 | sCloth | 6.1e-14 | 1.4e-14 | — | ✓ |
| **extra-release-1s** | 1 | s | 3.7e-15 | 3.8e-15 | — | ✓ |
| **extra-release-smooth** | 1 | s | 4.4e-16 | 7.4e-16 | — | ✓ |
| **extra-release-two-blocks** | 1 | sB | 5.3e-15 | 6.7e-15 | — | ✓ |
| **extra-cloth-stuck** | 2 | s | 8.9e-16 | 1.7e-15 | — | ✓ |
| **extra-cloth-critical-above** | 2 | sCloth | 5.0e-14 | 1.6e-14 | — | ✓ |
| **extra-bus-handrail** | 3 | f | 1.4e-14 | 1.2e-16 | — | ✓ |
| **extra-bus-mu0** | 3 | （全部 0） | 0 | 0 | — | ✓ |
| **extra-space-engine-off-1s** | 4 | sC | 7.3e-15 | 7.3e-15 | — | ✓ |

註（sRel 相對誤差 1.0）：與第 1 輪相同——巴士停定、乘客也停下之後主實作的 `sRel` 是精確的 0，而第二實作的 s − sBus 是 ~10⁻¹² 的捨入殘差；絕對誤差 10⁻¹² 遠低於容限。

事件幀（全表見 `compare-table.md` 下半）：72 個事件幀差全部 0。extra 運行的 30 個事件：放手（幀 100、100）、關引擎（幀 200）、抽不出追上（幀 136；nForces 3→2、phase 0→1、stuck 0→1 同幀）、抽出（幀 94）與停下（幀 164）、預設放手後停下（幀 353，t = 1.765 s）、握扶手／μ = 0 的巴士換相（幀 667/1467/2134）、μ = 0 乘客 sliding 1→0 於巴士停定幀 2134。

## 不一致的判斷

沒有超出容限的不一致。記錄四點供覆核：

1. **`stuck` 旗標的語義（第 1 輪分支選擇 vs 主實作）。** 第 1 輪第二實作自 t = 0 起就報 stuck = 1（因為 v布² ≤ 2aL 由參數即可判定，是「預測」）；主實作只在 phase = 1（物件已追上布速）時報 1（是「事件」）。規格 §10 條件 10 只說「模型輸出『桌布抽不出』」，沒說何時輸出；兩種讀法都不偏離規格，但逐幀比對必須二選一。本輪改為與主實作相同（事件後置 1），改後 `extra-cloth-stuck` 的 stuck 列 0 誤差。是否應在 t = 0 就預告「抽不出」（學生調 v布 時即時看到）屬顯示決定，列在待釐清 3。
2. **`extra-release-1s` 不會出現「3 支 → 2 支」。** 預設參數下方塊到達 B 的時刻 t_B = √(2·0.75/1.5) = 1.000 s，與放手時刻相同；放手瞬間施力（紫）消失、摩擦（橙）同時出現，nForces 保持 3、nHoriz 保持 1，直到 t = 1.7645 s 停下才 3 → 2。這是規格 §8 第 2 點描述的畫面（μ₂ > 0 放手後摩擦箭嘴指向後、按 d = v²/(2μg) 停下），不是錯誤；§8 第 1 點的「3 支變 2 支」畫面只在 μ = 0 段放手（`extra-release-smooth`）出現。兩實作在這兩個運行逐幀相同。提醒 M1 畫面驗收：「預設參數 + 在 B 點放手」看到的是 F 換 f，不是水平力歸零。
3. **關引擎幀的 vC。** `extra-space-engine-off-1s` 第 200 幀（t = 1.0 s）主實作 vC = 0（精確），第二實作 vC = 1.6 × 10⁻¹⁵（−2 + 200 次 2·dt 的累加）。主實作似乎由段起點閉式計算而非逐步累加；差 10⁻¹⁵，無物理意義。
4. **時間窗 T 的兩個新推斷值。** `extra-cloth-stuck` 的 T = t追上 + 4、`extra-bus-handrail` 的 T = t₃ + 1 都是由主實作數據反推、再寫進第二實作的（否則 T 列與凍結時刻會不同）。T 是顯示量，不影響任何力或運動，但它們不在規格也不在 manifest（待釐清 5）。

## 額外檢查

### 量綱（由 §5 參數單位推）

第 1 輪 8 條（a = (F − μmg)/m、d = v²/(2μ₂g)、t_抽、Δv 與 J、滑行距離、扶手力、臨界 v布、fuel）本輪重推不變；新增：

| 式 | 推導 | 結果 |
|---|---|---|
| Fhand = m a車 − f（clamp 取法） | kg·m s⁻² − N = N；clamp 的上下限 ±μmg = N | ✓ |
| Δt 凍結值 = v布/(μ布g)（抽不出） | (m s⁻¹)/(1·m s⁻²) = s；J = fΔt = μ布mg · v布/(μ布g) = m v布，kg m s⁻¹ = N s | ✓ |
| 追上時布相對物件走過 v布²/(2a) | (m s⁻¹)²/(m s⁻²) = m；預設 v布 = 1.0 時 0.3398 m < L = 0.4 m（尾邊仍在物件下，「抽不出」成立） | ✓ |
| T = t追上 + 4 s、T = t₃ + 1 s | s + s = s | ✓（常數 4、1 的來源見待釐清 5） |

### 對稱

| 檢查 | 結果 |
|---|---|
| 第 1 輪五項（巴士起步／煞車鏡像、太空 sC = −sB、引擎反向變號、兩方塊 a 比、W = N） | 重跑全過 |
| **伽利略對稱（新）**：三艘同受 a = 2 m s⁻² 一秒後關引擎 → 三艘 Δv 相同（= 2），之後 v 各自不變且 B、C 對 A 鏡像：s_B + s_C = 2 s_A | v = 2、vB = 4、vC = 0；s_A(12) = 23、s_B = 47、s_C = −1，s_B + s_C = 46 = 2 s_A（誤差 < 10⁻¹²）✓；主實作同一運行逐幀一致 |
| **握扶手 vs 不握（新）**：μg ≥ a（μ = 0.35）時扶手無事可做 → 兩者 s、v、a、f、Fnet 逐幀逐位相同、Fhand ≡ 0 | ✓ |
| **change 規則（新）**：t = 0 放手 ≡ 全程「已放手」；t → ∞ 放手 ≡ 無 change；t = 0 關引擎 ≡ 全程引擎關（逐幀逐位相同） | ✓ 三項 |
| **放手幀連續（新）**：放手幀的 s、v 與未放手運行相同，只有 a、Fapp、Fnet 跳變 | ✓ |

### 極限

| 極限 | 預期 | 第二實作 |
|---|---|---|
| 第 1 輪 18 項（μ → 0 永不停、F = μmg 臨界、v布 ≫、μ布 = 0、L 短長、巴士 μ = 0／μg ≥ a／μg < a、握扶手、太空 m × 10、關引擎三艘、能量） | — | 重跑全過 |
| 放手（μ = 0，t = 0.5）：放手後 v 逐位不變、ΣF = a = 0、nForces = 2（§10 條件 2） | v = 0.75 = a t 精確 | ✓ |
| 放手（預設，t = 1.0 在 B）：滑行 d = v_B²/(2μ₂g)、停下後 v ≡ 0、f = 0、永不為負（§10 條件 7） | d = 0.573394 m，停下 t = 1.7645 s | ✓（相對誤差 3 × 10⁻¹⁵） |
| 放手能量：F·L_AB = ½mv_B² = μ₂mg·d（§10 條件 15） | 0.225 J | ✓ |
| 兩方塊放手：Δv_A/Δv_B = m_B/m_A = 5，放手後兩者 v 逐位不變（§8 第 5 點、§10 條件 8） | 2.5 / 0.5 | ✓ |
| 抽不出：追上時刻落在幀 ⌈t/dt⌉；追上前 stuck = 0、\|a\| = μ布g、v < v布；追上後 v ≡ v布、a = f = 0、stuck = 1（§10 條件 10、11） | 幀 136 | ✓ |
| 抽不出：Δt 凍結於 v布/(μ布g)，J = fΔt = m v布（§10 條件 12 在此分支仍成立） | J = 1.000 N s | ✓ |
| 臨界值 v布 = √(2μ布gL) = 1.08499 本身 | 歸入抽不出（§7 用 ≤），終速 = v布 | ✓ |
| 臨界值稍上 v布 = 1.2 | 抽得出；Δt、Δv、滑行距離與精確解一致 | ✓ |
| 握扶手（約定）：\|f\| ≤ μmg、f + Fhand = m a車、sRel ≡ 0、sliding ≡ 0；加減速段 nHoriz = 2、巡航 0 | — | ✓ |
| 握扶手、\|a車\| ≤ μg（a = 1.5） | Fhand ≡ 0、f = m a車 = 90 N（與不握相同） | ✓ |
| 握扶手、μ = 0 | f ≡ 0、Fhand = m a車 = 180 N、sRel ≡ 0 | ✓ |
| sliding：t = 0 相對靜止但 \|a車\| > μg → 1，且該瞬 a乘 = μg；sliding = 1 ⇔ \|f\| = μmg（或 μ = 0 時 f = 0），sliding = 0 ⇔ f = m a車 | 旗標與力逐幀一致 | ✓ |
| sliding：\|a車\| ≤ μg 全程 0；μ = 0 起步瞬即 1，巴士停定（v乘 = v車 = 0）才 0 | — | ✓ |

## 規格待釐清

第 1 輪 10 項中，第 2（放手運行）、第 9（sliding 起滑一瞬）已由主流程解決，本輪不再列；第 3 部分解決（資料已有抽不出運行，但旗標語義與時間窗仍未定）。保留與新增如下：

1. **B 點本身屬光滑段還是粗糙段。**（第 1 輪第 1 項，fix-log 已列為待老師）§7 沒說；兩實作都取 s ≥ L_AB 即粗糙（閉於 B）。預設參數下 t_B = 1.000 s 恰好落在幀上，而 `extra-release-1s` 又正是在這一幀放手——建議規格寫明，並注意這令「預設參數 + 在 B 放手」看到的是施力換摩擦（3 支 → 3 支），不是 §8 第 1 點的 3 支 → 2 支（該畫面須在 μ = 0 段放手）。
2. **`stuck` 是預測還是事件。**（第 1 輪第 3 項的餘下部分）主實作與本輪第二實作都在追上布速後才報 1；學生把 v布 調到 1.085 以下時，追上前（預設約 0.68 s）畫面仍顯示「抽得出中」。若要即時預告，旗標應在 t = 0 就按 v布² ≤ 2μ布gL 置 1。顯示決定，請老師定奪。
3. **握扶手時摩擦的取法。**（第 1 輪第 4 項；fix-log 待老師第 1 項）本輪按「f = clamp(m a車, ±μmg)、餘量由扶手補」比對，一致；但這是**約定**，規格 §7 只寫「扶手力 = m a車 − f」而沒定 f。另一讀法 f = 0、扶手力 = m a車。兩讀法的 Fnet、a、s 相同，f、Fhand、nHoriz 不同（本約定下加減速段 nHoriz = 2，另一讀法為 1）。
4. **時間窗 T 的公式不在規格也不在 manifest。**（第 1 輪第 5 項，本輪多兩個推斷值）目前由數據反推：情景 1、4 = 12 s；情景 2 = 3 s，抽不出時 t追上 + 4 s；情景 3 = t₃ + 0.5 + min(v/(μg), 6)，握扶手時 t₃ + 1.0（μ = 0 時 t₃ + 6.5）。T 決定何時凍結畫面；建議在 manifest 寫明公式，尤其抽不出的「+ 4 s」與握扶手的「+ 1 s」。
5. **a車 = 0（控制項下限）** 令 t₁ = v/a 無定義。（第 1 輪第 6 項；fix-log 待老師第 3 項）第二實作當作巴士永不起步。
6. **零量值的力算不算一支力。**（第 1 輪第 7 項；fix-log 待老師第 4 項）「施力中」但 F = 0、「引擎開」但 F引擎 = 0（情景 4 預設）；兩實作都取「量值為 0 不計」。
7. **fuel = 0.05 × F引擎 的 0.05 沒有單位。**（第 1 輪第 8 項；fix-log 待老師第 5 項）
8. **主實作 sRel 在乘客停於停定巴士時為精確 0**，而 s − sBus 為 10⁻¹²。（第 1 輪第 10 項）無物理影響；若是刻意歸零建議在 manifest 註明。
9. **（新）extra 運行的 `change` 規則未寫進 manifest。** index-extra.json 的 note 定義為「由 t 起把 params 換成該值」，兩實作都在 t ≥ change.t 的幀即用新參數 observe（放手幀本身已顯示 Fapp = 0）。互動時「放手」按鈕是否亦在按下的那一幀立即生效（而非下一步），與 `plan()` 的垂直標記線位置有關，建議寫明。

---

## 附錄 A：8 個 extra 運行全部 129 列逐鍵比對（compare.mjs 輸出；17 個主運行的 286 列見 `second-impl/compare-table.md`）

| 運行 | key | 最大絕對誤差 | 最大相對誤差 | 首次超限 t (1e-6) | 通過 |
|---|---|---|---|---|---|
| extra-release-1s | t | 0 | 0 | — | ✓ |
| extra-release-1s | scene | 0 | 0 | — | ✓ |
| extra-release-1s | s | 3.66e-15 | 3.84e-15 | — | ✓ |
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
| extra-cloth-stuck | s | 8.88e-16 | 1.74e-15 | — | ✓ |
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
| extra-cloth-critical-above | s | 5.55e-16 | 1.98e-15 | — | ✓ |
| extra-cloth-critical-above | v | 6.66e-16 | 1.39e-13 | — | ✓ |
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
| extra-cloth-critical-above | dtPull | 2.22e-16 | 4.75e-16 | — | ✓ |
| extra-cloth-critical-above | dv | 3.33e-16 | 4.85e-16 | — | ✓ |
| extra-cloth-critical-above | J | 3.33e-16 | 4.85e-16 | — | ✓ |
| extra-cloth-critical-above | slide | 3.05e-16 | 7.03e-14 | — | ✓ |
| extra-cloth-critical-above | stuck | 0 | 0 | — | ✓ |
| extra-bus-handrail | t | 0 | 0 | — | ✓ |
| extra-bus-handrail | scene | 0 | 0 | — | ✓ |
| extra-bus-handrail | s | 0 | 0 | — | ✓ |
| extra-bus-handrail | v | 0 | 0 | — | ✓ |
| extra-bus-handrail | T | 0 | 0 | — | ✓ |
| extra-bus-handrail | a | 0 | 0 | — | ✓ |
| extra-bus-handrail | f | 1.42e-14 | 1.21e-16 | — | ✓ |
| extra-bus-handrail | Fhand | 1.42e-14 | 2.28e-16 | — | ✓ |
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
| extra-bus-mu0 | t | 0 | 0 | — | ✓ |
| extra-bus-mu0 | scene | 0 | 0 | — | ✓ |
| extra-bus-mu0 | s | 0 | 0 | — | ✓ |
| extra-bus-mu0 | v | 0 | 0 | — | ✓ |
| extra-bus-mu0 | T | 0 | 0 | — | ✓ |
| extra-bus-mu0 | a | 0 | 0 | — | ✓ |
| extra-bus-mu0 | f | 0 | 0 | — | ✓ |
| extra-bus-mu0 | Fhand | 0 | 0 | — | ✓ |
| extra-bus-mu0 | Fnet | 0 | 0 | — | ✓ |
| extra-bus-mu0 | W | 0 | 0 | — | ✓ |
| extra-bus-mu0 | N | 0 | 0 | — | ✓ |
| extra-bus-mu0 | nForces | 0 | 0 | — | ✓ |
| extra-bus-mu0 | nHoriz | 0 | 0 | — | ✓ |
| extra-bus-mu0 | vBus | 0 | 0 | — | ✓ |
| extra-bus-mu0 | aBusNow | 0 | 0 | — | ✓ |
| extra-bus-mu0 | sBus | 0 | 0 | — | ✓ |
| extra-bus-mu0 | sRel | 0 | 0 | — | ✓ |
| extra-bus-mu0 | busPhase | 0 | 0 | — | ✓ |
| extra-bus-mu0 | sliding | 0 | 0 | — | ✓ |
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

## 附錄 B：extra 運行的事件幀（主實作 vs 第二實作）

| 運行 | key | 主實作 | 第二實作 | 幀差 |
|---|---|---|---|---|
| extra-release-1s | nForces / nHoriz | 3→2 / 1→0 @ 幀 353 (t=1.765，停下) | 同 | 0 |
| extra-release-smooth | nForces / nHoriz | 3→2 / 1→0 @ 幀 100 (t=0.500，放手) | 同 | 0 |
| extra-release-two-blocks | nForces / nHoriz | 3→2 / 1→0 @ 幀 100 (t=0.500，放手) | 同 | 0 |
| extra-cloth-stuck | nForces / nHoriz / phase / stuck | 3→2 / 1→0 / 0→1 / 0→1 @ 幀 136 (t=0.680，追上布速) | 同 | 0 |
| extra-cloth-critical-above | phase | 0→2 @ 幀 94 (t=0.470，抽出) | 同 | 0 |
| extra-cloth-critical-above | nForces / nHoriz / phase | 3→2 / 1→0 / 2→3 @ 幀 164 (t=0.820，停下) | 同 | 0 |
| extra-bus-handrail | busPhase / nForces / nHoriz | 0→1 (4→2, 2→0) @ 667；1→2 (2→4, 0→2) @ 1467；2→3 (4→2, 2→0) @ 2134 | 同 | 0 |
| extra-bus-mu0 | busPhase | 0→1 @ 667；1→2 @ 1467；2→3 @ 2134 | 同 | 0 |
| extra-bus-mu0 | sliding | 1→0 @ 幀 2134 (t=10.670，巴士停定) | 同 | 0 |
| extra-space-engine-off-1s | nForces / nHoriz / engineOn | 1→0 @ 幀 200 (t=1.000，關引擎) | 同 | 0 |
