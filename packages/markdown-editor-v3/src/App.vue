<template>
  <div class="markdown-container">
    <div ref="editorRef"></div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from "vue";
import { useOptions } from "./hooks/index.js";

// 定义组件配置
defineOptions({ name: "Markdown" });

// Props
const props = defineProps({
  mode: {
    type: String,
    default: "previewOnly", // 可选值：previewOnly、edit&preview、editOnly
  },
  modelValue: {
    type: String,
    default: "",
  },
});

// emits
// update:modelValue 用于父组件监听内容变化
const emit = defineEmits(["update:modelValue"]);

// Hooks
const { options } = useOptions(props, emit);

// Ref
const editorRef = ref<HTMLDivElement | null>(null);
const editorInstance = ref<Cherry | null>(null);
const isInitialized = ref(false); // 标记编辑器是否已初始化
const currentContent = ref(""); // 内部缓存最新的 Markdown 内容

const initEditor = (value): void => {
  if (editorRef.value === null || isInitialized.value) return;

  try {
    const config = {
      ...options,
      el: editorRef.value,
      value: value,
    };

    editorInstance.value = new Cherry(config);
    isInitialized.value = true;
  } catch (error) {
    console.error("初始化 Cherry 编辑器失败", error);
  }
};

// 手动获取内容的方法，方便父组件通过 ref 主动调用
const getMarkdownContent = (): string => {
  // 优先使用 Cherry 实例自带的 getValue 方法确保获取最新
  if (editorInstance.value && typeof editorInstance.value.getValue === "function") {
    return editorInstance.value.getValue();
  }
  return currentContent.value;
};

onMounted(() => {
  nextTick(() => {
    initEditor(props.modelValue);
  });
});

onBeforeUnmount(() => {
  if (editorInstance.value) {
    editorInstance.value.destroy();
  }
});

// 监听 mode 的变化，更新 Cherry Markdown 的模式
watch(
  () => props.mode,
  (newMode, oldMode) => {
    if (!editorInstance.value) return;

    editorInstance.value.switchModel(newMode);
  },
);

defineExpose({
  editor: editorInstance,
  getMarkdownContent, // 暴露获取内容的方法
});
</script>

<style scoped>
@import "viewerjs/dist/viewer.css";

.markdown-container {
  width: 100%;
  height: 100%; /* 确保父容器有高度 */
}
</style>
