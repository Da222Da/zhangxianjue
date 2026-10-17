import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: __dirname,
  plugins: [vue()],
  resolve: {
    alias: {
      // playground 直接引用源码，改动即时生效，无需先 build
      "@": resolve(__dirname, "../src"),
    },
  },
  server: {
    port: 8092,
    host: "0.0.0.0",
    open: false,
  },
});
