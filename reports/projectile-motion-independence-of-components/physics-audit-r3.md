# 物理核數：projectile-motion-independence-of-components（第 3 輪，主實作 v0.2.1；核數期間 Scene.tsx 已改為 v0.2.2）
規格：`reference/11_Book2_難點與3D模擬器規格.md` 模擬器 2（拋體運動：水平與垂直的獨立性）、§0.2–0.3、§4　數據：11 個官方運行（`data/`，每運行 4000 幀，dt = 0.001 s，06:27 匯出）+ 25 個核數員補跑運行（`audit/extra-data-r3/`，以作者現行 model / plan 重新匯出，額外記錄 `plan.bodies` / `plan.trails` / `model.done`；未讀其原始碼），共 36 個運行、144 000 幀

版本狀態（核數員由檔案時間實測，供主流程對照）：
- `data/`（06:27:08）與 `shots/`（06:27–06:29）由 v0.2.1 產生（截圖頁首印 v0.2.1）。
- `plan.ts` 最後修改 06:25:07，早於數據匯出：**數據反映現行 plan.ts**。
- `Scene.tsx` 最後修改 06:38:44、`manifest.ts` 06:37:55（版本改為 0.2.2，註「第 3 輪後，未經覆核：取景包圍盒加入標籤與比例尺、相機角度放低；量角器弧與刻度同一範圍」），**晚於官方截圖**。即 `shots/` 不是現行 Scene 的畫面。核數員以同一截圖工具的副本（`tools/shots.mjs` 只改輸出目錄）在 06:45 對現行程式碼重拍一套：`audit/shots-r3-current/`（頁首印 v0.2.2）。§5 兩套都引用並註明版本。

核數程式（全部重跑，不沿用前兩輪結果）：
- `audit/audit-r3.mjs`（由 audit-r2 改：x 標籤 [x·k, 0.05, 1.4]、y 標籤 [−3.6, y·k + r, 0]、companion = drop 時不得有 ycol、所有標籤 y ≥ 0）：規格解析解 + 自寫 RK4（子步長 1e-4 s，落地二分至 1e-13 s）；逐幀比對 obs、箭嘴、bodies、trails、done、縮放、能量、非有限數。結果 `audit/results-r3.json`、`audit/audit-r3.log`。
- `audit/followup-r3.mjs`：對稱、射程、兩球同高、最高點讀數、負角 H、阻力落地時刻、done／時鐘、頻閃間距、縮放規則。`audit/followup-r3.log`。
- `audit/extra-export-r3.mts`：補跑運行（`npx tsx --tsconfig tsconfig.app.json`）。
- `audit/lag-check-r3.mjs`：在頁面內每 25 ms 讀一次 `document.body.innerText`（同一次讀取 = 同一 DOM 快照），量 3D 標籤與讀數的落後與各自更新率，另量 rAF 幀率。`audit/lag-check-r3.log`。
- `audit/ballb-visibility-r3.mjs`、`audit/framing-r3.mjs`：情境 1 跳到 t = 0.3 / 0.6 / 1.0 / 1.5 s 截 3D 區域；三種流程新載入頁面比對取景。`audit/r3-s1-t*.png`、`audit/r3-framing-*.png`。
- `audit/r3-crop-*.png`：截圖局部放大（`audit/pngcrop.mjs`）。

比對準則：無空氣阻力用規格解析解，容許相對誤差 1e-6；有空氣阻力用自寫 RK4（a = −k v|v|，k = 0.01 m⁻¹，manifest.beyondSpec 所述），容許 1e-4；向量加法 1e-9。相對誤差分母取 max(|預期值|, 該量的特徵尺度)（速度 u、長度 max(h, u²/g, 1)、加速度 g、能量 ½u² + gh）。

## 結論
**通過**：物理數據（與第 2 輪逐位相同）、箭嘴、bodies、新標籤位置、drop 時無 ycol、done 時鐘、參數表、三條驗證條件、三項現象。第 2 輪不通過項 **5.1a 已修正**：情境 1（h = 20 m）的 3D 視窗現在見到發射器、量角器、夾持座、橙球、整條路徑與落地（`shots/scenario-1-early.png`、`scenario-1-end.png`；現行程式碼 `audit/shots-r3-current/scenario-1-early.png`、`scenario-1-end.png`）。

