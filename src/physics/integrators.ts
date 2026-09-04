// 數值積分器。狀態以 number[] 表示，f(t, y) 回傳導數。
export type Deriv = (t: number, y: number[]) => number[];

const axpy = (y: number[], k: number, d: number[]) => y.map((v, i) => v + k * d[i]);

/** 四階 Runge–Kutta，固定步長 */
export function rk4(f: Deriv, y: number[], t: number, dt: number): number[] {
  const k1 = f(t, y);
  const k2 = f(t + dt / 2, axpy(y, dt / 2, k1));
  const k3 = f(t + dt / 2, axpy(y, dt / 2, k2));
  const k4 = f(t + dt, axpy(y, dt, k3));
  return y.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/** 半隱式 Euler：位置與速度成對 [x…, v…]，a(t, x, v) 回傳加速度。能量守恆性質好，適合長時間振動 */
export function semiImplicitEuler(a: (t: number, x: number[], v: number[]) => number[], x: number[], v: number[], t: number, dt: number): [number[], number[]] {
  const acc = a(t, x, v);
  const v2 = v.map((vi, i) => vi + acc[i] * dt);
  const x2 = x.map((xi, i) => xi + v2[i] * dt);
  return [x2, v2];
}
