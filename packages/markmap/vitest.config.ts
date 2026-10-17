import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // 解析与布局是纯计算逻辑，不需要 DOM；测量走无 DOM 的估算实现
    environment: "node",
    include: ["tests/**/*.test.ts"],
    root: __dirname,
  },
});
