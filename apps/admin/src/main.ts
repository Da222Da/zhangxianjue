import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import ElementPlus from "element-plus";
import "element-plus/theme-chalk/src/index.scss"; // 引入 Element Plus 的 SCSS
import "element-plus/theme-chalk/display.css";
import "./assets/styles/global.css";

import router from "./router";

import Markdown from "@zhangxianjue/markdown-vue3";
import "@zhangxianjue/markdown-vue3/dist/style.css";

const app = createApp(App);

app.use(ElementPlus, { size: "default" });
app.use(router);
app.use(Markdown as any);

app.mount("#app");