附帶條件（非物理，請主流程處理）：
- **C1**：`shots/` 是 v0.2.1 的畫面，`Scene.tsx` 已在截圖後改為 v0.2.2。簽收前須以現行程式碼重拍 `shots/`。v0.2.1 截圖有三處標籤出框（§3 末、§5），v0.2.2 重拍全部在框內。
- **C2**：3D 的 x、y 標籤（LiveLabel）在播放中**恆定落後讀數一格更新**（暫停與落地後逐字相同）。無頭 Chromium 播放中狀態更新只有 3.6–6.8 次/s，故一格 = 0.15–0.28 s 實時；實機 60 fps 應為 1/60 s。詳 §3 末，請前端在實機確認。
- **C3**：情境 1 自由下落的藍球在 3D 視窗起始約 0.5 s（下落 ≲ 1 m）被夾持座／塔頂遮住，t = 0.6 s 起可見（`audit/r3-s1-t0.3-top.png` 對 `r3-s1-t0.6-top.png`）。側視投影與讀數全程可見，故現象 1 判通過；列出供儀器審視者決定。

## 1. 驗證條件（規格逐條）

| # | 條件原文 | 我的計算 | 導出數據 | 誤差 | 通過 |
|---|---|---|---|---|---|
| 1a | 空氣阻力關閉時，路徑必須嚴格對稱：上升時間等於下降時間 | t_up = u sinθ / g：default（u 15, θ 40°）0.982855672304 s；no-forward-force（u 20, θ 50°）1.561762371293；a-at-top（θ 60°）1.324197865114；range-45（θ 70°）1.436838869703 | vᵧ 過零幀線性內插 t_up = 0.982855672304 / 1.561762371292 / 1.324197865114 / 1.436838869703 s；t_down = obs.tf − t_up | \|t_up − t_down\| = 1.07e-13、1.11e-13、1.11e-13、1.10e-13 s（top-not-zero 同 default） | 通過 |
| 1b | 落地速率等於初速（同一水平面） | h = 0 各運行 v_land = u；落地 vᵧ = −u sinθ | default 15；no-forward-force 20；a-at-top 15；range-45 14.999999999999998；angle-15/30/45/60/75：15、15、15.000000000000002、15、14.999999999999998；default 落地 vᵧ = −9.64181414529809（−u sinθ = −9.641814145298088） | max \|v − u\| = 2e-15 m s⁻¹ | 通過 |
| 1c | 路徑對稱（y、vᵧ 對 t_up 鏡像） | y(t_up − τ) 對 y(t_up + τ)、vᵧ(t_up − τ) 對 −vᵧ(t_up + τ)，τ 每 1 ms 線性內插 | 5 個 h = 0 官方運行 | max \|Δy\| = 8.4e-13、8.4e-13、3.1e-12、5.9e-7、2.5e-12 m（5.9e-7 在內插截斷上限 g·dt²/8 = 1.2e-6 之內；逐幀對解析解誤差 1.6e-14）；max \|vᵧ + vᵧ'\| ≤ 2.0e-12 m s⁻¹ | 通過 |
| 2a | θ = 45° 時射程最大 | R = u² sin 2θ / g，u 15, h 0：R₄₅ = 22.935779816513760 m | 補跑落點：15° 11.467889908256817；30° 19.862967976707797；45° 22.935779816513126；60° 19.86296797670807；75° 11.467889908256387；官方 40° 22.58733378468447、70° 14.742835084553645 | 各角度落點對公式差 ≤ 7.6e-13 m；R₄₅ 大於其餘六個 | 通過 |
| 2b | θ 與 90° − θ 的射程相同 | R(15°) = R(75°) = 11.467889908256879；R(30°) = R(60°) = 19.862967976707306 | 同上；「各角度射程比較」圖層 ghost-15/30/45/60/75 末點 x/k 與公式逐位相同（差 ≤ 5e-15），末點 y = r（落地），首點 (0, h·k + r, 0) | \|R₁₅ − R₇₅\| = 4.3e-13、\|R₃₀ − R₆₀\| = 2.7e-13 m | 通過 |
| 3 | vₓ 在全程數值不變（容許誤差 10⁻⁶） | vₓ = u cosθ 常數 | 17 個無阻力運行（官方 8 + 補跑 9）落地前每幀 vₓ 極差 | 極差 = 0（逐位相同）；default 11.49066664678467 全 1966 幀 | 通過 |

## 2. 逐幀比對

**與第 2 輪的一致性**：8 個官方運行（default、5 個情境、random-0、random-3）的 obs / arrows / scales / meta 與第 2 輪 `audit/extra-data-r2/official-*.json` 逐幀逐位相同（差異幀 0）；只有 labels 每幀不同（位置改了，數值相同）。即 model.ts 未改、plan 的物理輸出未改，本輪改動只在標籤位置與 ycol。本輪補跑（extra-data-r3）與 `data/` 的一致性亦為 diffFrames = 0。

所有 36 個運行每幀每量與我的獨立計算一致；下表列各運行最大相對誤差。

