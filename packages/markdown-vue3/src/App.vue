<template>
  <div class="markdown-container" ref="editorRef"></div>
</template>

<script lang="ts" setup>
import "viewerjs/dist/viewer.css"; // 引入 Viewer.js 的 CSS 文件
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from "vue";
import { useOptions } from "./hooks/index.js";

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
});

// emits
const emit = defineEmits(["change"]);

// Hooks
const { options } = useOptions(props);

// Ref
const editorRef = ref<HTMLDivElement | null>(null);
const editor = ref<Cherry | null>(null);
const isInitialized = ref(false); // 标记编辑器是否已初始化
const currentContent = ref(""); // 内部缓存最新的 Markdown 内容

const initEditor = (value): void => {
  if (editorRef.value === null || isInitialized.value) return;

  try {
    const config = {
      el: editorRef.value,
      value: value,
      ...options,
    };

    editor.value = new Cherry(config);
    isInitialized.value = true;
  } catch (error) {
    console.error("初始化 Cherry 编辑器失败", error);
  }
};

// 手动获取内容的方法，方便父组件通过 ref 主动调用
const getMarkdownContent = (): string => {
  // 优先使用 Cherry 实例自带的 getValue 方法确保获取最新
  if (editor.value && typeof editor.value.getValue === "function") {
    return editor.value.getValue();
  }
  return currentContent.value;
};

onMounted(() => {
  nextTick(() => {
    initEditor(props.value);
  });
});

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy();
  }
});

defineExpose({
  editor,
  getMarkdownContent, // 暴露获取内容的方法
});
</script>

<style scoped>
.markdown-container {
  width: 100%;
  height: 100%; /* 确保父容器有高度 */
}
</style>
