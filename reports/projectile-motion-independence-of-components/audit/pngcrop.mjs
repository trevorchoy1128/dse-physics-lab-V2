// 純 Node PNG 裁切放大工具（8-bit RGB/RGBA、非交錯），供核數員放大截圖局部。
// 用法：node pngcrop.mjs in.png out.png x y w h [scale]
import { readFileSync, writeFileSync } from "node:fs";
import zlib from "node:zlib";
const [,, inp, outp, X, Y, W, H, S = "3"] = process.argv;
const buf = readFileSync(inp);
let pos = 8; const chunks = []; let w, h, bpp, ct;
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos); const type = buf.toString("ascii", pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0) throw new Error("unsupported png"); bpp = ct === 6 ? 4 : ct === 2 ? 3 : (() => { throw new Error("ct " + ct); })(); }
  if (type === "IDAT") chunks.push(data);
  pos += 12 + len;
}
const raw = zlib.inflateSync(Buffer.concat(chunks));
const stride = w * bpp; const img = Buffer.alloc(h * stride);
for (let y = 0; y < h; y++) {
  const f = raw[y * (stride + 1)]; const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  const row = img.subarray(y * stride, (y + 1) * stride); const prev = y ? img.subarray((y - 1) * stride, y * stride) : null;
  for (let i = 0; i < stride; i++) {
    const a = i >= bpp ? row[i - bpp] : 0, b = prev ? prev[i] : 0, c = (prev && i >= bpp) ? prev[i - bpp] : 0; let v = src[i];
    if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : pb <= pc ? b : c; }
    row[i] = v & 255;
  }
}
const x0 = +X, y0 = +Y, cw = +W, ch = +H, s = +S; const ow = cw * s, oh = ch * s;
const out = Buffer.alloc(oh * (ow * 3 + 1));
for (let y = 0; y < oh; y++) { out[y * (ow * 3 + 1)] = 0; for (let x = 0; x < ow; x++) { const si = ((y0 + Math.floor(y / s)) * w + (x0 + Math.floor(x / s))) * bpp; const oi = y * (ow * 3 + 1) + 1 + x * 3; out[oi] = img[si]; out[oi + 1] = img[si + 1]; out[oi + 2] = img[si + 2]; } }
const crc = (b) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(ow, 0); ihdr.writeUInt32BE(oh, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(outp, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(out)), chunk("IEND", Buffer.alloc(0))]));
console.log("wrote", outp, ow, "x", oh, "(source", w, "x", h, ")");
