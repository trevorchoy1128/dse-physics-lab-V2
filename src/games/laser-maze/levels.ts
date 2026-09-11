import { rectEdges, semicircleEdges, type Level } from "./game";
import type { Text } from "@/shell/types";

// 關卡：每關一個物理要點。數值經 game.test.ts 窮舉（角度 1° 一格、元件 15° 一格、每個格位），保證每關有解、預設不命中。
// 棋盤 12 × 8 格；玻璃 n = 1.5（臨界角 41.8°）、水 n = 1.33（臨界角 48.8°）。
// 第一部分：平面鏡（老師 2026-09-11：分兩部分，鏡面與稜鏡；稜鏡可直接拖動旋轉；不要凸透鏡）。
// 第二部分：稜鏡與折射——先折射與臨界角（調入射角），再放稜鏡（全內反射的應用），最後光纖。
const N_GLASS = 1.5, N_WATER = 1.33;
const wall = (x0: number, x1: number, y0: number, y1: number) => ({ x0, x1, y0, y1 });
const semi = () => ({ n: N_GLASS, edges: semicircleEdges([6, 4], 2.5, 90), name: { zh: "玻璃", en: "glass" }, label: { zh: "玻璃 n = 1.5", en: "glass n = 1.5" }, labelAt: [5.1, 2.2] as [number, number] });

export const PARTS: { part: 1 | 2; name: Text }[] = [
  { part: 1, name: { zh: "第一部分 · 平面鏡", en: "Part 1 · Plane mirrors" } },
  { part: 2, name: { zh: "第二部分 · 稜鏡與折射", en: "Part 2 · Prisms and refraction" } },
];

