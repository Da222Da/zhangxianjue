<!-- src/views/books/BookChaptersDialog.vue -->
<template>
  <el-dialog v-model="visible" :title="dialogTitle" width="92%" top="4vh" @close="handleClose" destroy-on-close>
    <div v-loading="loading" class="chapter-layout">
      <!-- 左：分卷 / 章节 -->
      <aside class="chapter-list">
        <div class="chapter-list__header">
          <span class="chapter-list__title">分卷 / 章节</span>
          <div class="chapter-list__actions">
            <el-button size="small" @click="openVolumeForm('create')">新增分卷</el-button>
            <el-button size="small" type="primary" plain :disabled="volumes.length === 0" @click="startCreateChapter">新增章节</el-button>
          </div>
        </div>

        <div class="chapter-list__body">
          <section
            v-for="volume in volumes"
            :key="volume.id"
            class="volume-group"
            :class="{ 'is-active': volume.id === selectedVolumeId }"
          >
            <div class="volume-header">
              <button type="button" class="volume-select" @click="selectVolume(volume)">
                <span class="volume-name">{{ volume.title }}</span>
                <span class="volume-count">{{ volume.chapters.length }}</span>
              </button>
              <div class="volume-actions">
                <el-button link type="primary" size="small" @click="openVolumeForm('edit', volume)">编辑</el-button>
                <el-button link type="danger" size="small" @click="removeVolume(volume)">删除</el-button>
              </div>
            </div>

            <div class="volume-chapters">
              <button
                v-for="chapter in volume.chapters"
                :key="chapter.id"
                type="button"
                class="chapter-item"
                :class="{ 'is-active': chapter.id === selectedId }"
                @click="selectChapter(chapter, volume.id)"
              >
                <span class="chapter-index">{{ chapterDisplayIndex(chapter.id) }}</span>
                <span class="chapter-name">{{ chapter.title }}</span>
              </button>
              <p v-if="volume.chapters.length === 0" class="volume-empty">本卷暂无章节</p>
            </div>
          </section>

          <p v-if="!loading && volumes.length === 0" class="chapter-empty">暂无分卷，先点「新增分卷」开始</p>
        </div>
      </aside>

      <!-- 右：章节编辑 -->
      <section class="chapter-editor">
        <div class="editor-meta">
          <el-select v-model="draft.volume_id" class="volume-select-field" placeholder="选择分卷">
            <el-option v-for="volume in volumes" :key="volume.id" :label="volume.title" :value="volume.id" />
          </el-select>
          <el-input v-model="draft.title" class="title-input" placeholder="章节标题" maxlength="255" show-word-limit />
          <el-input-number v-model="draft.sort" :min="0" :step="1" controls-position="right" />
        </div>

        <el-input
          v-model="draft.summary"
          type="textarea"
          :rows="2"
          maxlength="300"
          show-word-limit
          placeholder="本节内容（导读），会展示在 client 阅读页的绿色面板里"
        />

        <!-- 局部引入：编辑器含 markdown-it / katex，随弹窗懒加载 -->
        <div class="editor-wrapper">
          <Markdown v-model="draft.content" mode="edit&preview" :file-upload="uploadFile" placeholder="用 Markdown 撰写章节正文" />
        </div>
      </section>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button v-if="selectedId !== null" type="danger" plain :disabled="saving" @click="removeChapter">删除本章</el-button>
        <span class="form-hint">{{ statusHint }}</span>
        <el-button @click="handleClose">关闭</el-button>
        <el-button type="primary" :loading="saving" :disabled="loading" @click="saveChapter">保存章节</el-button>
      </div>
    </template>

    <!-- 分卷新增 / 编辑：嵌套弹窗，append-to-body 避免被外层裁切 -->
    <el-dialog
      v-model="volumeDialogVisible"
      :title="volumeDialogType === 'create' ? '新增分卷' : '编辑分卷'"
      width="420px"
      append-to-body
      destroy-on-close
    >
      <el-form label-width="72px">
        <el-form-item label="名称">
          <el-input v-model="volumeForm.title" maxlength="255" placeholder="如：基础篇 / 进阶篇" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="volumeForm.sort" :min="0" :step="1" controls-position="right" />
          <span class="form-hint">数字越小越靠前</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="volumeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="volumeSaving" @click="submitVolume">保存</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Markdown } from "@zhangxianjue/markdown";
