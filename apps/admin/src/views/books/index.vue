<!-- src/views/books/index.vue -->
<template>
  <el-main>
    <div class="header-actions">
      <el-input
        v-model="keyword"
        class="keyword-input"
        placeholder="搜索书名（模糊匹配）"
        clearable
        @keyup.enter="fetchBooks"
        @clear="fetchBooks"
      />
      <el-button type="primary" size="small" @click="fetchBooks">搜索</el-button>
      <el-button type="primary" size="small" @click="openCreate">新增书籍</el-button>
      <el-button size="small" @click="categoryDialogVisible = true">分类管理</el-button>
      <el-button size="small" @click="tagDialogVisible = true">标签管理</el-button>
    </div>

    <el-table v-loading="loading" :data="books" row-key="id" stripe border highlight-current-row style="width: 100%" @current-change="handleCurrentChange">
      <!-- 行首 radio 与行点击共用 currentRow，用于标记当前选中项 -->
      <el-table-column label="选中" width="64" align="center" fixed="left">
        <template #default="{ row }">
          <el-radio :model-value="currentRow?.id" :value="row.id" @change="handleCurrentChange(row)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" align="center" fixed="left">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button link type="primary" size="small" @click="openChapters(row)">章节管理</el-button>
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="copyAppAddress(row)">复制应用地址</el-button>
            <el-button link type="danger" size="small" @click="removeBook(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="封面" width="92" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.cover"
            :src="resolveAssetUrl(row.cover)"
            :preview-src-list="[resolveAssetUrl(row.cover)]"
            preview-teleported
            fit="cover"
            class="cover-thumb"
          />
          <div v-else class="cover-placeholder">无</div>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="书名" min-width="200" show-overflow-tooltip />
      <el-table-column label="分类" width="110">
        <template #default="{ row }">
          <el-tag v-if="row.category" size="small" type="info">{{ row.category }}</el-tag>
          <span v-else class="empty-cell">未分类</span>
        </template>
      </el-table-column>
      <el-table-column label="标签" min-width="160">
        <template #default="{ row }">
          <div v-if="row.tags.length > 0" class="tag-list">
            <el-tag v-for="tag in row.tags" :key="tag.id" size="small" effect="plain">{{ tag.name }}</el-tag>
          </div>
          <span v-else class="empty-cell">—</span>
        </template>
      </el-table-column>
      <el-table-column label="访问" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.is_free" size="small" type="success">限免</el-tag>
          <el-tag v-else size="small" type="warning">VIP</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="游客" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.guest_visible" size="small" type="success">可见</el-tag>
          <el-tag v-else size="small" type="info">隐藏</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="分卷数" width="90" align="center">
        <template #default="{ row }">{{ row.volume_count }}</template>
      </el-table-column>
      <el-table-column label="章节数" width="90" align="center">
        <template #default="{ row }">{{ row.chapter_count }}</template>
      </el-table-column>
      <el-table-column prop="sort" label="排序" width="80" align="center" />
      <el-table-column label="更新时间" width="172">
        <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
      </el-table-column>
    </el-table>

    <p class="table-hint">
      顶部搜索框按书名模糊匹配。删除书籍会连同其全部分卷与章节一起删除；分卷与章节在「章节管理」里维护。访问为「VIP」时，游客与普通用户只能看到卡片，无法打开正文。「复制应用地址」复制的是带书名的
      Markdown 链接，如 `[书名](/library/{id})`，可直接粘进正文。
    </p>
  </el-main>

  <BookMetaDialog :type="metaDialogType" :model-value="metaDialogVisible" :book="bookDraft" @close="metaDialogVisible = false" @update="fetchBooks" />
  <BookChaptersDialog
    :model-value="chaptersDialogVisible"
    :book-id="chapterBookId"
    :book-title="chapterBookTitle"
    @close="chaptersDialogVisible = false"
    @update="fetchBooks"
  />
  <TaxonomyDialog kind="category" :model-value="categoryDialogVisible" @close="categoryDialogVisible = false" @change="fetchBooks" />
  <TaxonomyDialog kind="tag" :model-value="tagDialogVisible" @close="tagDialogVisible = false" @change="fetchBooks" />
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import bookService from "@/api/bookService";
import { clientRoutes } from "@/constants/clientRoutes";
import { resolveAssetUrl } from "@/services/apiConfig";
import type { Book, BookDraft } from "@/types/api";
import { copyText } from "@/util/clipboard";
import { formatMarkdownLink } from "@/util/markdown";
import BookChaptersDialog from "./BookChaptersDialog.vue";
import BookMetaDialog from "./BookMetaDialog.vue";
import TaxonomyDialog from "./TaxonomyDialog.vue";

