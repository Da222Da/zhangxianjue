import type { App, Plugin } from "vue";
import Markdown from "./App.vue";

// 导出
export { Markdown };

export default {
  install: (app: App) => {
    // 注册 WytSpreadsheet 组件
    app.component("Markdown", Markdown);
  },
} as Plugin;
