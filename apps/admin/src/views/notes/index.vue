<!-- src/views/notes/index.vue -->
<template>
  <el-main>
    <!-- 顶部操作栏：更新作用于表格中选中的那一行 -->
    <div class="header-actions">
      <el-input
        v-model="keyword"
        class="keyword-input"
        placeholder="搜索标题 / 描述 / 正文"
        clearable
        @keyup.enter="fetchNotes"
        @clear="fetchNotes"
      />
      <el-button type="primary" size="small" @click="fetchNotes">搜索</el-button>
      <el-tree-select
        v-model="categoryId"
        class="category-filter"
        :data="categoryTree"
        :props="{ label: 'name', value: 'id', children: 'children' }"
        check-strictly
        clearable
        default-expand-all
        :render-after-expand="false"
        placeholder="全部分类"
        @change="fetchNotes"
      />
      <el-button type="primary" size="small" @click="openMetaDialog('add')">新增</el-button>
      <el-button type="primary" size="small" @click="openMetaDialog('edit')">更新</el-button>
      <el-button v-if="canManageCategories" size="small" @click="categoryDialogVisible = true">分类管理</el-button>
    </div>

    <!-- row-key 让数据刷新后尽量保住当前高亮行 -->
    <el-table :data="notes" row-key="id" stripe border highlight-current-row style="width: 100%" @current-change="handleCurrentChange">
      <!-- 行首 radio 与行点击共用 currentRow，作为「更新」的作用对象 -->
      <el-table-column label="选中" width="64" align="center" fixed="left">
        <template #default="{ row }">
          <el-radio :model-value="currentRow?.id" :value="row.id" @change="handleCurrentChange(row)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" min-width="210" fixed="left">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button link type="primary" size="small" @click="openContentDialog(row)">编辑内容</el-button>
            <el-button link type="primary" size="small" @click="copyAppAddress(row)">复制应用地址</el-button>
            <el-button link type="danger" size="small" @click="deleteNote(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="封面" width="88" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.cover"
            :src="resolveAssetUrl(row.cover)"
            :preview-src-list="[resolveAssetUrl(row.cover)]"
            preview-teleported
            fit="cover"
            class="cover-thumb"
          />
          <span v-else class="empty-cell">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" show-overflow-tooltip min-width="180" />
      <el-table-column prop="description" label="描述" show-overflow-tooltip min-width="200" />
      <el-table-column label="分类" width="130">
        <template #default="{ row }">
          <el-tag v-if="row.category" size="small" type="info">{{ row.category }}</el-tag>
          <span v-else class="empty-cell">未分类</span>
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
      <el-table-column prop="sort" label="排序" width="80" align="center" />
      <el-table-column prop="updatedAt" label="更新时间" width="180" />
    </el-table>

    <p class="table-hint">
      顶部搜索框按标题 / 描述 / 正文模糊匹配，可与分类筛选叠加。表格中选中一行（或点行首 radio）后，点顶部的「更新」可修改它的封面 / 标题 / 描述 / 分类 / 访问 / 排序；正文请走操作列的「编辑内容」。「复制应用地址」复制的是带标题的
      Markdown 链接，如 `[标题](/notes/{id})`，可直接粘进正文。访问为「VIP」时，游客与普通用户无法读取正文。
    </p>
  </el-main>

  <NoteMetaDialog :type="metaDialogType" :modelValue="metaDialogVisible" :note="noteDraft" :category-tree="categoryTree" @close="metaDialogVisible = false" @update="refresh" />
  <NoteContentDialog :modelValue="contentDialogVisible" :note-id="contentNoteId" :note-title="contentNoteTitle" @close="contentDialogVisible = false" @update="refresh" />
  <CategoryManageDialog :model-value="categoryDialogVisible" @close="categoryDialogVisible = false" @change="fetchCategoryTree" />
</template>