import "@zhangxianjue/markdown/style.css";
import "katex/dist/katex.min.css";
import articleService from "@/api/articleService";
import bookService from "@/api/bookService";
import type { ChapterDraft, ChapterListItem, ChapterPayload, VolumeWithChapters } from "@/types/api";

type VolumeDialogType = "create" | "edit";

const props = defineProps<{
  modelValue: boolean;
  /** 目标书籍主键；为空表示没有可管理的对象 */
  bookId: number | null;
  /** 仅用于弹窗标题 */
  bookTitle?: string;
}>();

const emit = defineEmits<{
  close: [];
  update: [];
}>();

const visible = ref(props.modelValue);
const loading = ref(false);
const saving = ref(false);
const volumes = ref<VolumeWithChapters[]>([]);
/** 当前选中的章节 id；null 表示正在新建 */
const selectedId = ref<number | null>(null);
/** 当前选中的分卷 id；新增章节默认落在该卷 */
const selectedVolumeId = ref<number | null>(null);

const draft = reactive<ChapterDraft>({
  id: "",
  volume_id: null,
  title: "",
  summary: null,
  content: "",
  sort: 0,
});

const volumeDialogVisible = ref(false);
const volumeDialogType = ref<VolumeDialogType>("create");
const volumeSaving = ref(false);
const editingVolumeId = ref<number | null>(null);
const volumeForm = reactive({ title: "", sort: 0 });

const dialogTitle = computed(() => (props.bookTitle ? `分卷与章节 · ${props.bookTitle}` : "分卷与章节"));

const selectedVolume = computed(() => volumes.value.find((volume) => volume.id === selectedVolumeId.value) ?? null);

const statusHint = computed(() => {
  if (selectedId.value === null) {
    return selectedVolume.value ? `新章节将保存到「${selectedVolume.value.title}」` : "请先新增分卷";
  }
  return `正在编辑「${selectedVolume.value?.title ?? "未知分卷"}」下的章节 #${selectedId.value}`;
});

/** 全局章节序号（跨分卷连续编号） */
const chapterDisplayIndex = (chapterId: number): string => {
  let index = 0;
  for (const volume of volumes.value) {
    for (const chapter of volume.chapters) {
      if (chapter.id === chapterId) {
        return String(index + 1).padStart(2, "0");
      }
      index += 1;
    }
  }
  return "";
};

const handleClose = (): void => {
  emit("close");
  visible.value = false;
};

const resetDraft = (volumeId: number | null, sort = 0): void => {
  draft.id = "";
  draft.volume_id = volumeId;
  draft.title = "";
  draft.summary = null;
  draft.content = "";
  draft.sort = sort;
};

/** 把章节详情填入草稿 */
const fillDraft = (chapter: ChapterListItem & { content?: string }, volumeId: number): void => {
  draft.id = chapter.id;
  draft.volume_id = volumeId;
  draft.title = chapter.title;
  draft.summary = chapter.summary;
  draft.content = chapter.content ?? "";
  draft.sort = chapter.sort;
};

/**
 * 拉取分卷与章节；保持当前选中项
 * @param preferId 优先选中的章节 id；不存在时回落到 preferVolumeId / 第一卷
 * @param preferVolumeId 优先选中的分卷 id；新建分卷后用它保住新卷的选中态
 */
const loadChapters = async (preferId?: number, preferVolumeId?: number): Promise<void> => {
  const bookId = props.bookId;
  if (bookId === null) {
    return;
  }

  loading.value = true;
  try {
    const res = await bookService.getBookDetail(bookId);
    volumes.value = res.data.volumes;

    const targetId = preferId ?? selectedId.value;
    let targetVolume: VolumeWithChapters | undefined;
    let targetChapter: ChapterListItem | undefined;
    if (targetId !== null) {
      for (const volume of volumes.value) {
        const chapter = volume.chapters.find((item) => item.id === targetId);
        if (chapter) {
          targetVolume = volume;
          targetChapter = chapter;
          break;
        }
      }
    }

    if (targetVolume && targetChapter) {
      await selectChapter(targetChapter, targetVolume.id);
    } else {
      selectedId.value = null;
      const targetVolumeFallback =
        volumes.value.find((volume) => volume.id === preferVolumeId) ?? volumes.value[0] ?? null;
      selectedVolumeId.value = targetVolumeFallback?.id ?? null;
      resetDraft(targetVolumeFallback?.id ?? null, targetVolumeFallback?.chapters.length ?? 0);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "分卷与章节加载失败");
  } finally {
    loading.value = false;
  }
};

