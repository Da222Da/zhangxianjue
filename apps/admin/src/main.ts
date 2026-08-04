import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import ElementPlus from "element-plus";
import "element-plus/theme-chalk/src/index.scss"; // 引入 Element Plus 的 SCSS
import "./assets/styles/global.css";

import router from "./router";

const app = createApp(App);

app.use(ElementPlus, { size: "default" });
app.use(router);

app.mount("#app");
