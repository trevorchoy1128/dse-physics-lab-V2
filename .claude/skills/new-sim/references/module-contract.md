# 模擬模組契約

每個模擬是 `src/sims/<simId>/` 內七個檔案。shell（`src/shell/`）負責所有共用界面：參數面板、播放控制、圖層開關、數值面板、圖表、數據表、分頁、語言切換。模擬只提供資料和場景。

型別定義在 `src/shell/types.ts`。項目骨架未建時，先按本文件建立它。

## 型別

```ts
export type Lang = "zh" | "en";
export interface Text { zh: string; en: string }

export type UnitId = "c1" | "c2" | "c3" | "c4" | "c5" | "e1" | "e2" | "e3" | "e4" | "sk";

export interface SimManifest {
  id: string;                    // kebab-case 英文，與資料夾同名
  unit: UnitId;
  chapter: string;               // 與 catalogue.json 的 ch 一致，如 "Bk2 B8"
  type: "e" | "c";               // 實驗 / 概念
  phase: 1 | 2 | 3;
  needs3D: "must" | "high" | "medium" | "low";
  spec?: { doc: string; section: string; code?: string };   // 如 { doc: "reference/11_Book2_…", section: "模擬器 2", code: "S2" }
  title: Text;
  summary: Text;
  dsePapers: string[];           // 規格列出的題號，如 "17(1A)Q9"
  pendingPapers: string[];       // 尚無評卷參考、未能做回歸測試的題號
  assumptions: Text[];           // 理想化假設，畫面固定位置列明（忽略空氣阻力、輕繩……）
  pendingTerms: string[];        // 查不到中譯的英文名詞，待老師定奪
  beyondSpec: string[];          // 規格以外自行加入的內容，待老師定奪
  version: string;               // 物理模型版本，model.ts / plan.ts 改動必須遞增並重新走閘 2–3
}
// 狀態由 catalogue.json 記錄：draft → verified（閘 2 過）→ preview（pending 非空）→ approved（老師簽收，基準已凍結）

// 物理模型：純函數，無副作用，不 import three.js / React
export interface SimModel<S, P> {
  init(params: P): S;
  step(state: S, params: P, dt: number): S;     // 固定步長；shell 以 accumulator 與畫面幀率脫鈎
  observe(state: S, params: P): Record<string, number>;   // 即時顯示的量，SI 單位，不格式化
  events?(prev: S, next: S, params: P): SimEvent[];       // 如「繩斷」「落地」「開始滑動」
}
export interface SimEvent { key: string; t: number; label: Text }

export interface ControlDef {
  key: string;                   // 對應 params 的欄位
  symbol?: string;               // 顯示用符號，如 "θ"、"u"；shell 以斜體排版
  label: Text;
  unit?: string;                 // 指數式，如 "m s⁻¹"；無單位則省略
  kind?: "slider" | "select" | "toggle";
  min?: number; max?: number; step?: number; default: number | string | boolean;
  options?: { value: number | string; label: Text }[];   // select 用
}
// 共用：g 的選擇（9.81 預設，可選 9.8 / 10）
export const gControl: ControlDef;

export interface ChartDef {
  key: string;
  label: Text;
  x: string; y: string[];        // observe() 的 key
  unitX: string; unitY: string;
  fit?: "linear";                // 顯示最佳直線、斜率、截距
}

export interface Scenario<P> {   // 「試試看」：一條迷思一個
  key: string;
  misconception: Text;           // 學生會怎樣想
  params: Partial<P>;            // 設到這組參數
  watch: Text;                   // 叫學生看甚麼（讀數 / 箭嘴 / 圖）
  expect: Text;                  // 會看見甚麼（與迷思相反）
  layers?: string[];             // 自動開啟的圖層
}

export interface LayerDef { key: string; label: Text; default: boolean }

// 畫面計劃：Scene 只畫它，測試只測它
export type Vec3 = [number, number, number];
export type ArrowKind = "weight" | "normal" | "friction" | "tension" | "net" | "velocity" | "acceleration" | "field";
export interface ArrowPlan { kind: ArrowKind; origin: Vec3; vector: Vec3; label?: string; layer: string }   // vector 為物理量（SI），縮放由 scales 統一
export interface LabelPlan { position: Vec3; symbol: string; value: number; unit: string }
export interface BodyPlan { key: string; shape: "sphere" | "box" | "cylinder"; position: Vec3; size: Vec3; color?: string; rotation?: Vec3 }
export interface RenderPlan {
  bodies?: BodyPlan[];           // 移動的物體；PlanScene 自動畫出，Scene.tsx 只加固定幾何（地面、儀器）
  arrows: ArrowPlan[];
  labels: LabelPlan[];
  trails?: { key: string; points: Vec3[] }[];
  scales: Partial<Record<ArrowKind, number>>;   // 每種 kind 一個係數：畫出的長度 = |vector| × scale
}
export type PlanFn<S, P> = (state: S, params: P, obs: Record<string, number>, layers: Record<string, boolean>) => RenderPlan;

// 讀數面板（charts.ts 匯出 readouts）；obs 內自動有 t
export interface ReadoutDef { key: string; symbol: string; label: Text; unit: string; transform?: (v: number) => number }

// index.ts 匯出 default: SimModule，另含 readouts、mode: "3d" | "2d"、
// camera?: { position: Vec3; target: Vec3; fov?: number }（打開時一眼看到規格「學生應該看見的現象」第 1 項）
```