| 運行 | 量 | 最大誤差（相對） | 出現於 t | 通過 |
|---|---|---|---|---|
| default（fast） | t / tf | 5.4e-14 | 1.965 s | 通過 |
| default | x / y / vy / v / Ek | 3.5e-14 / 7.8e-15 / 1.2e-14 / 7.7e-15 / 1.5e-14 | 1.955–1.966 s | 通過 |
| default | xB / yB / EkB | 3.6e-14 / 7.8e-15 / 5.7e-15 | 1.962–1.966 s | 通過 |
| default | H（h + u² sin²θ / 2g = 4.7382558620015445）；ax、ay（落地前） | 0 / 0 / 0 | 全程 | 通過 |
| scenario-same-landing（u 10, θ 0, h 20, drop） | t / x / y / vy / v / Ek / xB / yB / EkB | 5.5e-14 / 1.9e-14 / 6.3e-15 / 2.5e-14 / 2.0e-14 / 4.0e-14 / 0 / 6.3e-15 / 4.0e-14 | 1.741–2.020 s | 通過 |
| scenario-same-landing | 落地時刻 | 數據 tf 2.0192751093845005；√(2h/g) = 2.019275109384609 | 差 1.1e-13 s | 通過 |
| scenario-top-not-zero | 全部 | ≤ 5.4e-14 | ≤ 1.966 s | 通過 |
| scenario-no-forward-force（u 20, θ 50°） | 全部 | ≤ 7.5e-14 | ≤ 3.123 s | 通過 |
| scenario-a-at-top（θ 60°） | 全部 | ≤ 6.8e-14 | ≤ 2.649 s | 通過 |
| scenario-range-45（θ 70°） | 全部 | ≤ 7.2e-14 | ≤ 2.873 s | 通過 |
| random-0（air, u 5.73, θ 70.1°, h 47.4） | 全部（對我的 RK4） | ≤ 1.8e-12（y） | 3.963 s | 通過（容許 1e-4） |
| random-0 | 落地時刻 | 我的 RK4 3.963494264；數據 3.963494263758212 | 3.8e-12 s | 通過 |
| random-1（air, g 3.7；4 s 內未落地） | 全部 | ≤ 4.5e-13（ay） | 3.997 s | 通過 |
| random-2（air；4 s 內未落地） | 全部 | ≤ 1.6e-12（y） | 3.999 s | 通過 |
| random-3（θ −9.9°, h 43.2, g 9.8） | 全部 | ≤ 1.0e-13（Ek） | 2.732 s | 通過 |
| random-3 | H | obs.H = 43.21773408130637 = h；我取 θ < 0 時 H = h（§7 第 1 條） | 0 | 通過 |
| random-4（u 46.6, θ 82.3°, g 3.7；4 s 內未落地） | 全部 | ≤ 2.2e-13（Ek） | 3.822 s | 通過 |
| 補跑 angle-15/30/45/60/75、drop-default、drop-h20-theta0、edge-theta90-h0、edge-u1-theta90-h0-g1.6、edge-u50-theta45-h50-g1.6 | 全部 | ≤ 1.7e-13 | — | 通過 |
| 補跑 edge-u50-theta45-h50-g10-air、edge-u50-theta-30-h50-air、air-default-fast、air-u50-theta40-h0-drop | 全部（對我的 RK4） | ≤ 8.3e-13 | — | 通過 |
| 補跑 edge-u50-theta-30-h50-air（drop） | 兩球落地時刻 | 我的 RK4 主球 2.025386710、第二顆球 3.464261325 s | 數據 2.0253867095126505、3.464261325476878 | 通過 |
| 補跑 edge-theta-30-h0、edge-theta-30-h0-fast、edge-u1-theta0-h0（θ ≤ 0 且 h = 0） | vx / v / Ek | 數據首幀即落地，vₓ、v、Eₖ 顯示 0；我的解析值 u cosθ | 定義差異，非數值錯（§7 第 3 條，與前兩輪相同） | 待釐清 |

其他逐幀事實（與第 2 輪相同，本輪重新核實）：
- frame.t = obs.t 逐幀；obs.t = i·dt 至 8e-14。落地後 obs.t、obs.tf 凍結在 tf，y 凍結為精確 0，vᵧ 凍結為 −u sinθ，ax、ay 變 0。
- done：25 個補跑運行 done 首幀 = 兩球（或單球）皆落地的第一幀（default 1966、same-landing 2020、random-0 3964、angle-15 792、edge-u50-theta-30-h50-air 3465——主球 2026 幀已落地但第二顆球未落地時 done 仍 false）；done 後 obs.t 變動 0 次；「未落地先 done」0 次。
- 兩顆球：same-landing（drop）與 default（fast）逐幀 max \|y − yB\| = 0，落地幀 A = B（2020 / 1966）。
- 最高點：top-not-zero t = 0.983 s 幀 vᵧ = −1.42e-3、vₓ = 11.49066664678467、Eₖ = 66.0177 J = ½vₓ²、meta.EkMin = 66.01770999376483；a-at-top t = 1.324 s 幀 ay = −9.81、加速度箭嘴 [0, −9.81, 0]、畫長 3.2。

