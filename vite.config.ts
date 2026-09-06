/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // reports/ 由驗收員在開發期間頻繁寫入（數據、截圖、報告）；不監視，否則整頁重載會打斷學生試用者（第 4 輪教訓）
  server: { port: 5173, strictPort: true, watch: { ignored: ["**/reports/**", "**/baselines/**"] } },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
