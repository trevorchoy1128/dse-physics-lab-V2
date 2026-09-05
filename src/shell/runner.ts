// 固定步長運行器：畫面幀率與物理步長脫鈎（accumulator）。純邏輯，無 RAF，可測試。
import type { SimModel, SimEvent } from "./types";

export interface Runner<S, P> {
  readonly state: S;
  readonly t: number;
  readonly dt: number;
  params: P;
  /** 推進 elapsed 秒（已乘速度），回傳這次執行的步數與事件 */
  advance(elapsed: number): { steps: number; events: SimEvent[] };
  /** 單步 */
  step(): SimEvent[];
  /** 由 0 精確跳到 t（重置後步進 round(t/dt) 步；不受 maxStepsPerAdvance 限制） */
  seek(t: number): void;
  reset(params?: P): void;
}

export function createRunner<S, P>(model: SimModel<S, P>, params: P, dt = 1e-3, maxStepsPerAdvance = 2000): Runner<S, P> {
  let state = model.init(params);
  let t = 0;
  let acc = 0;
  const doStep = (): SimEvent[] => {
    const next = model.step(state, params, dt);
    const ev = model.events ? model.events(state, next, params) : [];
    state = next; t += dt;
    return ev;
  };
  return {
    get state() { return state; },
    get t() { return t; },
    get dt() { return dt; },
    get params() { return params; },
    set params(p: P) { params = p; },
    advance(elapsed) {
      acc += Math.max(0, elapsed);
      let steps = 0; const events: SimEvent[] = [];
      // 浮點累積誤差：0.016 + 0.033 + … 可能差 1e-17 而少走一步，故用 dt 的 1e-9 作容差
      while (acc >= dt * (1 - 1e-9) && steps < maxStepsPerAdvance) { events.push(...doStep()); acc -= dt; steps++; }
      if (acc < 0) acc = 0;
      if (steps === maxStepsPerAdvance) acc = 0; // 分頁切走後回來，不追趕
      return { steps, events };
    },
    step: () => doStep(),
    seek(target) {
      state = model.init(params); t = 0; acc = 0;
      const n = Math.max(0, Math.round(target / dt));
      for (let i = 0; i < n; i++) doStep();
    },
    reset(p) { if (p) params = p; state = model.init(params); t = 0; acc = 0; },
  };
}
