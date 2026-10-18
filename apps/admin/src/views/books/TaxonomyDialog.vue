<!-- src/views/books/TaxonomyDialog.vue -->
<template>
  <el-dialog v-model="visible" :title="`${kindLabel}管理`" width="560px" @close="handleClose">
    <!-- 新增 / 编辑共用一条表单 -->
    <div class="taxonomy-form">
      <el-input
        v-model="form.name"
        class="name-input"
        :placeholder="`${kindLabel}名称`"
        maxlength="100"
        @keyup.enter="handleSave"
      />
      <el-input-number v-model="form.sort" :min="0" :step="1" controls-position="right" />
      <el-button type="primary" :loading="saving" @click="handleSave">
        {{ editingId === null ? "新增" : "保存修改" }}
      </el-button>
      <el-button v-if="editingId !== null" @click="resetForm">取消</el-button>
    </div>

    <el-table v-loading="loading" :data="items" size="small" border>
      <el-table-column label="操作" width="130" align="center">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button link type="primary" size="small" @click="startEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="removeItem(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="name" :label="kindLabel" min-width="180" show-overflow-tooltip />
      <el-table-column prop="sort" label="排序" width="80" align="center" />
    </el-table>

    <p class="dialog-hint">{{ hint }}</p>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import bookCategoryService from "@/api/bookCategoryService";
import tagService from "@/api/tagService";
import type { ApiResponse, BookTaxonomyPayload } from "@/types/api";

interface TaxonomyItem {
  id: number;
  name: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

interface TaxonomyService {
  get(): Promise<ApiResponse<TaxonomyItem[]>>;
  create(data: BookTaxonomyPayload): Promise<TaxonomyItem>;
  update(id: number, data: BookTaxonomyPayload): Promise<TaxonomyItem>;
  delete(id: number): Promise<void>;
}

const props = defineProps<{
  modelValue: boolean;
  kind: "category" | "tag";
}>();

const emit = defineEmits<{
  close: [];
  /** 分类 / 标签发生增删改，父级可据此刷新书籍表单选项 */
  change: [];
}>();

/** 两个 service 的方法名不同，这里统一成同一套接口供组件复用 */
const SERVICES: Record<"category" | "tag", TaxonomyService> = {
  category: {
    get: () => bookCategoryService.getCategories(),
    create: (data) => bookCategoryService.createCategory(data),
    update: (id, data) => bookCategoryService.updateCategory(id, data),
    delete: (id) => bookCategoryService.deleteCategory(id),
  },
  tag: {
    get: () => tagService.getTags(),
    create: (data) => tagService.createTag(data),
    update: (id, data) => tagService.updateTag(id, data),
    delete: (id) => tagService.deleteTag(id),
  },
};

const service = computed(() => SERVICES[props.kind]);
const kindLabel = computed(() => (props.kind === "category" ? "分类" : "标签"));
const hint = computed(() =>
  props.kind === "category"
    ? "删除分类后，原本属于该分类的书籍会自动变为未分类。"
    : "删除标签后，所有书籍上的该标签关联会一并移除。",
);

const visible = ref(props.modelValue);
const loading = ref(false);
const saving = ref(false);
const items = ref<TaxonomyItem[]>([]);
/** null 表示新增；否则为正在编辑的条目 id */
const editingId = ref<number | null>(null);

const form = reactive<{ name: string; sort: number }>({ name: "", sort: 0 });

const resetForm = (): void => {
  editingId.value = null;
  form.name = "";
  form.sort = 0;
};

const loadItems = async (): Promise<void> => {
  loading.value = true;
  try {
    const res = await service.value.get();
    items.value = res.data;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `${kindLabel.value}加载失败`);
  } finally {
    loading.value = false;
  }
};

const startEdit = (row: TaxonomyItem): void => {
  editingId.value = row.id;
  form.name = row.name;
  form.sort = row.sort;
};

const handleSave = async (): Promise<void> => {
  const name = form.name.trim();
  if (!name) {
    ElMessage.warning(`请输入${kindLabel.value}名称`);
    return;
  }

  saving.value = true;
  try {
    if (editingId.value === null) {
      await service.value.create({ name, sort: form.sort });
      ElMessage.success(`${kindLabel.value}新增成功`);
    } else {
      await service.value.update(editingId.value, { name, sort: form.sort });
      ElMessage.success(`${kindLabel.value}更新成功`);
    }

    resetForm();
    await loadItems();
    emit("change");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    saving.value = false;
  }
};

const removeItem = async (row: TaxonomyItem): Promise<void> => {
  try {
    await ElMessageBox.confirm(`确定删除${kindLabel.value}「${row.name}」吗？`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }

  try {
    await service.value.delete(row.id);
    ElMessage.success("删除成功");
    if (editingId.value === row.id) {
      resetForm();
    }
    await loadItems();
    emit("change");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "删除失败");
  }
};

const handleClose = (): void => {
  emit("close");
  visible.value = false;
};

watch(
  () => props.modelValue,
  (newVal: boolean) => {
    if (newVal) {
      visible.value = true;
      resetForm();
      void loadItems();
    }
  },
);
</script>

<style scoped>
.taxonomy-form {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.name-input {
  width: 220px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 4px;
  flex-wrap: wrap;
}

.dialog-hint {
  margin: 12px 0 0;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

@media (max-width: 600px) {
  .name-input {
    flex: 1 1 100%;
    width: 100%;
  }
}
</style>
