// 模擬模組契約。詳見 .claude/skills/new-sim/references/module-contract.md
import type { ComponentType } from "react";

export type Lang = "zh" | "en";
export interface Text { zh: string; en: string }

export type UnitId = "c1" | "c2" | "c3" | "c4" | "c5" | "e1" | "e2" | "e3" | "e4" | "sk";
export type SimStatus = "draft" | "verified" | "preview" | "approved" | "blocked";

export interface SimManifest {
  id: string;
  unit: UnitId;
  chapter: string;
  type: "e" | "c";
  phase: 1 | 2 | 3;
  needs3D: "must" | "high" | "medium" | "low";
  spec?: { doc: string; section: string; code?: string };
  title: Text;
  summary: Text;
  dsePapers: string[];
  pendingPapers: string[];
  assumptions: Text[];
  pendingTerms: string[];
  beyondSpec: string[];
  version: string;
}

export interface SimEvent { key: string; t: number; label: Text }

export interface SimModel<S, P> {
  init(params: P): S;
  step(state: S, params: P, dt: number): S;
  observe(state: S, params: P): Record<string, number>;
  events?(prev: S, next: S, params: P): SimEvent[];
  /** 運行已結束（如全部落地）：runner 不再步進，時鐘停在該刻；seek 不受影響 */
  done?(state: S, params: P): boolean;
}

export type ControlKind = "slider" | "select" | "toggle" | "segment";   // segment = 幾個大按鈕的分段選擇（觸控友善，用於模式切換）
export interface ControlOption { value: number | string; label: Text }
export interface ControlDef {
  key: string;
  symbol?: string;
  label: Text;
  unit?: string;
  kind?: ControlKind;
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  options?: ControlOption[];
  /** 只在某些參數組合下顯示（如某模式專用的滑桿）；不影響物理，只影響面板 */
  visible?: (params: Record<string, unknown>) => boolean;
}

export interface ChartDef {
  key: string;
  label: Text;
  x: string;
  y: string[];
  unitX: string;
  unitY: string;
  fit?: "linear";
}

export interface LayerDef { key: string; label: Text; default: boolean }
export type Layers = Record<string, boolean>;

export interface Scenario<P> {
  key: string;
  misconception: Text;
  params: Partial<P>;
  watch: Text;
  expect: Text;
  layers?: string[];
}

// 畫面計劃
export type Vec3 = [number, number, number];
export type ArrowKind = "weight" | "normal" | "friction" | "tension" | "net" | "velocity" | "acceleration" | "field";
export interface ArrowPlan { kind: ArrowKind; origin: Vec3; vector: Vec3; label?: string; layer: string }
export interface LabelPlan { position: Vec3; symbol: string; value: number; unit: string }
export interface BodyPlan { key: string; shape: "sphere" | "box" | "cylinder"; position: Vec3; size: Vec3; color?: string; rotation?: Vec3 }
export interface RenderPlan {
  bodies?: BodyPlan[];
  arrows: ArrowPlan[];
  labels: LabelPlan[];
  trails?: { key: string; points: Vec3[] }[];
  scales: Partial<Record<ArrowKind, number>>;
  /** 非物理的畫面資料（2D 場景的軸範圍、當前時間、模式旗標）；不可放物理判斷 */
  meta?: Record<string, number>;
}
export type PlanFn<S, P> = (state: S, params: P, obs: Record<string, number>, layers: Layers) => RenderPlan;

export interface SceneProps {
  plan: RenderPlan;
  /** 場景的輸入（如在圖上拖畫）交回 shell 更新參數；場景本身不算物理 */
  onInput?: (key: string, value: unknown) => void;
}

// 一個模擬模組的完整匯出（每個 src/sims/<id>/index.ts）
export interface SimModule<S = unknown, P = Record<string, unknown>> {
  manifest: SimManifest;
  model: SimModel<S, P>;
  controls: ControlDef[];
  defaults: P;
  scenarios: Scenario<P>[];
  charts: ChartDef[];
  layers: LayerDef[];
  plan: PlanFn<S, P>;
  Scene: ComponentType<SceneProps>;
  /** 與主場景同步的附加平面視窗（如拋體的側視、俯視、動能圖），畫在主場景下方；同樣只畫 plan，不算物理 */
  Views?: ComponentType<SceneProps>;
  guideZh: string;
  mode: "3d" | "2d";
  /** 3D 相機預設：打開時一眼看到規格「學生應該看見的現象」第 1 項 */
  camera?: { position: Vec3; target: Vec3; fov?: number };
  /** 這些參數改變時不重置運行（即時控制，如運動線圖的加速度滑桿） */
  liveParams?: string[];
  /** 運行的總時長（秒）；提供則播放列顯示時間拉桿，可跳到任何時刻（重置後快進） */
  duration?: (params: P) => number;
  /** 「逐格」每按一次前進的模擬時間（秒），預設 0.05 */
  stepSize?: number;
  /** 首次進入的三步提示（不填則用 shell 預設） */
  hints?: [Text, Text, Text];
}
