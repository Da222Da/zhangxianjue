import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import "./style.css";
import App from "./App.vue";
import ElementPlus from "element-plus";
import "element-plus/theme-chalk/src/index.scss"; // 引入 Element Plus 的 SCSS
import "element-plus/theme-chalk/display.css";
import "./assets/styles/global.css";

import router from "./router";

import Markdown from "@zhangxianjue/markdown-editor-v3";
import "@zhangxianjue/markdown-editor-v3/dist/style.css";

const app = createApp(App);

// Pinia 必须在 router 之前安装：路由守卫会在导航时读取登录态
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

app.use(pinia);
app.use(ElementPlus, { size: "default" });
app.use(router);
// 默认导出是插件，install 时把 Markdown 注册为全局组件（类型见 src/types/markdown-editor.d.ts）
app.use(Markdown);

app.mount("#app");
