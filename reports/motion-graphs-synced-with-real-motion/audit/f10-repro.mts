import { model } from "../../../src/sims/motion-graphs-synced-with-real-motion/model.ts";
const p: any = { mode: "draw", u: 0, a: 0, T: 2, vt: [1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1] };
let s = model.init(p);
for (let i = 0; i < 2500; i++) { s = model.step(s, p, 0.001); if (i === 1499 || i === 1998 || i === 1999 || i === 2000 || i === 2499) { const o = (model as any).observe(s, p); console.log(i, s.t, "v", o.v, "a", o.a, "done", s.done); } }