## 3. 畫面向量

| 檢查 | 結果 | 證據（幀 / 數值） |
|---|---|---|
| 速度箭嘴 = 模型速度（非差分） | 通過 | 36 運行落地前每幀 velocity 層 vector 對 obs (vx, vy, 0) 最大差 0 |
| vₓ、vᵧ 分量箭嘴；分量和 = 速度箭嘴 | 通過 | vx 層 (vx, 0, 0)、vy 層 (0, vy, 0) 最大差 0；分量和 − v 箭嘴最大差 0 |
| 加速度箭嘴 = 模型加速度 | 通過 | acceleration 層 vector 對 obs (ax, ay, 0) 最大差 0；無阻力 = (0, −g, 0)；阻力運行對我的 −k v (vx, vy) − g ŷ 相對差 ≤ 7.9e-13 |
| 加速度箭嘴長度恆定（無阻力） | 通過 | 17 個無阻力運行 \|a\| 每幀 min = max = g（9.81 / 9.8 / 3.7 / 1.6 逐位） |
| 加速度箭嘴畫長 3.2 世界單位 | 通過 | 無阻力運行每幀 \|a\| × scales.acceleration − 3.2 最大差 0（scales.acceleration = 3.2/g） |
| 重量箭嘴畫長 2.4 世界單位 | 通過 | 無阻力運行每幀 mg × scales.weight − 2.4 最大差 0；scales.friction = scales.weight 全部運行成立 |
| 阻力運行的畫長 | 通過（規則一致，規格未定） | 7 個阻力運行 scales.acceleration = 3.2/(g + k(u² + 2gh))、scales.weight = 2.4/同一分母（反算相符至 1e-12）；同一 kind 縮放全程唯一 |
| 加速度箭嘴起點 z = 0.8（A_OFF） | 通過 | acceleration origin 對 (x·k, y·k + r, 0.8) 最大差 0；其餘主球箭嘴 origin (x·k, y·k + r, 0) 最大差 0 |
| 重量箭嘴 | 通過 | (0, −mg, 0)，m = 1，最大差 0；只有一支、向下 |
| 空氣阻力箭嘴（kind friction，層 air） | 通過 | 只在 air = true 出現；vector 對 −m k v (vx, vy, 0) 最大差 0；箭嘴數 6（阻力）/ 5（無阻力）每幀成立 |
| F = ma：力箭嘴之和 = m × 加速度箭嘴 | 通過 | weight（+ friction）向量和 − m·a 箭嘴最大差 0（容許 1e-9），含 7 個阻力運行 |
| 第二顆球箭嘴 | 通過 | 只有 v、vₓ、vᵧ 三支；origin (xB·k, yB·k + r, −zOff)；vector 對我的 (2u cosθ 或 0, vᵧ) 差 ≤ 7.1e-12 |
| 落地後不畫箭嘴 | 通過 | landedA / landedB 之後箭嘴數 0；落地前缺箭嘴幀數 0 |
| 同一 kind 縮放係數全程唯一 | 通過 | 36 運行 scales 逐幀 JSON 相同（變化 0）；meta.k 全程不變 |
| **x 標籤位置 [x·k, 0.05, 1.4]（本輪）** | 通過 | 36 運行每幀 x 標籤 value = obs.x（差 0）、position 對 (x·k, 0.05, 1.4) 最大差 0；例：same-landing 幀 346 [2.150, 0.05, 1.4]，value 3.46 |
| **y 標籤位置 [−3.6, y·k + r, 0]（本輪）** | 通過 | value = obs.y（差 0）、position 對 (−3.6, y·k + r, 0) 最大差 0；例：same-landing 幀 346 [−3.6, 12.414, 0]，value 19.413 |
| **所有標籤 y ≥ 0（本輪）** | 通過 | 36 運行 × 4000 幀 × 2 標籤，position[1] < 0 的次數 0（x 標籤 y = 0.05 常數；y 標籤最低 r = 0.35） |
| **companion = drop 時不輸出 ycol-a（本輪）** | 通過 | 6 個 drop 運行（official-same-landing、drop-default、drop-h20-theta0、edge-u1-theta90-h0-g1.6、edge-u50-theta-30-h50-air、air-u50-theta40-h0-drop）每幀 ycol-a-* 數 0；其餘 19 個運行 ycol-a-j 每格存在，位置對 (−0.9, y(0.1j)·k + r, −7) 最大差 ≤ 2.6e-11，shape = cylinder |
| 球與地面影子（ball / gshadow） | 通過 | ball-a (x·k, y·k + r, 0)、ball-b (xB·k, yB·k + r, −zOff) 最大差 0；gshadow-a (x·k, 0.015, 0)、gshadow-b 最大差 0，每幀存在 |
| 頻閃影像與影子（strobe / shadow / wall） | 通過 | 影像數 = ⌊min(t, tf)/0.1⌋ + 1 每幀成立（計數錯誤 0）；strobe-a-j 對 (x(0.1j)·k, y(0.1j)·k + r, 0) 最大差 ≤ 3.8e-12；shadow-a-j (·, 0.01, 0)；wall-a-j (·, ·, −7) ≤ 2.6e-11 |
| 路徑與投影線 | 通過 | path-a 首點 (0, h·k + r, 0) 差 0；末點對球心差 ≤ 0.25 世界單位（取樣間隔 0.02 s 的位移）；sync 線兩端 = 兩球心（差 0）；ghost-θ 首點、末點見 §1 2b |
| 顏色（§0.3） | 通過 | `audit/shots-r3-current/scenario-2-early.png`、`scenario-4-early.png`：v、vₓ、vᵧ 綠色實線；a 綠色虛線（起點偏後、標 a）；W 紅色實線（標 W）；標籤不重疊 |
| a ⊥ v、法向力、張力 | 不適用 | 本模擬無接觸面、無繩 |

