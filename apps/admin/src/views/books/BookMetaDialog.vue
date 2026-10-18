<!-- src/views/books/BookMetaDialog.vue -->
<template>
  <el-dialog v-model="visible" :title="dialogTitle" width="640px" @close="handleClose" destroy-on-close>
    <el-form label-width="80px" class="book-form">
      <el-form-item label="书名">
        <el-input v-model="title" placeholder="请输入书名" />
      </el-form-item>

      <el-form-item label="描述">
        <el-input
          v-model="description"
          type="textarea"
          :rows="3"
          maxlength="300"
          show-word-limit
          placeholder="一句话概括这本书的内容，会展示在书库卡片上"
        />
      </el-form-item>

      <el-form-item label="分类">
        <el-select v-model="categoryId" class="field-select" clearable filterable placeholder="选择分类（不选则为未分类）">
          <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <span class="form-hint">分类在列表页的「分类管理」中维护</span>
      </el-form-item>

      <el-form-item label="标签">
        <el-select
          v-model="tagIds"
          class="field-select"
          multiple
          filterable
          clearable
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择标签（可多选）"
        >
          <el-option v-for="item in tags" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <span class="form-hint">标签在列表页的「标签管理」中维护</span>
      </el-form-item>

      <el-form-item label="访问">
        <el-switch v-model="isFree" active-text="限免" inactive-text="VIP 专属" />
        <span class="form-hint">限免：游客与普通用户也可阅读；关闭：仅会员 / 朋友 / 管理员可读</span>
      </el-form-item>

      <el-form-item label="游客可见">
        <el-switch v-model="guestVisible" active-text="可见" inactive-text="隐藏" />
        <span class="form-hint">关闭后未登录游客在书库列表与阅读页中都看不到；登录用户不受影响</span>
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

    <div class="form-tip">章节请用列表操作列的「章节管理」维护，本弹窗只改书籍元数据。</div>

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
import bookService from "@/api/bookService";
import bookCategoryService from "@/api/bookCategoryService";
import tagService from "@/api/tagService";
import { useArticleCover } from "@/composables/useArticleCover";
import type { BookCategoryItem, BookDraft, BookPayload, BookTagItem } from "@/types/api";

const props = defineProps<{
  type: "add" | "edit";
  modelValue: boolean;
  /** 与父级共享的草稿对象，弹窗直接读写其字段 */
  book: BookDraft;
}>();

const emit = defineEmits<{
  close: [];
  update: [];
}>();

const visible = ref(props.modelValue);
const saving = ref(false);
const cover = useArticleCover();
const { previewUrl, hasCover, uploading } = cover;

const categories = ref<BookCategoryItem[]>([]);
const tags = ref<BookTagItem[]>([]);

const dialogTitle = computed(() => (props.type === "edit" ? "更新书籍" : "新增书籍"));

const coverHint = computed(() => {
  if (uploading.value) return "上传中…";
  if (cover.pendingFile.value) return "保存时上传";
  return "支持 jpeg / png / gif / webp，单张不超过 5 MB";
});

/** 分类 / 标签选项：每次打开都重新拉取，保证刚在管理弹窗里改过的数据立即可用 */
const loadOptions = async (): Promise<void> => {
  try {
    const [categoryRes, tagRes] = await Promise.all([bookCategoryService.getCategories(), tagService.getTags()]);
    categories.value = categoryRes.data;
    tags.value = tagRes.data;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "分类 / 标签加载失败");
  }
};

/** 下列字段直接读写共享草稿，保持与父级一致 */
const title = computed({
  get: () => props.book.title,
  set: (val: string) => {
    props.book.title = val;
  },
});

const description = computed({
  get: () => props.book.description ?? "",
  set: (val: string) => {
    props.book.description = val ? val : null;
  },
});

const categoryId = computed({
  get: () => props.book.category_id,
  set: (val: number | null | undefined) => {
    props.book.category_id = val ?? null;
  },
});

const tagIds = computed({
  get: () => props.book.tag_ids,
  set: (val: number[] | null | undefined) => {
    props.book.tag_ids = val ?? [];
  },
});

const isFree = computed({
  get: () => props.book.is_free,
  set: (val: boolean) => {
    props.book.is_free = val;
  },
});

/** 游客可见：关闭后未登录游客在书库列表与阅读页中都看不到 */
const guestVisible = computed({
  get: () => props.book.guest_visible,
  set: (val: boolean) => {
    props.book.guest_visible = val;
  },
});

const sort = computed({
  get: () => props.book.sort ?? 0,
  set: (val: number | null) => {
    props.book.sort = val ?? 0;
  },
});

const handleClose = (): void => {
  emit("close");
  visible.value = false;
};

const handleCoverChange = (uploadFile: UploadFile): void => {
  const file = uploadFile.raw;
  if (file) {
    cover.selectFile(file);
  }
};

const clear = (): void => {
  cover.clear();
};

const handleSubmit = async (): Promise<void> => {
  const bookTitle = title.value.trim();
  if (!bookTitle) {
    ElMessage.warning("请输入书名");
    return;
  }

  saving.value = true;
  try {
    const payload: BookPayload = {
      title: bookTitle,
      description: description.value.trim() ? description.value.trim() : null,
      cover: await cover.resolveForSubmit(),
      category_id: categoryId.value,
      tag_ids: tagIds.value,
      is_free: isFree.value,
      guest_visible: guestVisible.value,
      sort: sort.value,
    };

    if (props.type === "edit") {
      await bookService.updateBook(Number(props.book.id), payload);
      ElMessage.success("书籍更新成功");
    } else {
      await bookService.createBook(payload);
      ElMessage.success("书籍新增成功，可在「章节管理」里补充章节");
    }

    handleClose();
    emit("update");
  } catch (error) {
    // 含上传失败：此时书籍不会提交，提示后由用户重试
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
      // 每次打开都按当前书籍重置封面状态，避免残留上一次的选择
      cover.reset(props.book.cover ?? null);
      void loadOptions();
    }
  },
);
</script>

<style scoped>
.book-form {
  margin-bottom: 12px;
}

.field-select {
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
  .field-select {
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
