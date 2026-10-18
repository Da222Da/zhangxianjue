import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

// element-plus
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/display.css";

// css
// ⚠️ 必须放在 Element Plus 之后：本文件会覆盖 EP 的主题变量与少量组件样式（手绘风），
//    顺序反了会被 EP 自身的 :root 规则盖回去。
import "@/assets/css/style.css";

// router
import router from "./router";

// app
import App from "./App.vue";
const app = createApp(App);

// 插件
// ⚠️ 重型可视化组件都不在此全局注册，改为在各自使用的页面局部引入：
//   - @zhangxianjue/markmap  仅笔记详情页使用
//   - @zhangxianjue/markdown（含 markdown-it / katex）仅文章详情页使用
// 全局注册会把它们全部打进入口包（曾使入口包达 6.3MB）。
// pinia 必须先于 router 安装：路由守卫会读登录态
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.use(router);
app.use(ElementPlus);

app.mount("#app");