**C2 播放中 3D 標籤落後讀數（LiveLabel，非物理錯誤，請前端在實機核對）**。`audit/lag-check-r3.mjs`，無頭 Chromium 1440 × 900，每 25 ms 一次同一 DOM 快照：

| 情況 | 3D 標籤更新率 | 讀數更新率 | 同一快照 讀數 − 3D 標籤（換算模擬時間） | 逐字相同快照 | 「3D 標籤 = 變動前讀數值」 |
|---|---|---|---|---|---|
| 情境 1，0.1× 播放 | 6.8 次/s | 6.6 次/s | min 0.010 / mean 0.015 / max 0.033 s | 0 / 57 | 15 / 19 次讀數變動（其餘 4 次為取樣漏掉一格） |
| 情境 1，暫停後 | — | — | 0 | 14 / 14 | — |
| 預設，1× 播放 | 3.6 次/s | 3.6 次/s | 0.033 / 0.111 / 0.500 s | 0 / 28 | 3 / 4 |
| 預設，落地後（時鐘停） | — | — | 0 | 11 / 11 | — |
| 預設，0.1× 播放 | 3.6 次/s | 4.0 次/s | 0.002 / 0.015 / 0.059 s | 0 / 53 | 5 / 11 |
| 情境 1，1× 播放 | 5.8 次/s | 5.8 次/s | 0.010 / 0.155 / 0.440 s | 0 / 21 | 6 / 8 |

判讀：3D 標籤與讀數更新率相同，但 3D 標籤顯示的是**上一次**更新的讀數值（序列例：讀數 3.11→3.28 時 3D 為 3.11；3.28→3.41 時 3D 為 3.28…），即恆定落後一格。第 2 輪量到落後兩格（1× 時 0.65–0.85 s），本輪改為 useFrame 直接寫 DOM 後餘一格。無頭 Chromium 播放中 rAF 26–29 fps（靜止時 36–39 fps），但狀態更新只有 3.6–6.8 次/s，一格 = 0.15–0.28 s 實時，所以截圖看得出（`shots/scenario-1-early.png` 3D x = 3.21 對讀數 3.46，t 0.346；`audit/shots-r3-current/scenario-3-early.png` 3D x = 4.00 / y = 4.29 對讀數 4.47 / 4.74，t 0.348）。實機 GPU 若每 rAF 更新一次，一格 = 1/60 s：0.1× 播放時 x 相差 0.02 m（第三位有效數字），1× 時 0.19 m（vₓ 11.5）。是否可接受由前端／老師定；核數員只確認：暫停與落地後兩者逐字相同，數值本身正確。

