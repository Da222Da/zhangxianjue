import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/**
 * 运行时依赖全部 external：它们声明在 package.json 的 dependencies 中，
 * 由使用方通过 npm 安装，避免同一份 d3 / roughjs 被打包多份。
 * vue 声明在 peerDependencies，由宿主应用提供。
 *
 * 只产出 ESM 与 CJS 两种格式：依赖里 d3 各子模块在 UMD 生态下没有统一
 * 的全局变量名，强行打 UMD 要么需要一堆 globals 映射、要么得把依赖重复
 * 打包进去。CDN 场景建议用 importmap + ESM（见 README）。
 */
const EXTERNAL = [
  "vue",
  "roughjs",
  "markdown-it",
  "d3-hierarchy",
  "d3-flextree",
  "d3-selection",
  "d3-zoom",
];

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: resolve(__dirname, "tsconfig.build.json"),
      outDirs: "types",
      include: ["src"],
      entryRoot: "src",
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Markmap",
      formats: ["es", "cjs"],
      fileName: (format) =>
        format === "es"
          ? "markmap.es.js"
          : "markmap.cjs",
      cssFileName: "style",
    },
    sourcemap: true,
    rollupOptions: {
      external: (id) =>
        EXTERNAL.some((dep) => id === dep || id.startsWith(`${dep}/`)),
      output: {
        exports: "named",
      },
    },
  },
});