export const LEVELS: Level[] = [
  // ---- 第一部分：平面鏡 ----
  {
    id: "mirror", part: 1, name: { zh: "熱身：一面鏡", en: "Warm-up: one mirror" },
    brief: { zh: "激光向右射。把平面鏡放在光路上，拖動它轉到合適角度，令光線轉向下面的探測器。", en: "The laser fires to the right. Put the plane mirror in the beam and drag it round so the ray reaches the detector below." },
    hint: { zh: "反射定律：入射角 = 反射角（都由法線量起）。要光轉 90°，鏡面要與光線成 45°。", en: "Law of reflection: angle of incidence = angle of reflection (both from the normal). To turn the ray 90°, the mirror must be at 45° to it." },
    lasers: [{ pos: [0.6, 4.5], dir: 0 }], glass: [], mirrors: [], blocks: [],
    target: { kind: "spot", c: [5.5, 0.8], r: 0.3 },
    slots: [[5.5, 4.5], [8.5, 4.5]], inventory: { mirror: 1 },
  },
  {
    id: "corner", part: 1, name: { zh: "繞過牆", en: "Round the wall" },
    brief: { zh: "牆擋住了直路。用兩面平面鏡，令光線繞過牆射中探測器。留意有些格位是陷阱。", en: "A wall blocks the direct route. Use two plane mirrors to steer the ray round it. Some slots are traps." },
    hint: { zh: "每面鏡都用反射定律：鏡面與光線成 45° 就轉 90°。先想光要走哪條路，再決定鏡放哪兩格。", en: "Each mirror obeys the law of reflection: 45° to the ray turns it 90°. Decide the route first, then which two slots." },
    lasers: [{ pos: [0.6, 6.5], dir: 0 }], glass: [], mirrors: [], blocks: [wall(5.6, 6.4, 0, 5)],
    target: { kind: "spot", c: [11.3, 2.5], r: 0.3 },
    slots: [[3.5, 6.5], [8.5, 6.5], [8.5, 2.5], [3.5, 2.5]], inventory: { mirror: 2 },
  },
  {
    id: "angle", part: 1, name: { zh: "反射角", en: "Angle of reflection" },
    brief: { zh: "探測器不在正下方。鏡要轉多少度？畫面會標出入射角與反射角。", en: "The detector is not straight below. How far must the mirror turn? The screen labels the angles of incidence and reflection." },
    hint: { zh: "光線轉過的角度 = 2 × (鏡面與入射光的夾角)。探測器在鏡的 60° 方向，所以鏡面與光線成 30°。", en: "The ray turns through 2 × (angle between mirror and incident ray). The detector lies 60° from the mirror, so the mirror sits at 30° to the ray." },
    lasers: [{ pos: [1.5, 1.5], dir: 0 }], glass: [], mirrors: [], blocks: [],
    target: { kind: "spot", c: [6.5 + 4 * Math.cos(Math.PI / 3), 1.5 + 4 * Math.sin(Math.PI / 3)], r: 0.25 },
    slots: [[6.5, 1.5]], inventory: { mirror: 1 },
  },
  // ---- 第二部分：稜鏡與折射 ----
  {
    id: "fish", part: 2, name: { zh: "水池叉魚", en: "Spear the fish" },
    brief: { zh: "激光裝在水面，魚在水底。直線瞄準會射不中：光進入水會向法線偏折。調校激光與法線的夾角。", en: "The laser sits at the water surface; the fish is on the bottom. Aiming straight misses: light bends towards the normal on entering water. Set the angle from the normal." },
    hint: { zh: "先由魚的位置求水中的折射角 r：tan r = 水平距離 / 深度 = 4 / 4.5。再用折射定律 sin i = n sin r，n = 1.33。", en: "First find the angle of refraction r from the fish: tan r = horizontal / depth = 4 / 4.5. Then Snell's law sin i = n sin r with n = 1.33." },
    note: { zh: "水 n = 1.33。光由空氣入水（光疏入光密）只會折射，不會全內反射。", en: "Water n = 1.33. Air into water (less dense to denser) only refracts; there is no total internal reflection." },
    lasers: [{ pos: [3.5, 5.02], dir: -90 }],
    angle: { ref: -90, sign: 1, min: 0, max: 85, start: 42, label: { zh: "激光與法線夾角", en: "Laser angle from the normal" } },
    glass: [{ n: N_WATER, edges: rectEdges(0, 0, 12, 5), name: { zh: "水", en: "water" }, label: { zh: "水 n = 1.33", en: "water n = 1.33" }, labelAt: [0.3, 4.6] }], mirrors: [], blocks: [],
    target: { kind: "spot", c: [7.5, 0.5], r: 0.2, fish: true },
    slots: [], inventory: {}, aimLine: true,
  },
  {
    id: "semicircle", part: 2, name: { zh: "半圓玻璃塊：折射出去", en: "Semicircular block: refract out" },
    brief: { zh: "激光繞着半圓玻璃塊的圓心轉，永遠對準圓心，所以經弧面時不偏折。調校入射角，令光在平面折射出去、射中探測器。", en: "The laser swings round the centre of the semicircular block and always points at it, so the curved face does not bend it. Set the angle so the ray refracts out of the flat face onto the detector." },
    hint: { zh: "探測器在法線 45° 方向，即折射角 r = 45°。玻璃到空氣：n sin i = sin r，n = 1.5，所以 sin i = sin 45° / 1.5。", en: "The detector is 45° from the normal, so r = 45°. Glass to air: n sin i = sin r with n = 1.5, so sin i = sin 45° / 1.5." },
    note: { zh: "玻璃 n = 1.5，臨界角 C = 41.8°。", en: "Glass n = 1.5, critical angle C = 41.8°." },
    lasers: [{ pos: [6, 0.5], dir: 90 }],
    angle: { ref: 90, sign: -1, min: 0, max: 80, start: 45, label: { zh: "入射角（與法線夾角）", en: "Angle of incidence (from the normal)" }, pivot: { c: [6, 4], r: 3.4 } },
    glass: [semi()], mirrors: [], blocks: [],
    target: { kind: "spot", c: [6 + 3 * Math.sin(Math.PI / 4), 4 + 3 * Math.cos(Math.PI / 4)], r: 0.2 },
    slots: [], inventory: {},
  },
  {
    id: "tir", part: 2, name: { zh: "全內反射", en: "Total internal reflection" },
    brief: { zh: "同一塊半圓玻璃塊，探測器改放在下面。要光在平面反射回來，入射角必須大於臨界角。", en: "Same block, but the detector is now below. For the ray to reflect back off the flat face, the angle of incidence must exceed the critical angle." },
    hint: { zh: "sin C = 1/n = 1/1.5，C = 41.8°。入射角 > C 才全內反射；反射角 = 入射角，探測器在法線另一側 55° 方向。", en: "sin C = 1/n = 1/1.5 gives C = 41.8°. Only above C is the reflection total; the angle of reflection equals the angle of incidence, and the detector is 55° on the other side of the normal." },
    note: { zh: "玻璃 n = 1.5，臨界角 C = 41.8°。入射角小於 C 時只畫折射線（弱反射不畫）。", en: "Glass n = 1.5, C = 41.8°. Below C only the refracted ray is drawn (the weak reflection is ignored)." },
    lasers: [{ pos: [6, 0.5], dir: 90 }],
    angle: { ref: 90, sign: -1, min: 0, max: 80, start: 30, label: { zh: "入射角（與法線夾角）", en: "Angle of incidence (from the normal)" }, pivot: { c: [6, 4], r: 3.4 } },
    glass: [semi()], mirrors: [], blocks: [],
    target: { kind: "spot", c: [6 + 3.4 * Math.sin(55 * Math.PI / 180), 4 - 3.4 * Math.cos(55 * Math.PI / 180)], r: 0.2 },
    slots: [], inventory: {},
  },
  {
    id: "prism", part: 2, name: { zh: "直角稜鏡轉 90°", en: "Right-angle prism: turn 90°" },
    brief: { zh: "沒有鏡，只有一個直角稜鏡。放好、拖動轉好，令光垂直射入一面，在斜面全內反射，再垂直射出。", en: "No mirror this time, just a right-angle prism. Place it and drag it round so the ray enters one face at right angles, totally reflects at the hypotenuse and leaves at right angles." },
    hint: { zh: "光垂直射入短邊不偏折，射到斜面時入射角 45° > 臨界角 41.8°，所以全內反射，轉 90°。", en: "Entering a short face at right angles there is no bending; at the hypotenuse the angle of incidence is 45° > C = 41.8°, so the reflection is total and the ray turns 90°." },
    note: { zh: "稜鏡 n = 1.5，臨界角 41.8°。", en: "Prism n = 1.5, C = 41.8°." },
    lasers: [{ pos: [0.6, 5.5], dir: 0 }], glass: [], mirrors: [], blocks: [],
    target: { kind: "spot", c: [6.5, 1.2], r: 0.3 },
    slots: [[6.5, 5.5], [9.5, 5.5]], inventory: { prism: 1 },
  },
  {
    id: "periscope", part: 2, name: { zh: "稜鏡潛望鏡", en: "Prismatic periscope" },
    brief: { zh: "牆擋住了直路。用兩個直角稜鏡代替鏡，令光轉兩次 90° 繞過牆。兩個稜鏡的斜面要怎樣擺？", en: "A wall blocks the direct route. Use two right-angle prisms instead of mirrors to turn the ray 90° twice round the wall. How must the two hypotenuses face?" },
    hint: { zh: "潛望鏡：每個稜鏡都靠斜面 45° 全內反射轉 90°；兩個斜面互相平行，光才會回到原來的方向。", en: "A periscope: each prism turns the ray 90° by total internal reflection at its hypotenuse; the two hypotenuses must be parallel for the ray to return to its original direction." },
    note: { zh: "稜鏡 n = 1.5，臨界角 41.8°。", en: "Prism n = 1.5, C = 41.8°." },
    lasers: [{ pos: [0.6, 6.5], dir: 0 }], glass: [], mirrors: [], blocks: [wall(5.6, 6.4, 0, 5)],
    target: { kind: "spot", c: [11.3, 2.5], r: 0.3 },
    slots: [[3.5, 6.5], [8.5, 6.5], [8.5, 2.5], [3.5, 2.5]], inventory: { prism: 2 },
  },
  {
    id: "porro", part: 2, name: { zh: "稜鏡回頭 180°", en: "Prism: turn back 180°" },
    brief: { zh: "探測器在激光旁邊，光要原路方向倒轉回來。把稜鏡的斜面向着激光試試：光會在兩條短邊各反射一次。", en: "The detector sits beside the laser, so the ray must come straight back. Try facing the hypotenuse towards the laser: the ray reflects once on each short face." },
    hint: { zh: "光垂直穿過斜面射入，在兩條短邊各以 45° 入射（> C）全內反射，最後方向倒轉 180°，但位置對稱地移了。", en: "The ray enters through the hypotenuse at right angles, totally reflects at 45° on each short face, and leaves reversed through 180°, shifted symmetrically." },
    note: { zh: "稜鏡 n = 1.5，臨界角 41.8°。", en: "Prism n = 1.5, C = 41.8°." },
    lasers: [{ pos: [1.6, 4.75], dir: 0 }], glass: [], mirrors: [], blocks: [],
    target: { kind: "spot", c: [3.2, 4.25], r: 0.15 },
    slots: [[8.5, 4.5], [8.5, 2.5]], inventory: { prism: 1 },
  },
  {
    id: "fibre", part: 2, name: { zh: "光纖不可漏光", en: "Keep the light in the fibre" },
    brief: { zh: "激光射入光纖的端面。入射角太大，光在纖壁的入射角就小於臨界角，會漏出去。找最大的入射角仍能把光送到末端的探測器。", en: "The laser enters the end of a fibre. Too large an entry angle makes the angle at the wall smaller than C, and light leaks. Find the largest entry angle that still delivers light to the far end." },
    hint: { zh: "sin C = 1/n → C = 48.8°。纖壁的入射角 = 90° − r，要 > C，所以 r < 41.2°；再由 sin i = n sin r 得 i < 61°。", en: "sin C = 1/n gives C = 48.8°. The angle at the wall is 90° − r and must exceed C, so r < 41.2°; then sin i = n sin r gives i < 61°." },
    note: { zh: "為了讓漏光看得見，本關光纖的折射率設為 1.33（臨界角 48.8°）。入射角越接近上限，星越多。", en: "So that leaking is visible, this fibre has n = 1.33 (C = 48.8°). The closer to the limit, the more stars." },
    lasers: [{ pos: [2.9, 4], dir: 0 }],
    angle: { ref: 0, sign: 1, min: 0, max: 80, start: 70, label: { zh: "入射角（與光纖軸夾角）", en: "Angle of incidence (from the fibre axis)" } },
    glass: [{ n: N_WATER, edges: rectEdges(3, 3.5, 10.5, 4.5), name: { zh: "光纖", en: "fibre" }, label: { zh: "光纖 n = 1.33", en: "fibre n = 1.33" }, labelAt: [6, 5] }], mirrors: [], blocks: [],
    target: { kind: "strip", a: [10.62, 3.15], b: [10.62, 4.85] },
    slots: [], inventory: {}, stars: { kind: "band", three: 59, two: 45 },
  },
];