**v0.2.1 截圖（`shots/`）標籤出框，v0.2.2 重拍已無**：
- `shots/desktop.png`、`scenario-2-early.png`、`scenario-2-end.png`、`scenario-3-early.png`、`scenario-3-end.png`：y 標籤（x = −3.6 世界單位）被 3D 視窗左緣切掉，只剩「00 m」「19 m」「m」（放大 `audit/r3-crop-desktop-ylabel.png`、`r3-crop-s3early-ylabel.png`）。
- `shots/scenario-1-early.png`：x 標籤「x = 3.21」貼底緣被切一半，並與「俯視投影」說明重疊（`audit/r3-crop-s1early-bottom.png`）。
- 現行 v0.2.2（`audit/shots-r3-current/`）：desktop「y = 0.00 m」、scenario-2-early「y = 2.52 m」、scenario-3-early「y = 4.29 m」、scenario-1-early「x = 3.26 m」全部完整在框內。餘下小事：scenario-1 的「俯視投影」說明與比例尺「5 m」文字重疊（`audit/shots-r3-current/scenario-1-early.png` 底部）。

## 4. 參數範圍與預設

| 參數 | 規格 | controls.ts | 一致 |
|---|---|---|---|
| u 初速 | 1 – 50，預設 15，m s⁻¹ | min 1, max 50, default 15, unit "m s⁻¹", step 0.5 | 一致 |
| θ 投射角 | −30° – 90°，預設 40° | min −30, max 90, default 40, unit "°", step 1 | 一致 |
| h 發射高度 | 0 – 50，預設 0，m | min 0, max 50, default 0, unit "m", step 0.5 | 一致 |
| g 重力加速度 | 1.6 / 3.7 / 9.81，預設 9.81 | select：9.81（考評局）、9.8、10、3.7（火星）、1.6（月球），default 9.81 | 一致（9.8、10 為 §0.2 第 3 條要求，manifest.beyondSpec 已註明） |
| 空氣阻力 | 開／關，預設關 | toggle, default false | 一致 |
| 第二顆球 | 規格無此參數 | segment：none / drop / fast，default "fast" | 規格以外（manifest.beyondSpec 第 2 條） |
| defaults 物件 | — | { u 15, theta 40, h 0, g 9.81, air false, companion "fast" } | 與各控制項 default 一致 |

controls.ts、scenarios.ts 本輪未改（與第 2 輪逐字相同）。情境 1 params { u 10, θ 0, h 20, companion "drop" }，expect「2.02 s」= 2.0193 s；情境 2「約 0.98 s」= 0.9829 s、vₓ 11.5 = 11.4907；情境 4「約 1.32 s」= 1.3242 s；情境 5 落點次序與 §1 條件 2 相符。manifest version：核數開始時 0.2.1，06:37 改為 0.2.2（見頁首）。

## 5. 學生應該看見的現象

| # | 現象 | 截圖位置 | 看到 |
|---|---|---|---|
| 1 | 「同時落地」示範：一顆球自由下落，另一顆同時水平拋出，兩者垂直位置永遠相同 | `shots/scenario-1-early.png`（v0.2.1）側視投影（左下）：藍球在 x = 0、橙球在 x ≈ 3.4 m，同在 y ≈ 19.4 m，兩球之間灰色虛線水平；讀數 t 0.346 s、x 3.46 m、y 19.4 m。`shots/scenario-1-end.png`：側視兩球同在 y = 0（藍 (0, 0)、橙 (20.2, 0)），俯視藍球留在原點、橙球等距影子到 20 m，動能圖兩條曲線，讀數 t 2.02 s；3D 兩條路徑同一幀到地。現行 v0.2.2 `audit/shots-r3-current/scenario-1-early.png`（t 0.348）、`scenario-1-end.png`（t 2.31，落地 2.02 s）同樣內容。數據：same-landing 逐幀 y = yB 逐位相同、同幀落地 | 通過 |
| 1a | 同上，3D 立體視角（第 2 輪不通過項） | **v0.2.1** `shots/scenario-1-early.png` 3D：發射塔、量角器與「θ = 0°」、紅色發射管、黑色夾持座、橙球（v、vₓ、vᵧ、W、a 箭嘴）、路徑頻閃、「y = 19.5 m」全部在框內（放大 `audit/r3-crop-s1early-tower.png`）；`scenario-1-end.png` 3D：整條橙色路徑由塔頂到落點 x = 20.2 m、藍球沿塔身直落到塔底（`audit/r3-crop-s1end-tower.png`、`r3-crop-s1end-base.png`：藍球落在塔底、與橙球之間黑色虛線）。**v0.2.2** `audit/shots-r3-current/scenario-1-early.png`、`scenario-1-end.png`：同上，另見整幅牆與地面、「x = 3.26 m」「y = 0.00 m」完整。跳時截圖 `audit/r3-s1-t0.6.png`、`r3-s1-t1.0.png`、`r3-s1-t1.5.png`：t = 0.6 s 起藍球在塔右緣可見（y = 18.2 m），與橙球之間虛線水平，1.0 s（15.1 m）、1.5 s（8.96 m）同。**保留 C3**：t = 0.3 s 藍球只露出一小片藍色（`r3-s1-t0.3-top.png`），t ≈ 0.32–0.35 s 的官方 early 截圖只見其 vᵧ 標籤不見球（`r3-crop-s1early-top6.png`）——被夾持座／塔頂遮住約前 0.5 s | 通過（保留 C3） |
| 2 | 頻閃影像的水平間距相等，垂直間距逐格增大 | `shots/desktop.png` 與 `audit/shots-r3-current/desktop.png` 俯視投影（下中）：橙、藍兩列影子等距；側視投影（左下）：上升時愈密、下降時愈疏；3D 地面灰點等距、牆上灰點與牆左緣「高度（每 0.1 s）」影子列由密到疏（`scenario-2-end.png`、`scenario-4-end.png` 左側）。數據（由 strobe-a bodies 反算）：default 每 0.1 s Δx = 1.149067 m（19 格逐位相同），Δy = 0.9151, 0.8170, …, 0.0322, −0.0659, …, −0.8507 m，逐格差分全部 −0.09810 m = −g(0.1)²；same-landing 兩球 21 格影像逐格高度差 0 | 通過 |
| 3 | 動能—時間圖：動能不會歸零，最低點等於 ½mvₓ² | `shots/desktop.png` 右下：縱軸 0、100、200、300；橙色曲線最低點落在虛線「½mvₓ² = 66.0 J」（數據 66.0177 J），不觸及 0；藍球最低 ≈ 264 J（½(2vₓ)² = 264.07 J）。`scenario-2-end.png` 刻度 0、50、100，虛線 66.0 J；`scenario-3-early/end.png` 82.6 J（½ × 12.856² = 82.64）；`scenario-4-end.png` 28.1 J（½ × 7.5² = 28.125）；`scenario-5-end.png` 13.2 J（½ × 5.130² = 13.16）；`scenario-1-early/end.png` 50.0 J（½ × 10²）；情境 1 末端橙 246 J、藍 196 J（數據 EkMax 246.2、½ × 19.81² = 196.2） | 通過 |

