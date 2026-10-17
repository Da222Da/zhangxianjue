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

const app = createApp(App);

// Pinia 必须在 router 之前安装：路由守卫会在导航时读取登录态
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

app.use(pinia);
app.use(ElementPlus, { size: "default" });
app.use(router);
// 重型可视化组件不在此全局注册：文章正文编辑器只在 ArticleContentDialog 里局部引入，
// 避免把 markdown-it / katex 打进入口包。客户端的做法与此一致。

app.mount("#app");
