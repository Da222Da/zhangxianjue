import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path"; // 确保没有拼写错误

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"), // 设置路径别名
    },
  },
  server: {
    port: 8080,
    proxy: {
      // 代理 /api 开头的请求到后端服务器
      "/api": {
        target: "http://localhost:3000/", // 后端服务器地址
        changeOrigin: true, // 是否改变源头
        rewrite: (path) => path.replace(/^\/api/, "/api"), // 重写路径，如果需要
        secure: false, // 如果后端使用了自签名证书，可以设置为 false
      },
    },
  },
});
