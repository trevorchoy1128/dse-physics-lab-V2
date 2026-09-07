import { model } from "../../../src/sims/inertia-and-newtons-first-law/model";
import { plan } from "../../../src/sims/inertia-and-newtons-first-law/plan";
import { defaults } from "../../../src/sims/inertia-and-newtons-first-law/controls";
const layers = { weight: true, normal: true, friction: true, applied: true, net: true, velocity: true, acceleration: false, netOnly: false };
for (const scene of ["table", "cloth", "bus", "space"] as const) {
  const p = { ...defaults, scene };
  let s = model.init(p);
  const t0 = performance.now();
  for (let f = 0; f < 120; f++) { for (let i = 0; i < 16; i++) s = model.step(s, p, 1e-3); const o = model.observe(s, p); plan(s, p, o, layers); }
  console.log(scene, "per frame ms:", ((performance.now() - t0) / 120).toFixed(2), "t=", s.t.toFixed(2));
}
