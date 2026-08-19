import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Markdown",
      fileName: (format) => `Markdown.${format}.js`,
    },
    rollupOptions: {
      // external 必须写在这里，告诉 Rollup 哪些模块不要打包进去
      external: ["vue", "element-plus"],
      output: {
        exports: "named",
        // globals 必须与 external 对应，提供外部化依赖的全局变量名 (仅在打包成 IIFE/UMD 格式时需要)
        globals: {
          vue: "Vue",
          "element-plus": "ELEMENT",
        },
        assetFileNames: (assetInfo: any) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "style.css";
          }
          if (/\.(png|jpe?g|gif|svg)$/.test(assetInfo.name)) {
            return "assets/[name].[hash][extname]";
          }
          return "[name][extname]";
        },
      },
    },
  },
  assetsInclude: ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.gif", "**/*.svg"],
});
