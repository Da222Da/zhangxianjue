<template>
  <div class="markdown-container" ref="markdownRef"></div>
</template>

<script lang="ts" setup>
import "cherry-markdown/dist/cherry-markdown.css";
import "viewerjs/dist/viewer.css"; // 引入 Viewer.js 的 CSS 文件
import { ref, onMounted } from "vue";
import { useOptions } from "./hooks/index.ts";
import Cherry from "cherry-markdown";

// 定义组件配置
defineOptions({ name: "Markdown" });

const props = defineProps({
  mode: {
    type: String,
    default: "preview", // 可选值：preview、editor
  },
  value: {
    type: String,
    default: "",
  },
  PreviewConfig: {
    type: Object,
    default: () => ({}), // 默认配置
  },
});
const markdownRef = ref(null);
const { options } = useOptions(props);

onMounted(() => {
  if (markdownRef.value) {
    new Cherry({
      el: markdownRef.value,
      value: props.value,
      ...options,
    });
  } else {
    console.error("Markdown ref is not found");
  }
});
</script>

<style scoped>
.markdown-container {
  width: 100%;
  height: 100%; /* 确保父容器有高度 */
}
</style>
