import { createApp } from "vue";
import App from "./App.vue";

import ElementPlus from "element-plus";
import "element-plus/dist/index.css";

import Markmap from "../src/index.ts";

const app = createApp(App);
app.use(ElementPlus);
app.use(Markmap);

app.mount(document.querySelector("#app") as any);