截圖讀數與數據對照（每張 early 截圖用讀數的 t 代入規格方程）：情境 1 t 0.346 → x 3.46、y 19.41（讀數 3.46 / 19.4）；情境 2 t 0.354 → 4.07 / 2.80（讀數 4.07 / 2.80）；情境 3 t 0.306 → 3.93 / 4.23（讀數 3.93 / 4.23）；情境 4 t 0.351 → 2.63 / 3.96（讀數 2.63 / 3.96）；情境 5 t 0.348 → 1.79 / 4.31（讀數 1.79 / 4.31）。end 截圖：x 20.2 / 22.6 / 40.2 / 19.9 / 14.7 m 對 R = 20.19 / 22.59 / 40.16 / 19.86 / 14.74；t 2.02 / 1.97 / 3.12 / 2.65 / 2.87 s 對 tf 2.019 / 1.966 / 3.124 / 2.648 / 2.874。3D 標籤則慢一格（§3 C2）。

補充（規格「即時顯示」與「反駁設計」）：
- 讀數 vₓ、vᵧ、合速率、飛行時間、當前高度、水平距離全部在 `shots/ipad-portrait.png` 讀數區（t 1.97 s、x 22.6 m、y 0.00 m、vₓ 11.5、vᵧ −9.64、v 15.0 m s⁻¹、a 0.00 m s⁻²、Eₖ 113 J、x₂ 45.2 m、y₂ 0.00 m），三位有效數字、指數式單位。
- 「最高點速度為零」：`shots/scenario-2-end.png` 讀數 vₓ 11.5 m s⁻¹；數據最高點幀 v = 11.49 = vₓ。
- 「拋體在空中受到一個向前的力」：`shots/scenario-3-early.png`、`audit/shots-r3-current/scenario-3-early.png` 3D 與側視只有一支紅色 W 向下。
- 「加速度在最高點為零」：`scenario-4-early.png` 綠色虛線 a 向下、與 W 分開；數據每幀 \|a\| = 9.81。
- 「射程角度愈大愈遠」：`scenario-5-end.png`（兩套）3D 與側視同時畫 15°、30°、45°、60°、75° 路徑，45°（深綠虛線）最遠，15°/75°、30°/60° 落點重合，主球 70° 落在 14.7 m。
- 發射器：`audit/shots-r3-current/scenario-2-early.png` 量角器放大、紅色角度線、「θ = 40°」；比例尺「5 m」在發射器前方地面；預設（fast）第二支發射器在後方 z = −3（`audit/shots-r3-current/desktop.png`）。
- 3D 取景可重現：三次新載入（播放中 3 s、暫停跳 0.6 s、播放 6 s）取景相同（`audit/r3-framing-A/B/D-*.png`），視線在地面之上（地面格線在畫面下半、天空在上）。

