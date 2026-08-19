import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Markmap",
      fileName: (format) => `markmap.${format}.js`,
    },
    rollupOptions: {
      // external 必须写在这里，告诉 Rollup 哪些模块不要打包进去
      external: ["vue"],
      output: {
        exports: "named",
        // globals 必须与 external 对应，提供外部化依赖的全局变量名 (仅在打包成 IIFE/UMD 格式时需要)
        globals: {
          vue: "Vue",
        },
      },
    },
  },
  assetsInclude: ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.gif", "**/*.svg"],
});
