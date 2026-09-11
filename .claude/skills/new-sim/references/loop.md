# 閘 2 驗收循環（loop）規則

驗收不是「重跑直到通過」。循環受三樣東西限定：改甚麼重派誰、輪數上限、矛盾如何裁決。

## 1. 改甚麼重派誰

| 改動的檔案 | 必須重派 | 不用重派 |
|---|---|---|
| `model.ts`、`model.test.ts` | physics-auditor、second-implementer | student-tester、apparatus-reviewer |
| `plan.ts`、`Scene.tsx` | physics-auditor、apparatus-reviewer | second-implementer、student-tester |
| `controls.ts`（範圍、預設、標籤） | 全部四個 | — |
| `scenarios.ts`、`charts.ts`、`guide.zh.md`、`quiz.json`、界面標籤 | student-tester | 其餘三個 |
| 只改 `manifest.ts` 的 `pending*` / `assumptions` | 無 | 全部 |

重派前必須重新 `node tools/export-sim.mjs <simId>` 並重新截圖；驗收員看的是新數據，不是舊報告。

## 2. 輪數上限：三輪

- 第 1 輪：四個角色全派。
- 第 2、3 輪：只派上表要求的角色。
- 三輪後仍有角色不通過：**停止自動修正**，寫升級報告交老師（見第 5 節）。原因：三輪修不好的，多數是規格歧義或設計取捨，再修只會把測試改到綠，而不是把物理改到對。

## 3. 修正者的硬規則

不論修正者是主流程還是 `sim-fixer` agent：

1. 不得刪改由規格衍生的測試（驗證條件、考題回歸、真實數據對照）。可以新增測試，不可放寬容差。要放寬必須在升級報告說明並由老師批准。
2. `model.ts` 或 `plan.ts` 有改動，`manifest.version` 必須遞增。
3. 修正只可觸及 `src/sims/<simId>/`；共用層（`src/shell`、`src/components`、`src/physics`）的問題另開任務，因為它影響所有模擬，要重跑全部已簽收模擬的基準比對。
4. 修正後必須跑 `npx vitest run src/sims/<simId>` 與 `node tools/termlint.mjs`，全綠才可重派。
5. 修正者不得聲稱「已驗證」。驗證是驗收員的事。

## 4. 報告矛盾時的裁決

| 情況 | 做法 |
|---|---|
| physics-auditor 不通過，second-implementer 一致 | 兩個實作可能犯同一個錯。用規格的解析解或極限情況（θ = 0、μ = 0、t = 0、r → ∞）算一個點，看哪一方偏離。 |
| second-implementer 不一致，physics-auditor 通過 | 核數員是抽查，第二實作是全程；先看不一致首次出現的 t 是否在抽查點之間。同樣用解析解裁決。 |
| 兩者都指主實作錯，但指的不是同一處 | 逐項處理，不合併；每項各自對應一個改動與一次重派。 |
| student-tester 卡住的東西是規格要求的設計 | 不改設計；在升級報告記「規格要求 vs 學生困惑」，由老師決定。 |
| apparatus-reviewer 必改項與規格「場景」段衝突 | 規格優先；記入升級報告。 |
| 裁決不了 | 不猜。升級。 |

## 5. 升級報告

寫 `reports/<simId>/escalation.md`，固定結構：

```
# 升級：<simId>（第 N 輪後）

## 未通過的角色與項目
| 角色 | 項目 | 第 1 輪 | 第 2 輪 | 第 3 輪 |

## 我的判斷
屬於：規格歧義 / 設計取捨 / 兩個實作都可能錯 / 共用層問題 / 未能解決的錯

## 證據
（解析解計算、極限情況、報告引文）

## 請老師決定
1. …（每項一個明確的二選一或數值）
```

主流程收到升級後，該模擬狀態設為 `"blocked"`，進入下一個模擬，不等。

## 6. 無人值守模式

用 `.claude/workflows/verify-loop.js`（多 agent 編排）跑一批模擬時，修正者是 `sim-fixer` agent，規則同上，三輪封頂，升級報告自動生成。老師只在閘 3 出現。啟動要用戶明確說「用 workflow」。

## 7. 派出驗收員期間的紀律（第 1 個模擬的教訓）

- **學生試用者運行時不得改動 `src/`**（連測試檔也不可）：開發伺服器的熱更新會令它正在用的頁面重置，它會如實記錄「無端端重置」，浪費一輪。要改就等它完成。
- 學生試用者的工具刻意沒有 Read，所以**不能覆蓋既有檔案**：派發時指定新檔名（`student-test-r<N>.md`），或由派發者代為存檔。
- 截圖腳本用時間拉桿跳到末端時，必須用原生 setter + input 事件，Playwright 的 `fill` 對 range 無效。
- 測試環境的分頁在背景時瀏覽器會暫停動畫，學生試用者可能報告「播放極慢」；先確認 `document.hidden` 的影響，不要當成模擬錯誤。
- 改動共用層元件（`src/components`、`src/shell`）後，重派驗收員前先重啟開發伺服器並清 `node_modules/.vite`：Vite 熱更新後瀏覽器可能殘留舊模組（曾出現 `useEffect / useState is not defined`），學生試用者會如實報告成錯誤。
- 老師批准的額外輪次同樣適用三輪封頂邏輯：每輪只修該輪找到的問題，修完派下一輪；最後一輪之後的改動只列入升級報告，由老師決定接受或再加一輪。
- **同一 repo 有另一個 session 在寫別的模擬時，開發伺服器的熱更新同樣會重置學生試用者的頁面**（第 7 輪教訓：對方改 src/sims/<別的模擬>/，經 registry.ts 進入模組圖，試用者報告「按播放後自動跳回模式一」）。派學生試用者前先 `npx vite build --outDir <暫存目錄>`，再 `npx vite preview --outDir <暫存目錄> --port 4173 --strictPort` 起一個無熱更新的靜態伺服器，把 4173 的網址交給它；物理核數員與第二實作者只看導出數據，不受影響。
- 瀏覽器窗格預設可能很矮（曾是 800 × 317），學生試用者會如實報告「字太小」；派發時叫它先 `resize_window` 1440 × 900 再開始。
- **重派學生試用者前，靜態版 bundle 重建後要叫它整頁重新載入**（#024 第 8 輪：窗格在上一輪已開着同一網址，這一輪只換了 hash，單頁應用沒有重新載入，試用者整份報告描述的是舊 bundle 的畫面——「三艘飛船企喺原地」「鏡頭不跟巴士」——並以為參數「跨重新整理殘留」）。派工時寫明：先 navigate 到不含 hash 的網址（或加 ?v=<版本>），再進入模擬；主流程先用 Playwright 對同一網址截圖，確認新畫面已上線。
- **`resize_window` 的模擬視窗會縮小顯示，滑鼠點擊的座標映射可能失準**（#024 第 1、2 輪：學生試用者在 1440 × 900 下按情景按鈕與數字框「完全冇反應」，同一按鈕在 768 × 1024 一按即中；主流程親身重現後改回 `preset: "desktop"` 即正常）。派發時提醒試用者：桌面尺寸若按不中，用 `read_page` / `find` 取 ref 再按，或改用 preset desktop；並提醒它窗格在背景時 RAF 停、時間讀數不走不是模擬壞了（用「逐格」「跳到 t =」即可）。主流程要用 Playwright 無頭瀏覽器核實這類「按了沒反應」「時間不走」的報告（`reports/<simId>/audit/student-issues-check.mjs` 是現成範本），不要當成模擬錯誤去改。