type MetaDialogType = "add" | "edit";

/** 空白草稿：新增与兜底时使用，保证弹窗内各字段始终有值 */
const emptyDraft = (): BookDraft => ({
  id: "",
  title: "",
  cover: null,
  description: null,
  category_id: null,
  tag_ids: [],
  is_free: false,
  guest_visible: true,
  sort: 0,
});

const books = ref<Book[]>([]);
const keyword = ref("");
const loading = ref(false);
/** 表格当前选中的行；行首 radio 与行点击都会更新它 */
const currentRow = ref<Book | null>(null);

const metaDialogVisible = ref(false);
const metaDialogType = ref<MetaDialogType>("add");
const bookDraft = reactive<BookDraft>(emptyDraft());

const chaptersDialogVisible = ref(false);
const chapterBookId = ref<number | null>(null);
const chapterBookTitle = ref("");

const categoryDialogVisible = ref(false);
const tagDialogVisible = ref(false);

/** 时间显示：去掉 ISO 的 T / 毫秒与 Z */
const formatDateTime = (value: string): string => value.replace("T", " ").slice(0, 19);

const fetchBooks = async (): Promise<void> => {
  loading.value = true;
  try {
    const res = await bookService.getBooks({ keyword: keyword.value.trim() || undefined });
    books.value = res.data;

    // 搜索 / 刷新后按 id 换回新对象；选中项已被筛掉时清空，避免 radio 指向不存在的行
    if (currentRow.value) {
      const currentId = currentRow.value.id;
      currentRow.value = books.value.find((item) => item.id === currentId) ?? null;
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "获取书籍列表失败");
  } finally {
    loading.value = false;
  }
};

const handleCurrentChange = (row: Book | null): void => {
  currentRow.value = row;
};

const openCreate = (): void => {
  metaDialogType.value = "add";
  Object.assign(bookDraft, emptyDraft());
  metaDialogVisible.value = true;
};

const openEdit = (row: Book): void => {
  metaDialogType.value = "edit";
  Object.assign(bookDraft, {
    id: row.id,
    title: row.title,
    cover: row.cover,
    description: row.description,
    category_id: row.category_id,
    tag_ids: row.tags.map((tag) => tag.id),
    is_free: row.is_free,
    guest_visible: row.guest_visible,
    sort: row.sort,
  });
  metaDialogVisible.value = true;
};

const openChapters = (row: Book): void => {
  chapterBookId.value = row.id;
  chapterBookTitle.value = row.title;
  chaptersDialogVisible.value = true;
};

/** 复制带书名的 Markdown 链接，可直接粘进正文 */
const copyAppAddress = async (row: Book): Promise<void> => {
  const link = formatMarkdownLink(row.title, clientRoutes.book(row.id));
  try {
    await copyText(link);
    ElMessage.success(`已复制应用地址：${link}`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "复制失败，请手动复制");
  }
};

const removeBook = async (row: Book): Promise<void> => {
  try {
    await ElMessageBox.confirm(
      `确定删除《${row.title}》吗？它的 ${row.volume_count} 个分卷、${row.chapter_count} 个章节会一并删除，且不可恢复。`,
      "删除书籍",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }

  try {
    await bookService.deleteBook(row.id);
    ElMessage.success("书籍已删除");
    await fetchBooks();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "删除失败");
  }
};

onMounted(fetchBooks);
</script>

<style scoped lang="scss">
.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}

.keyword-input {
  width: 240px;
}

.cover-thumb,
.cover-placeholder {
  width: 56px;
  height: 56px;
  border-radius: 4px;
}

.cover-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--el-border-color);
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.empty-cell {
  color: var(--el-text-color-placeholder);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.table-hint {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 2px;
}
</style>