/** 选中章节并拉取正文 */
const selectChapter = async (chapter: ChapterListItem, volumeId: number): Promise<void> => {
  const bookId = props.bookId;
  if (bookId === null) {
    return;
  }

  selectedId.value = chapter.id;
  selectedVolumeId.value = volumeId;
  fillDraft(chapter, volumeId);

  try {
    const res = await bookService.getChapterDetail(bookId, chapter.id);
    fillDraft(res.data, volumeId);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "章节正文加载失败");
  }
};

/**
 * 选中分卷
 *
 * 点击卷头表示「在这个分卷下新建章节」，因此清空当前章节选中态并把编辑器重置为空白草稿。
 * 切换章节本来就不会提示未保存内容，这里保持同一套交互，避免卷头点击后编辑器仍停留在别的卷。
 */
const selectVolume = (volume: VolumeWithChapters): void => {
  selectedVolumeId.value = volume.id;
  selectedId.value = null;
  resetDraft(volume.id, volume.chapters.length);
};

/** 新建：不立即落库，保存时才创建 */
const startCreateChapter = (): void => {
  const volume = selectedVolume.value ?? volumes.value[0] ?? null;
  if (!volume) {
    ElMessage.warning("请先新增分卷");
    return;
  }

  selectedVolumeId.value = volume.id;
  selectedId.value = null;
  resetDraft(volume.id, volume.chapters.length);
};

/** 打开分卷表单 */
const openVolumeForm = (type: VolumeDialogType, volume?: VolumeWithChapters): void => {
  volumeDialogType.value = type;
  editingVolumeId.value = type === "edit" && volume ? volume.id : null;
  volumeForm.title = type === "edit" && volume ? volume.title : "";
  volumeForm.sort = type === "edit" && volume ? volume.sort : volumes.value.length;
  volumeDialogVisible.value = true;
};

const submitVolume = async (): Promise<void> => {
  const bookId = props.bookId;
  if (bookId === null) {
    return;
  }

  const title = volumeForm.title.trim();
  if (!title) {
    ElMessage.warning("请输入分卷名称");
    return;
  }

  volumeSaving.value = true;
  try {
    if (volumeDialogType.value === "edit" && editingVolumeId.value !== null) {
      await bookService.updateVolume(bookId, editingVolumeId.value, { title, sort: volumeForm.sort });
      ElMessage.success("分卷已更新");
    } else {
      const created = await bookService.createVolume(bookId, { title, sort: volumeForm.sort });
      // 新建分卷后直接切到该卷的空白章节草稿，方便继续录入
      selectedId.value = null;
      selectedVolumeId.value = created.id;
      ElMessage.success("分卷已创建");
    }

    volumeDialogVisible.value = false;
    await loadChapters(selectedId.value ?? undefined, selectedVolumeId.value ?? undefined);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "分卷保存失败");
  } finally {
    volumeSaving.value = false;
  }
};

/** 删除分卷：卷内章节会一并删除 */
const removeVolume = async (volume: VolumeWithChapters): Promise<void> => {
  const bookId = props.bookId;
  if (bookId === null) {
    return;
  }

  const chapterHint = volume.chapters.length > 0 ? `该分卷下的 ${volume.chapters.length} 个章节会一并删除，且不可恢复。` : "该分卷下没有章节。";
  try {
    await ElMessageBox.confirm(`确定删除分卷「${volume.title}」？${chapterHint}`, "删除分卷", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }

  try {
    await bookService.deleteVolume(bookId, volume.id);
    ElMessage.success("分卷已删除");
    if (selectedVolumeId.value === volume.id) {
      selectedVolumeId.value = null;
    }
    if (volume.chapters.some((chapter) => chapter.id === selectedId.value)) {
      selectedId.value = null;
    }
    await loadChapters();
    emit("update");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "分卷删除失败");
  }
};

/** 正文插图上传：复用全局图片上传接口 */
const uploadFile = async (file: File): Promise<string> => {
  try {
    const uploaded = await articleService.uploadImage(file);
    return uploaded.url;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "图片上传失败");
    throw error;
  }
};

