import type { Level } from "./game";

// 關卡：每關一個 v–t 圖要點。目標線每段的斜率都是 A_STEP 的倍數且不超過 aMax（game.test.ts 逐關檢查），
// 所以只要在正確時刻把油門桿撥到正確的 a，就可以完全貼線。測試同時證明：完美策略三星、
// 反應慢 0.3 s 但懂得追回的策略三星、放着不管（a = 0）過不了關（熱身關除外，它正是要學生放着不管）。

export const LEVELS: Level[] = [
  {
    id: "cruise", name: { zh: "熱身：保持勻速度", en: "Warm-up: hold a steady velocity" },
    brief: { zh: "賊車以 6 m s⁻¹ 逃走，警車已經跟在旁邊。賊車的線是一條水平線：10 秒內保持速度不變就追得住。", en: "The getaway car flees at 6 m s⁻¹ and you are already alongside. Its line is horizontal: hold your velocity steady for 10 s and you stay with it." },
    hint: { zh: "水平線的斜率是 0，所以 a = 0。不用踩油門，車也不會慢下來（沒有摩擦）。", en: "A horizontal line has zero slope, so a = 0. No throttle needed: with no friction the car does not slow down." },
    points: [[0, 6], [10, 6]], aMax: 4, vMax: 8, vMin: -4, view: 60,
  },
  {
    id: "start", name: { zh: "起步", en: "Pulling away" },
    brief: { zh: "賊車由靜止起步，4 秒內加速到 8 m s⁻¹，然後保持。警車要跟足。", en: "The getaway car pulls away from rest, reaching 8 m s⁻¹ in 4 s, then holds it. Match it." },
    hint: { zh: "斜率 = Δv / Δt = 8 / 4 = 2，所以先把 a 設為 2；到 t = 4 s 立即撥回 0。", en: "Slope = Δv / Δt = 8 / 4 = 2, so set a = 2; at t = 4 s snap it back to 0." },
    points: [[0, 0], [4, 8], [10, 8]], aMax: 4, vMax: 12, vMin: -4, view: 60,
  },
  {
    id: "brake", name: { zh: "剎車", en: "Braking" },
    brief: { zh: "賊車以 10 m s⁻¹ 逃走 3 秒，然後用 5 秒剎停，之後停住。警車也要剎得一樣。", en: "The getaway car runs at 10 m s⁻¹ for 3 s, then takes 5 s to stop and stays stopped. Brake the same way." },
    hint: { zh: "向下的直線斜率是負數：a = (0 − 10) / 5 = −2。減速度就是負的加速度。", en: "A line sloping down has negative slope: a = (0 − 10) / 5 = −2. Deceleration is negative acceleration." },
    points: [[0, 10], [3, 10], [8, 0], [10, 0]], aMax: 4, vMax: 12, vMin: -4, view: 70,
  },
  {
    id: "steeper", name: { zh: "越斜越急", en: "Steeper means faster change" },
    brief: { zh: "賊車先輕加速 4 秒，再用大一倍的加速度 4 秒，然後保持。兩段的斜率不同。", en: "The getaway car accelerates gently for 4 s, then twice as hard for 4 s, then holds. The two slopes differ." },
    hint: { zh: "第一段 Δv / Δt = 4 / 4 = 1；第二段 (12 − 4) / 4 = 2。斜率越大，加速度越大。", en: "First segment Δv / Δt = 4 / 4 = 1; second (12 − 4) / 4 = 2. Steeper slope, larger acceleration." },
    points: [[0, 0], [4, 4], [8, 12], [10, 12]], aMax: 4, vMax: 16, vMin: -4, view: 80,
  },
  {
    id: "gentle", name: { zh: "輕輕踩", en: "Feather the throttle" },
    brief: { zh: "賊車用 6 秒慢慢加速到 3 m s⁻¹。斜率很小，油門桿要撥到最細的一格。", en: "The getaway car takes 6 s to reach just 3 m s⁻¹. The slope is tiny; use the smallest notch on the lever." },
    hint: { zh: "a = 3 / 6 = 0.5 m s⁻²，正是油門桿的一格。", en: "a = 3 / 6 = 0.5 m s⁻², exactly one notch on the lever." },
    points: [[0, 0], [6, 3], [10, 3]], aMax: 4, vMax: 4, vMin: -2, view: 40,
  },
  {
    id: "reverse", name: { zh: "穿過時間軸", en: "Crossing the time axis" },
    brief: { zh: "賊車以 6 m s⁻¹ 前進 2 秒，然後一直減速……減到變成倒後行駛 6 m s⁻¹。線穿過時間軸時車會發生甚麼？", en: "The getaway car moves forward at 6 m s⁻¹ for 2 s, then keeps decelerating… until it is reversing at 6 m s⁻¹. What happens to the car as the line crosses the axis?" },
    hint: { zh: "整段斜率都是 (−6 − 6) / 6 = −2，穿過 v = 0 時不用改 a。v = 0 只是一瞬間停下，a 仍是 −2，之後速度變負，車倒後行駛。", en: "The slope is (−6 − 6) / 6 = −2 throughout; do not change a when crossing v = 0. The car stops only for an instant, a is still −2, then v goes negative and the car reverses." },
    points: [[0, 6], [2, 6], [8, -6], [10, -6]], aMax: 4, vMax: 8, vMin: -8, view: 50,
  },
  {
    id: "roundtrip", name: { zh: "去而復返", en: "There and back" },
    brief: { zh: "賊車出發、掉頭、回到起點。16 秒後兩架車都應該回到 0 m：軸上面積與軸下面積互相抵消。", en: "The getaway car sets off, turns round and comes back. After 16 s both cars should be back at 0 m: the area above the axis cancels the area below." },
    hint: { zh: "斜率依次是 2、0、−2、0、2。位移等於線下面積：上方 9 + 12 = 21 m，下方也是 21 m，所以總位移 0。", en: "Slopes in order: 2, 0, −2, 0, 2. Displacement is the area under the line: 9 + 12 = 21 m above, 21 m below, so the total is 0." },
    points: [[0, 0], [3, 6], [5, 6], [11, -6], [13, -6], [16, 0]], aMax: 4, vMax: 8, vMin: -8, view: 50,
  },
  {
    id: "city", name: { zh: "市區駕駛", en: "City driving" },
    brief: { zh: "市區追逐 16 秒，七段：起步、巡航、輕剎、再加速、最後減速。每個轉折點都要及時撥桿。想挑戰就關掉自動暫停。", en: "A 16 s city chase in seven segments: pull away, cruise, brake gently, speed up again, slow at the end. Move the lever promptly at every corner. For a challenge, switch off pause-at-corners." },
    hint: { zh: "先把每段的 Δv / Δt 算出來寫在旁邊：2、0、−2、0、2、0、−2。反應慢了就短暫用更大的 a 追回，再撥回正確的斜率。", en: "Work out Δv / Δt for each segment first: 2, 0, −2, 0, 2, 0, −2. If you react late, briefly use a larger a to catch up, then return to the correct slope." },
    points: [[0, 0], [3, 6], [5, 6], [6, 4], [9, 4], [12, 10], [13, 10], [16, 4]], aMax: 4, vMax: 12, vMin: -4, view: 80,
  },
];