<script lang="ts" setup>
import { computed, ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import noteService from "@/api/noteService";
import categoryService from "@/api/categoryService";
import { clientRoutes } from "@/constants/clientRoutes";
import { Permissions } from "@/constants/permissions";
import { resolveAssetUrl } from "@/services/apiConfig";
import { useAuthStore } from "@/store/auth";
import { copyText } from "@/util/clipboard";
import { formatMarkdownLink } from "@/util/markdown";
import NoteMetaDialog from "./NoteMetaDialog.vue";
import NoteContentDialog from "./NoteContentDialog.vue";
import CategoryManageDialog from "@/views/categories/CategoryManageDialog.vue";
import type { CategoryTreeNode, NoteDraft, NoteListItem } from "@/types/api";

type MetaDialogType = "add" | "edit";

/** 空白草稿：新增笔记与兜底时使用，保证弹窗内各字段始终有值 */
const emptyDraft = (): NoteDraft => ({
  id: "",
  title: "",
  cover: null,
  description: null,
  category_id: null,
  is_free: false,
  guest_visible: true,
  sort: 0,
});

const authStore = useAuthStore();
/** 分类管理按钮与 API 都要求 category:manage */
const canManageCategories = computed(() => authStore.hasPermission(Permissions.CATEGORY_MANAGE));

const notes = ref<NoteListItem[]>([]);
/** 搜索关键词；服务端按标题 / 描述 / 正文做 LIKE 模糊匹配 */
const keyword = ref("");
const categoryTree = ref<CategoryTreeNode[]>([]);
/** 选中的分类 id；null 表示不筛选 */
const categoryId = ref<number | null>(null);
/** 表格当前选中的行，是工具栏「更新」的作用对象 */
const currentRow = ref<NoteListItem | null>(null);

const metaDialogVisible = ref(false);
const metaDialogType = ref<MetaDialogType>("add");
const noteDraft = reactive<NoteDraft>(emptyDraft());

const contentDialogVisible = ref(false);
const contentNoteId = ref<number | null>(null);
const contentNoteTitle = ref<string>("");

const categoryDialogVisible = ref(false);

// 获取笔记列表（列表不含 content，正文由内容弹窗单独拉取）
const fetchNotes = async (): Promise<void> => {
  try {
    const res = await noteService.getNote({
      keyword: keyword.value.trim() || undefined,
      category_id: categoryId.value ?? undefined,
    });
    notes.value = res.data;

    // 刷新后把选中行换成新对象：否则「更新」会拿着上一次的陈旧数据提交
    if (currentRow.value) {
      const currentId = currentRow.value.id;
      currentRow.value = notes.value.find((item) => item.id === currentId) ?? null;
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "获取笔记列表失败");
  }
};

// 获取分类树，供筛选与弹窗的树形选择使用
// 失败时降级为「无可选分类」并保留列表展示，不因辅助信息中断主流程
const fetchCategoryTree = async (): Promise<void> => {
  try {
    const res = await categoryService.getTree();
    categoryTree.value = res.data;
  } catch {
    categoryTree.value = [];
  }
};

/** 列表与分类联动刷新：新增 / 更新笔记后都可能影响分类使用情况 */
const refresh = async (): Promise<void> => {
  await Promise.all([fetchNotes(), fetchCategoryTree()]);
};

const handleCurrentChange = (row: NoteListItem | null): void => {
  currentRow.value = row;
};

/**
 * 打开元数据弹窗
 * - add：清空草稿
 * - edit：编辑当前选中行；未选中时提示而不是静默无反应
 */
const openMetaDialog = (type: MetaDialogType): void => {
  if (type === "edit") {
    if (!currentRow.value) {
      ElMessage.warning("请先在表格中选中要更新的笔记");
      return;
    }
    Object.assign(noteDraft, currentRow.value);
  } else {
    Object.assign(noteDraft, emptyDraft());
  }

  metaDialogType.value = type;
  metaDialogVisible.value = true;
};

/** 打开内容弹窗：只传主键，正文由弹窗自己拉取最新值 */
const openContentDialog = (row: NoteListItem): void => {
  contentNoteId.value = row.id;
  contentNoteTitle.value = row.title;
  contentDialogVisible.value = true;
};

/** 复制带标题的 Markdown 链接，可直接粘进正文 */
const copyAppAddress = async (row: NoteListItem): Promise<void> => {
  const link = formatMarkdownLink(row.title, clientRoutes.note(row.id));
  try {
    await copyText(link);
    ElMessage.success(`已复制应用地址：${link}`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "复制失败，请手动复制");
  }
};

const deleteNote = async (row: NoteListItem): Promise<void> => {
  try {
    await ElMessageBox.confirm(`确定删除笔记「${row.title}」？删除后不可恢复。`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    // 用户取消，不做任何事
    return;
  }

  try {
    await noteService.deleteNote(row.id);
    ElMessage.success("删除成功");
    if (currentRow.value?.id === row.id) {
      currentRow.value = null;
    }
    refresh();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "删除失败");
  }
};

onMounted(() => {
  refresh();
});
</script>

<style scoped>
.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.keyword-input {
  width: 240px;
}

.category-filter {
  width: 160px;
}

.cover-thumb {
  width: 56px;
  height: 56px;
  border-radius: 4px;
  display: block;
  margin: 0 auto;
}

.empty-cell {
  color: var(--el-text-color-placeholder);
}

.action-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.table-hint {
  margin-top: 12px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
</style>
