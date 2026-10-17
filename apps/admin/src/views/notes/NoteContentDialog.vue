<!-- src/views/notes/NoteContentDialog.vue -->
<template>
  <el-dialog v-model="visible" :title="dialogTitle" width="90%" top="5vh" @close="handleClose" destroy-on-close>
    <!-- 打开时需要先拉一次详情：列表接口刻意不返回 content -->
    <el-skeleton v-if="loading" :rows="8" animated />

    <el-alert v-else-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon>
      <template #default>
        <el-button link type="primary" @click="loadContent">重新加载</el-button>
      </template>
    </el-alert>

    <!-- 局部引入而非全局注册：编辑器内含 d3 / rough.js，放在这里可随本弹窗懒加载 -->
    <div v-else class="editor-wrapper">
      <MarkmapEditor v-model:value="content" height="70vh" placeholder="用 Markdown 写思维导图：# 根节点 / - 分支" />
    </div>

    <template #footer>
      <div class="dialog-footer">
        <span class="form-hint">正文与元数据分开保存，这里只更新思维导图内容</span>
        <el-button @click="handleClose">关闭</el-button>
        <el-button type="primary" :loading="saving" :disabled="loading || !!errorMessage" @click="handleSubmit">保存内容</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { MarkmapEditor } from "@zhangxianjue/markmap";
import "@zhangxianjue/markmap/style.css";
import noteService from "@/api/noteService";
import type { NoteContentPayload } from "@/types/api";

const props = defineProps<{
  modelValue: boolean;
  /** 目标笔记主键；为空表示没有可编辑的对象 */
  noteId: number | null;
  /** 仅用于弹窗标题展示 */
  noteTitle?: string;
}>();

const emit = defineEmits<{
  close: [];
  update: [];
}>();

const visible = ref(props.modelValue);
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const content = ref("");

const dialogTitle = computed(() => (props.noteTitle ? `编辑内容 · ${props.noteTitle}` : "编辑内容"));

const handleClose = (): void => {
  emit("close");
  visible.value = false;
};

/** 拉取最新正文：避免用列表里的陈旧数据覆盖别处的修改 */
const loadContent = async (): Promise<void> => {
  const id = props.noteId;
  if (id === null) {
    errorMessage.value = "未指定笔记";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await noteService.getNoteDetail(id);
    content.value = res.data.content;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "内容加载失败";
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async (): Promise<void> => {
  const id = props.noteId;
  if (id === null) {
    return;
  }

  saving.value = true;
  try {
    const payload: NoteContentPayload = { content: content.value };
    await noteService.updateNoteContent(id, payload);
    ElMessage.success("内容保存成功");
    handleClose();
    emit("update");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    saving.value = false;
  }
};

watch(
  () => props.modelValue,
  (newVal: boolean) => {
    if (newVal) {
      visible.value = true;
      content.value = "";
      void loadContent();
    }
  },
);
</script>

<style scoped>
.editor-wrapper {
  height: 70vh;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.form-hint {
  /* 把提示推到最左，按钮保持在右侧 */
  margin-right: auto;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
</style>
