<template>
  <div class="markmap-container" :class="{ 'is-edit-mode': isEdit }">
    <div class="edit-pane">
      <Markdown v-model="markmapValue" mode="editOnly" />
    </div>
    <div class="preview-pane">
      <!-- 思维导图 Core -->
      <MarkmapCore ref="markmapCoreRef" :value="markmapValue" />

      <!-- 工具栏 -->
      <MarkmapToolbar v-if="enableToolbar" :markmap="markmapCoreRef" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import MarkmapCore from "./components/MarkmapCore.vue";
import MarkmapToolbar from "./components/MarkmapToolbar.vue";
import { Markdown } from "@zhangxianjue/markdown-editor-v3";
import "@zhangxianjue/markdown-editor-v3/dist/style.css";

const props = defineProps({
  type: {
    type: String,
    default: "view", // view 预览 | edit 编辑
  },
  value: {
    type: String,
    default: "",
  },
  enableToolbar: {
    type: Boolean,
    default: true,
  },
});

const markmapCoreRef = ref(null);
const isEdit = computed(() => props.type == "edit");
const markmapValue = ref(props.value);
</script>

<style scoped>
.markmap-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: auto;
}

/* 默认情况下，预览区占满，编辑区隐藏 (根据你的业务需求调整) */
.preview-pane {
  flex: 1;
  height: 100%;
  overflow: auto;
}

.edit-pane {
  display: none; /* 默认隐藏 */
  height: 100%;
  overflow: auto;
  border: 1px solid #ccc;
}

/* 当 isEdit 为 true 时，激活编辑模式布局 */
.markmap-container.is-edit-mode .preview-pane,
.markmap-container.is-edit-mode .edit-pane {
  display: block; /* 确保两个面板都显示 */
  width: 50%; /* 强制各占 50% 宽度 */
  flex: none; /* 取消 flex:1 的自适应，严格遵循 50% */
}
</style>
