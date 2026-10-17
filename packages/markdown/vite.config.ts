import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/**
 * 运行时依赖全部 external：它们声明在 package.json 的 dependencies 中，
 * 由使用方通过 npm 安装，避免同一份 markdown-it / katex 被打包多份。
 * vue 声明在 peerDependencies，由宿主应用提供。
 */
const EXTERNAL = [
  "vue",
  "markdown-it",
  "markdown-it-emoji",
  "markdown-it-footnote",
  "katex",
  "dompurify",
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
      name: "Markdown",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "markdown.es.js" : "markdown.cjs"),
      cssFileName: "style",
    },
    sourcemap: true,
    rollupOptions: {
      external: (id) => EXTERNAL.some((dep) => id === dep || id.startsWith(`${dep}/`)),
      output: {
        exports: "named",
      },
    },
  },
});
