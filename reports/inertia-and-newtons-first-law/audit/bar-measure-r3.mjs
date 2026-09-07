// 量度桌布截圖衝量條的填色寬度（像素），並輸出放大裁圖。只讀 PNG，不碰模擬檔案。
import { chromium } from "playwright";
import fs from "node:fs";
const SHOTS = "C:/Users/trevor/dev/dse-physics-lab/.claude/worktrees/sim-024/reports/inertia-and-newtons-first-law/shots/";
const outDir = "C:/Users/trevor/AppData/Local/Temp/claude/C--Users-trevor-OneDrive-DSE-Physics-Lab/472da062-da6a-4cab-b00c-a76c2956f859/scratchpad/";
const targets = [
  { file: "scenario-10-end.png", y0: 285, tag: "v5 (J=0.119)" },
  { file: "extra-cloth-t0.04.png", y0: 115, tag: "t=0.04 (J=0.0589)" },
  { file: "extra-cloth-v10.png", y0: 115, tag: "v10 (J=0.0590)" },
  { file: "extra-cloth-v1-stuck.png", y0: 115, tag: "v1 stuck (J=1)" },
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const b64 = fs.readFileSync(SHOTS + t.file).toString("base64");
  const res = await page.evaluate(async ({ b64, y0 }) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(20, y0, 320, 60).data; const rows = [];
    for (let y = 0; y < 60; y++) {
      let n = 0, first = -1, last = -1, dark = 0, dFirst = -1, dLast = -1;
      for (let x = 0; x < 320; x++) {
        const i = (y * 320 + x) * 4; const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (r > 200 && gg > 90 && gg < 200 && b < 120) { n++; if (first < 0) first = x; last = x; }
        if (r < 120 && gg < 120 && b < 120) { dark++; if (dFirst < 0) dFirst = x; dLast = x; }
      }
      rows.push({ y: y0 + y, orange: n, first: first + 20, last: last + 20, dark, dFirst: dFirst + 20, dLast: dLast + 20 });
    }
    const best = rows.reduce((a, r) => (r.orange > a.orange ? r : a), rows[0]);
    const frame = rows.reduce((a, r) => (r.dark > a.dark ? r : a), rows[0]);
    const c2 = document.createElement("canvas"); c2.width = 960; c2.height = 180; const g2 = c2.getContext("2d"); g2.imageSmoothingEnabled = false; g2.drawImage(img, 20, y0, 320, 60, 0, 0, 960, 180);
    return { best, frame, png: c2.toDataURL("image/png") };
  }, { b64, y0: t.y0 });
  fs.writeFileSync(outDir + "bar-" + t.file, Buffer.from(res.png.split(",")[1], "base64"));
  console.log(t.tag.padEnd(22), "orange fill px=" + res.best.orange, "x=" + res.best.first + "–" + res.best.last, "@y=" + res.best.y, "| frame(dark) px=" + res.frame.dark, "x=" + res.frame.dFirst + "–" + res.frame.dLast, "@y=" + res.frame.y);
}
await browser.close();