const saveChapter = async (): Promise<void> => {
  const bookId = props.bookId;
  if (bookId === null) {
    return;
  }

  const title = draft.title.trim();
  if (!title) {
    ElMessage.warning("请输入章节标题");
    return;
  }

  const volumeId = draft.volume_id ?? selectedVolumeId.value;
  if (volumeId === null) {
    ElMessage.warning("请先选择分卷");
    return;
  }

  const payload: ChapterPayload = {
    volume_id: volumeId,
    title,
    summary: draft.summary?.trim() ? draft.summary.trim() : null,
    content: draft.content,
    sort: draft.sort,
  };

  saving.value = true;
  try {
    let savedId: number;
    if (selectedId.value === null) {
      const created = await bookService.createChapter(bookId, payload);
      savedId = created.id;
      ElMessage.success("章节已创建");
    } else {
      await bookService.updateChapter(bookId, selectedId.value, payload);
      savedId = selectedId.value;
      ElMessage.success("章节已保存");
    }

    selectedId.value = savedId;
    selectedVolumeId.value = volumeId;
    await loadChapters(savedId);
    emit("update");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    saving.value = false;
  }
};

const removeChapter = async (): Promise<void> => {
  const bookId = props.bookId;
  const chapterId = selectedId.value;
  if (bookId === null || chapterId === null) {
    return;
  }

  try {
    await ElMessageBox.confirm(`确定删除「${draft.title}」吗？该操作不可恢复。`, "删除章节", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }

  try {
    await bookService.deleteChapter(bookId, chapterId);
    ElMessage.success("章节已删除");
    selectedId.value = null;
    await loadChapters();
    emit("update");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "删除失败");
  }
};

watch(
  () => props.modelValue,
  (newVal: boolean) => {
    if (newVal) {
      visible.value = true;
      selectedId.value = null;
      selectedVolumeId.value = null;
      volumes.value = [];
      void loadChapters();
    }
  },
);
</script>

<style scoped>
.chapter-layout {
  display: flex;
  gap: 16px;
  min-height: 60vh;
}

.chapter-list {
  display: flex;
  flex: 0 0 270px;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-light);
  padding-right: 12px;
}

.chapter-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.chapter-list__title {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.chapter-list__actions {
  display: flex;
  gap: 6px;
}

.chapter-list__body {
  flex: 1;
  overflow-y: auto;
}

.volume-group {
  margin-bottom: 10px;
  padding: 6px 6px 4px;
  border: 1px solid transparent;
  border-radius: 6px;
}

.volume-group.is-active {
  border-color: var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
}

.volume-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-bottom: 4px;
  border-bottom: 1px dashed var(--el-border-color-light);
}

.volume-select {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 4px 2px;
  border: none;
  background: transparent;
  color: var(--el-text-color-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.volume-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.volume-count {
  flex-shrink: 0;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 400;
  text-align: center;
}

.volume-actions {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
}

.volume-chapters {
  padding-top: 4px;
}

.chapter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 9px 7px 14px;
  margin-bottom: 2px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-regular);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.chapter-item:hover {
  background: var(--el-fill-color-light);
}

.chapter-item.is-active {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}

.chapter-index {
  color: var(--el-text-color-placeholder);
  font-family: var(--el-font-family-mono, monospace);
  font-size: 12px;
}

.chapter-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-empty,
.volume-empty {
  margin: 12px 0;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  text-align: center;
}

.chapter-editor {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.editor-meta {
  display: flex;
  gap: 10px;
  align-items: center;
}

.volume-select-field {
  width: 160px;
  flex-shrink: 0;
}

.title-input {
  flex: 1;
}

.editor-wrapper {
  height: 52vh;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.form-hint {
  margin-right: auto;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

@media (max-width: 900px) {
  .chapter-layout {
    flex-direction: column;
    min-height: 0;
  }

  .chapter-list {
    flex-basis: auto;
    width: 100%;
    max-height: 280px;
    padding-right: 0;
    padding-bottom: 12px;
    border-right: none;
    border-bottom: 1px solid var(--el-border-color-light);
  }

  .chapter-list__body {
    max-height: 220px;
  }

  .editor-meta {
    flex-wrap: wrap;
  }

  .volume-select-field {
    flex: 1 1 140px;
    width: auto;
  }

  .title-input {
    flex: 1 1 220px;
  }

  .editor-wrapper {
    height: 45vh;
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

@media (max-width: 600px) {
  .volume-select-field,
  .title-input {
    flex: 1 1 100%;
    width: 100%;
  }
}
</style>
