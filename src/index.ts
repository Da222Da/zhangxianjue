import type { App, Plugin } from "vue";

import Markdown from "./App.vue";

// 图片预览 viewerjs
import "viewerjs/dist/viewer.css";

// cherry-markdown
import "cherry-markdown/dist/cherry-markdown.css";
import Cherry from "cherry-markdown/dist/cherry-markdown.core.js";

// 注册 mermaid 图表插件
import CherryCodeBlockMermaidPlugin from "cherry-markdown/dist/addons/cherry-code-block-mermaid-plugin.js";
Cherry.usePlugin(CherryCodeBlockMermaidPlugin);

// 导出
export { Markdown };

export default {
  install: (app: App) => {
    // 注册 WytSpreadsheet 组件
    app.component("Markdown", Markdown);
  },
} as Plugin;