座標約定（全站，不得自行換軸）：x 向右、y 向上、z 指向觀眾，右手系。`src/shell/frame.test.ts` 固定測試 x × y = z。

## 七個檔案

| 檔案 | 匯出 | 責任 |
|---|---|---|
| `manifest.ts` | `manifest: SimManifest` | 身分、章節、題號、待定項 |
| `model.ts` | `model: SimModel<S,P>`、型別 `S`、`P` | 物理，只 import `src/physics/*` |
| `model.test.ts` | — | 規格驗證條件 + 解析解 + 守恆量 |
| `controls.ts` | `controls: ControlDef[]`、`defaults: P` | 參數表逐行照抄 |
| `scenarios.ts` | `scenarios: Scenario<P>[]` | 迷思表逐行變情境 |
| `charts.ts` | `charts: ChartDef[]`、`layers: LayerDef[]`、`readouts: ReadoutDef[]` | 圖表、圖層、讀數登記 |
| `index.ts` | `default: SimModule`（含 readouts、mode、camera） | 匯總；並在 `src/sims/registry.ts` 登記 |
| `plan.ts` | `plan: PlanFn<S,P>` | 畫面的物理：箭嘴、標籤、軌跡的資料，純函數 |
| `plan.test.ts` | — | 箭嘴方向 / 大小 / 起點、合力、縮放一致、標籤 = observe、隨機參數無 NaN |
| `Scene.tsx` | `default function Scene({ plan })` | 只畫 RenderPlan，不算、不判斷 |
| `guide.zh.md` | — | 五節：步驟、理論、常見混淆、觀察重點、教師備註 |
| `quiz.json` | — | `{ sources: string[], items: [] }`，題目待老師提供 |

（七個檔案指程式檔；guide 與 quiz 是內容檔，同樣必備。）

## shell 提供的共用元件（`src/components/`）

- `<VectorArrow kind origin vector scale label />`
  kind 決定顏色與線型，不可覆寫：

  | kind | 顏色 | 線型 |
  |---|---|---|
  | weight | 紅 | 實線 |
  | normal | 藍 | 實線 |
  | friction | 橙 | 實線 |
  | tension | 紫 | 實線 |
  | net | 黑（粗） | 實線 |
  | velocity | 綠 | 實線，箭頭形狀與力不同 |
  | acceleration | 綠 | 虛線 |
  | field | 青 | 細實線（電場、磁場、引力場線） |

- `<Ruler>`、`<Protractor>`、`<Stopwatch>`、`<Ammeter>`、`<Voltmeter>`、`<CRO>`、`<GeigerCounter>` — 3D 儀器。
- `<Canvas2D>` — needs3D 為 low 的模擬用。
- `<Trail>` — 軌跡；`<Strobe interval>` — 頻閃影像。
- `<Label>` — 場景內文字，跟隨語言切換，數字三位有效數字。

## 物理工具（`src/physics/`）

- `rk4(f, state, t, dt)`、`semiImplicitEuler(...)`
- `constants.ts`：`G = 6.67e-11`、`M_EARTH = 6.0e24`、`R_EARTH = 6.4e6`、`e`、`c`、`h`、`k_B`（考評局數據表數值）
- `vec.ts`：`add`、`sub`、`scale`、`dot`、`cross`、`norm`、`resolve(angle)`

## 測試慣例

- 檔名 `model.test.ts`，用 Vitest。
- 每個 `it()` 的名稱是規格驗證條件的中文原句。
- 容許誤差：規格有寫就用規格的；沒寫則解析解比較用相對誤差 1e-6，守恆量用絕對誤差 1e-6（以 SI 單位計）。
- 掃描類測試（如「θ = 45° 時射程最大」）用固定步長掃描，不用隨機。
