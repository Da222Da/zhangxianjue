import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // 渲染测试要用 DOMPurify（依赖 window/document），统一用 jsdom；
    // 纯文本命令测试在 jsdom 下同样可以跑。
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    root: __dirname,
  },
});
