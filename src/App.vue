<template>
  <div class="markdown-container" ref="editorRef"></div>
</template>

<script lang="ts" setup>
import "viewerjs/dist/viewer.css"; // 引入 Viewer.js 的 CSS 文件
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from "vue";
import { useOptions } from "./hooks/index.ts";

// 定义组件配置
defineOptions({ name: "Markdown" });

// Props
const props = defineProps({
  mode: {
    type: String,
    default: "preview", // 可选值：preview、editor
  },
  value: {
    type: String,
    default: "",
  },
  config: {
    type: Object,
    default: () => ({}), // 默认配置
  },
});

// Hooks
const { options } = useOptions(props);

// Ref
const editorRef = ref<HTMLDivElement | null>(null);
const editor = ref<Cherry | null>(null);
const isInitialized = ref(false); // 标记编辑器是否已初始化

// onMounted(() => {
//   nextTick(() => {
//     initEditor();
//   });
// });

const initEditor = (value): void => {
  if (editorRef.value === null || isInitialized.value) return;

  try {
    const config = {
      el: editorRef.value,
      value: value,
      ...options,
    };

    const cherryInstance = new Cherry(config);
    editor.value = cherryInstance;
    isInitialized.value = true;
  } catch (error) {
    console.error("初始化 Cherry 编辑器失败", error);
  }
};
watch(
  () => props.value,
  (newValue) => {
    if (newValue) initEditor(newValue);
  },
  {
    immediate: true,
  },
);

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy();
  }
});
</script>

<style scoped>
.markdown-container {
  width: 100%;
  height: 100%; /* 确保父容器有高度 */
}
</style>
