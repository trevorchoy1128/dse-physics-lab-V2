import { describe, it, expect } from "vitest";
import { manifest } from "./manifest";
import quiz from "./quiz.json";

// 考題回歸：老師 2026-09-06 決定本模擬不做 DSE 試題回歸（pendingPapers 清空）。
// 規格列出的題號仍保留在 manifest.dsePapers 與 quiz.sources 供查閱；日後若老師提供評卷參考，在此逐題補上 it()。
describe("拋體運動（S2）考題回歸", () => {
  it("題號清單與規格一致；老師決定不做回歸，pendingPapers 為空", () => {
    expect(manifest.dsePapers.length).toBe(13);
    expect(manifest.pendingPapers).toEqual([]);
  });

  it("quiz.json 的 sources 與 manifest 的題號一致，沒有自作題", () => {
    expect(quiz.sources).toEqual(manifest.dsePapers);
    expect(quiz.items).toEqual([]);
  });
});
