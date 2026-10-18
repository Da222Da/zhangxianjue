<!-- src/views/notes/NoteMetaDialog.vue -->
<template>
  <el-dialog v-model="visible" :title="dialogTitle" width="640px" @close="handleClose" destroy-on-close>
    <el-form label-width="72px" class="note-form">
      <el-form-item label="标题">
        <el-input v-model="noteTitle" placeholder="请输入笔记标题" />
      </el-form-item>

      <el-form-item label="描述">
        <el-input v-model="description" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="一句话说明这篇笔记讲什么，会展示在 client 的卡片上" />
      </el-form-item>

      <el-form-item label="分类">
        <el-tree-select
          v-model="categoryId"
          class="category-select"
          :data="categoryOptions"
          :props="{ label: 'name', value: 'id', children: 'children' }"
          check-strictly
          clearable
          default-expand-all
          :render-after-expand="false"
          placeholder="选择分类（不选则为未分类）"
        />
      </el-form-item>

      <el-form-item label="访问">
        <el-switch v-model="isFree" active-text="限免" inactive-text="VIP 专属" />
        <span class="form-hint">限免：游客与普通用户也可阅读；关闭：仅会员 / 朋友 / 管理员可读</span>
      </el-form-item>

      <el-form-item label="游客可见">
        <el-switch v-model="guestVisible" active-text="可见" inactive-text="隐藏" />
        <span class="form-hint">关闭后未登录游客在列表与详情中都看不到；登录用户不受影响</span>
      </el-form-item>

      <el-form-item label="排序">
        <el-input-number v-model="sort" :min="0" :step="1" controls-position="right" />
        <span class="form-hint">数字越小越靠前，0 表示未排版</span>
      </el-form-item>

      <el-form-item label="封面">
        <div class="cover-field">
          <el-image v-if="hasCover" :src="previewUrl" fit="cover" class="cover-preview" />
          <div v-else class="cover-placeholder">暂无封面</div>

          <div class="cover-actions">
            <el-upload :show-file-list="false" :auto-upload="false" accept="image/*" :on-change="handleCoverChange">
              <el-button size="small" :loading="uploading">选择图片</el-button>
            </el-upload>
            <el-button v-if="hasCover" size="small" :disabled="uploading" @click="clear">移除</el-button>
            <span class="form-hint">{{ coverHint }}</span>
          </div>
        </div>
      </el-form-item>
    </el-form>

    <div class="form-tip">正文（思维导图）请用列表操作列的「编辑内容」单独维护，本弹窗只改元数据。</div>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button type="primary" :loading="saving" @click="handleSubmit">{{ props.type === "edit" ? "更新" : "新增" }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import type { UploadFile } from "element-plus";
import noteService from "@/api/noteService";
import { useArticleCover } from "@/composables/useArticleCover";
import type { CategoryTreeNode, NoteDraft, NoteMetaPayload } from "@/types/api";

const props = defineProps<{
  /** 弹窗形态：新增 / 更新元数据 */
  type: "add" | "edit";
  modelValue: boolean;
  /** 与父级共享的草稿对象，弹窗直接读写其字段 */
  note: NoteDraft;
  /** 分类树，供树形选择；由列表页统一获取后传入，避免重复请求 */
  categoryTree?: CategoryTreeNode[];
}>();

const emit = defineEmits<{
  close: [];
  update: [];
}>();

const visible = ref(props.modelValue);
const saving = ref(false);
/**
 * 封面状态复用文章的 composable
 *
 * ⚠️ 名字带 Article，但实现与文章无关 —— 它只做「选文件 → 本地预览 → 提交时上传」，
 * 且上传接口 /admin/upload 是全局共用的。不重命名是为了避免牵连 articles 页（无关重构）。
 */
const cover = useArticleCover();
const { previewUrl, hasCover, uploading } = cover;

const categoryOptions = computed(() => props.categoryTree ?? []);

const dialogTitle = computed(() => (props.type === "edit" ? "更新笔记" : "新增笔记"));

const coverHint = computed(() => {
  if (uploading.value) return "上传中…";
  if (cover.pendingFile.value) return "保存时上传";
  return "支持 jpeg / png / gif / webp，单张不超过 5 MB";
});

/** 标题：直接读写共享草稿，保持与父级一致 */
const noteTitle = computed({
  get: () => props.note.title,
  set: (val: string) => {
    props.note.title = val;
  },
});

const description = computed({
  get: () => props.note.description ?? "",
  set: (val: string) => {
    props.note.description = val ? val : null;
  },
});

/** 分类：树形选择的值为分类 id；清空时 el-tree-select 会给 undefined */
const categoryId = computed({
  get: () => props.note.category_id,
  set: (val: number | null | undefined) => {
    props.note.category_id = val ?? null;
  },
});

const isFree = computed({
  get: () => props.note.is_free,
  set: (val: boolean) => {
    props.note.is_free = val;
  },
});

/** 游客可见：关闭后未登录游客在列表与详情中都看不到 */
const guestVisible = computed({
  get: () => props.note.guest_visible,
  set: (val: boolean) => {
    props.note.guest_visible = val;
  },
});

const sort = computed({
  get: () => props.note.sort ?? 0,
  set: (val: number | null) => {
    props.note.sort = val ?? 0;
  },
});

const handleClose = (): void => {
  emit("close");
  visible.value = false;
};

/** 选中图片：仅暂存并生成本地预览，真正上传发生在保存时 */
const handleCoverChange = (uploadFile: UploadFile): void => {
  const file = uploadFile.raw;
  if (!file) {
    return;
  }
  cover.selectFile(file);
};

const clear = (): void => {
  cover.clear();
};

/**
 * 提交元数据
 *
 * ⚠️ 只提交元数据字段，刻意不带 content ——
 * 服务端的 PUT /note/:id 不触碰正文，两者互不覆盖。
 */
const handleSubmit = async (): Promise<void> => {
  const title = noteTitle.value.trim();
  if (!title) {
    ElMessage.warning("请输入笔记标题");
    return;
  }

  saving.value = true;
  try {
    const payload: NoteMetaPayload = {
      title,
      description: description.value.trim() ? description.value.trim() : null,
      cover: await cover.resolveForSubmit(),
      category_id: categoryId.value,
      is_free: isFree.value,
      guest_visible: guestVisible.value,
      sort: sort.value,
    };

    if (props.type === "edit") {
      await noteService.updateNote(Number(props.note.id), payload);
      ElMessage.success("笔记更新成功");
    } else {
      await noteService.createNote(payload);
      ElMessage.success("笔记新增成功");
    }

    handleClose();
    emit("update");
  } catch (error) {
    // 含上传失败：此时笔记不会提交，提示后由用户重试
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
      // 每次打开都按当前笔记重置封面状态，避免残留上一次的选择
      cover.reset(props.note.cover ?? null);
    }
  },
);
</script>

<style scoped>
.category-select {
  width: 260px;
}

.cover-field {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cover-preview,
.cover-placeholder {
  width: 88px;
  height: 88px;
  border-radius: 4px;
  flex-shrink: 0;
}

.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--el-border-color);
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.cover-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.form-hint {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.form-tip {
  padding: 8px 12px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 600px) {
  .category-select {
    width: 100%;
  }

  .cover-field {
    flex-wrap: wrap;
  }

  .form-hint {
    width: 100%;
  }
}
</style>
