import { createApp } from "vue";
import App from "./App.vue";
import router from "./scripts/router";

import ElementPlus from "element-plus";
import "element-plus/dist/index.css";

import Markdown from "../src/index.ts";

const app = createApp(App);

// 注册
app.use(router);
app.use(ElementPlus);
app.use(Markdown);

app.mount(document.querySelector("#app") as any);