## 6. 守恆量與邊界

**能量**（Eₖ + mgy，m = 1）：
- 無阻力 17 個運行：漂移 ≤ 3.0e-10 J（random-4，E ≈ 1142 J，相對 2.7e-13）；default 5.97e-13 J；逐幀最大上升 ≤ 4.5e-13 J。通過。
- 阻力 7 個運行：逐幀最大上升 0（單調不增），總損耗 random-0 175 J、random-1 518 J、random-2 109 J、air-default-fast 30.1 J、edge-u50-θ45-h50-g10-air 840 J、edge-u50-θ−30-h50-air 1.2e3 J、air-u50-θ40-h0-drop 890 J，與阻力做負功一致。

**時間軸**：meta.tf = tf + 0.3 s（無阻力）或 1.5 × 無阻力 tf + 0.3 s（阻力，比值皆 1.5000）；edge-u50-θ−30-h50-air（drop）取兩球中較長者（5.089 = 1.5 × 3.193 + 0.3）。我的 RK4 落地時刻 random-0 3.9635、random-1 11.99、random-2 4.973、edge-g10-air 7.174 / 6.712（B）、air-u50-θ40-h0-drop 4.861 s，全部在時間軸內。

**邊界（36 運行 obs / arrows / labels / scales / meta / bodies 掃描非有限數 = 0）**：
- θ = 90°, h = 0：x = 2.8e-15 m，tf 3.0581 = 2u/g，頻閃 Δx 極差 4.9e-30。
- u = 1, θ = 90°, g = 1.6, h = 0, drop：tf 1.25 s，落地速率 1.0000000000000002，第二顆球首幀落地。
- u = 50, θ = 45°, h = 50, g = 1.6：4 s 內 y 升至 178.6 m，meta.tf 45.87 s，k = 0.0062，done 全程 false。
- u = 50, θ = −30°, h = 50, air, drop：主球 2.0254 s 落地、第二顆球 3.4643 s；obs.t 續走至第二顆球落地才凍結，obs.tf 凍結在主球 2.0254 s，done 在 3465 幀才 true。
- θ ≤ 0° 且 h = 0：tf = 0，首幀 landedA = 1、done = true，讀數全 0、無箭嘴；時間軸 0.3 s（§7 第 3 條）。
- 阻力 + u = 50：起始 \|a\| = 32.2–32.8 m s⁻²（k u² = 25 > g）；箭嘴縮放以 g + k(u² + 2gh) 為分母，不會出框。
- 標籤：x 標籤 y = 0.05 常數、z = 1.4；y 標籤 x = −3.6；最低 y = r = 0.35（落地）。全部 ≥ 0。

## 7. 規格待釐清

1. **H 公式對負投射角**（同前兩輪）：H = h + u² sin²θ / 2g 在 θ < 0 時給出高於發射點的值（random-3：43.516 m；θ −30°, h 50：81.86 m），實際最高點是發射點 h。數據採 H = h。建議規格註明 θ < 0 時 H = h。
2. **落地後的讀數約定**（同前兩輪）：位置與速度凍結在落地瞬間（v = 15.0、vᵧ = −9.64 m s⁻¹），ax、ay 同刻變 0。規格未寫。
3. **θ ≤ 0° 且 h = 0**（同前兩輪）：飛行時間 0，讀數（含 vₓ、v、Eₖ）為 0。建議 h = 0 時限制 θ ≥ 1°，或提示須設 h > 0。
4. **空氣阻力形式**（同前兩輪）：a = −k v\|v\|，k = 0.01 m⁻¹；u = 50 時起始阻力 > g，待老師定 k。
5. **阻力運行的箭嘴畫長**（同第 2 輪）：作者以 g + k(u² + 2gh) 為參考，未見文件；建議在 plan 註明規則。
6. **3D 相機取景**：第 2 輪第 6 條已由 v0.2.1 / v0.2.2 的自動取景解決；規格「三個同步顯示」仍未寫相機。餘下 C3（自由下落的球起始 0.5 s 被夾持座／塔頂遮住）屬儀器擺位，非規格問題。
7. **時間軸長度**（同前兩輪）：「+0.3 s」與阻力時 1.5 倍規格未寫；不影響物理。
8. **「同步播放」的容許落後**：規格說三個視窗「同時播放」但未定容許誤差；C2 的一格落後（實機約 1/60 s）是否合格，請老師定。
