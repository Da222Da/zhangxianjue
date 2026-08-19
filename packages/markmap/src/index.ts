import type { App, Plugin } from "vue";
import Markmap from "./App.vue";

// 导出
export { Markmap };

export default {
  install: (app: App) => {
    // 注册 WytSpreadsheet 组件
    app.component("Markmap", Markmap);
  },
} as Plugin;
