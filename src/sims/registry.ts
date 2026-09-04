import type { SimModule } from "@/shell/types";

// 已實作的模擬（懶載入）。目錄與狀態在 content/catalogue.json；這裏只登記有程式的。
export const REGISTRY: Record<string, () => Promise<SimModule<unknown, Record<string, unknown>>>> = {
  "example-fall": () => import("./example-fall").then(m => m.default as unknown as SimModule<unknown, Record<string, unknown>>),
};
export const hasSim = (id: string) => id in REGISTRY;
