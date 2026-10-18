<!-- src/views/articles/ArticleContentDialog.vue -->
<template>
  <el-dialog v-model="visible" :title="dialogTitle" width="90%" top="5vh" @close="handleClose" destroy-on-close>
    <!-- 与笔记不同，文章列表本来就带 content；但仍按 id 拉一次最新值，
         避免用列表里的陈旧快照覆盖别处的修改 -->
    <el-skeleton v-if="loading" :rows="8" animated />

    <el-alert v-else-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon>
      <template #default>
        <el-button link type="primary" @click="loadContent">重新加载</el-button>
      </template>
    </el-alert>

    <!-- 局部引入而非全局注册：编辑器含 markdown-it / katex，
         放在这里可随弹窗懒加载 -->
    <div v-else class="editor-wrapper">
      <Markdown v-model="content" mode="edit&preview" :file-upload="uploadFile" placeholder="用 Markdown 撰写文章正文" />
    </div>

    <template #footer>
      <div class="dialog-footer">
        <span class="form-hint">正文与元数据分开保存，这里只更新文章内容</span>
        <el-button @click="handleClose">关闭</el-button>
        <el-button type="primary" :loading="saving" :disabled="loading || !!errorMessage" @click="handleSubmit">保存内容</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Markdown } from "@zhangxianjue/markdown";
import "@zhangxianjue/markdown/style.css";
// 公式字体与排版由宿主引入：库模式不允许把 KaTeX 的 @font-face 外置成独立文件
import "katex/dist/katex.min.css";
import articleService from "@/api/articleService";
import type { ArticleContentPayload } from "@/types/api";

const props = defineProps<{
  modelValue: boolean;
  /** 目标文章主键；为空表示没有可编辑的对象 */
  articleId: number | null;
  /** 仅用于弹窗标题展示 */
  articleTitle?: string;
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

const dialogTitle = computed(() => (props.articleTitle ? `编辑内容 · ${props.articleTitle}` : "编辑内容"));

const handleClose = (): void => {
  emit("close");
  visible.value = false;
};

/** 拉取最新正文：避免用列表里的陈旧数据覆盖别处的修改 */
const loadContent = async (): Promise<void> => {
  const id = props.articleId;
  if (id === null) {
    errorMessage.value = "未指定文章";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await articleService.getArticleDetail(id);
    content.value = res.data.content;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "内容加载失败";
  } finally {
    loading.value = false;
  }
};

/**
 * 正文插图上传：复用与封面相同的上传接口
 *
 * 编辑器只约定「收 File 返回 URL」，失败提示由本函数负责，
 * 抛出后编辑器会放弃插入，避免正文里出现无效图片链接。
 */
const uploadFile = async (file: File): Promise<string> => {
  try {
    const uploaded = await articleService.uploadImage(file);
    return uploaded.url;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "图片上传失败");
    throw error;
  }
};

const handleSubmit = async (): Promise<void> => {
  const id = props.articleId;
  if (id === null) {
    return;
  }

  saving.value = true;
  try {
    const payload: ArticleContentPayload = { content: content.value };
    await articleService.updateArticleContent(id, payload);
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

@media (max-width: 768px) {
  .editor-wrapper {
    height: 58vh;
  }

  .dialog-footer {
    flex-wrap: wrap;
    width: 100%;
  }

  .form-hint {
    flex: 1 1 100%;
    margin-right: 0;
  }
}
</style>
