# @zhangxianjue/markdown-vue3 说明文档

## 简介

这是一个基于 [cherry-markdown](https://github.com/Tencent/cherry-markdown/wiki/hello-world) 的 Vue3 组件，用于编辑、预览 markdown 格式的字符串。

## 使用

### 1. 在 Vue3 项目中注册组件

```javascript
import { createApp } from "vue";
import App from "./App.vue";

import Markdown from "@zhangxianjue/markdown";
import "@zhangxianjue/markdown/dist/style.css";

const app = createApp(App);

app.use(Markdown as any);

app.mount("#app");
```

### 2. 预览 markdown 字符串

```vue
<template>
  <div class="article-container">
    <Markdown :value="value" />
  </div>
</template>

<script setup>
import { ref } from "vue";

const value = ref("# Hello World");
</script>
```

### 3. 编辑 markdown 字符串

```vue
<template>
  <div class="article-container">
    <Markdown :value="value" mode="editor" />
  </div>
</template>

<script setup>
import { ref } from "vue";

const value = ref("# Hello World");
</script>
```

## 属性

### Props

| 属性名 | 类型   | 默认值    | 说明                    |
| ------ | ------ | --------- | ----------------------- |
| mode   | String | "preview" | 可选值：preview、editor |
| value  | String | ""        | Markdown 内容           |
