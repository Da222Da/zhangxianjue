<!-- src/views/categories/CategoryManageDialog.vue -->
<template>
  <el-dialog v-model="visible" title="分类管理" width="760px" @close="handleClose">
    <div class="header-actions">
      <el-button type="primary" size="small" @click="openForm('add', null)">新增根分类</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="tree"
      row-key="id"
      :tree-props="{ children: 'children' }"
      default-expand-all
      stripe
      border
      max-height="380"
      style="width: 100%"
    >
      <!-- ⚠️ 树形表格的展开箭头固定在第一列，因此「名称」必须留在最前；
           其余普通数据表格的操作列都已前置。 -->
      <el-table-column prop="name" label="名称" min-width="240" show-overflow-tooltip />
      <el-table-column prop="sort" label="排序" width="90" align="center" />
      <el-table-column label="操作" width="260" align="center">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button link type="primary" size="small" @click="openForm('add', row)">新增子分类</el-button>
            <el-button link type="primary" size="small" @click="openForm('edit', row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <p class="table-hint">删除分类前需先清空它的子分类，并把引用它的文章 / 笔记改到其它分类。</p>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>

    <!-- 新增 / 编辑分类：嵌套弹窗，append-to-body 避免被外层裁切 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="480px" append-to-body destroy-on-close>
      <el-form label-width="84px">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="请输入分类名称" />
        </el-form-item>

        <el-form-item label="上级分类">
          <el-tree-select
            v-model="form.parent_id"
            class="parent-select"
            :data="parentOptions"
            :props="{ label: 'name', value: 'id', children: 'children' }"
            check-strictly
            clearable
            default-expand-all
            :render-after-expand="false"
            placeholder="不选则为根分类"
          />
        </el-form-item>

        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :step="1" controls-position="right" />
          <span class="form-hint">同级内数字越小越靠前</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">{{ formType === "edit" ? "保存" : "新增" }}</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import categoryService from "@/api/categoryService";
import type { CategoryPayload, CategoryTreeNode } from "@/types/api";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  close: [];
  /** 分类发生增删改，父级可据此刷新筛选器与树形下拉 */
  change: [];
}>();

type FormType = "add" | "edit";

const visible = ref(props.modelValue);
const loading = ref(false);
const saving = ref(false);
const tree = ref<CategoryTreeNode[]>([]);

const formVisible = ref(false);
const formType = ref<FormType>("add");
/** 编辑时的目标分类 id */
const editingId = ref<number | null>(null);

const form = reactive<{ name: string; parent_id: number | null; sort: number }>({
  name: "",
  parent_id: null,
  sort: 0,
});

const formTitle = computed(() => (formType.value === "edit" ? "编辑分类" : "新增分类"));

/**
 * 上级分类的可选项
 *
 * ⚠️ 编辑时必须把「自己及自己的子孙」从候选项里剔除，
 * 否则用户能选出一个环（服务端也会拦，但这里先挡一道）。
 */
const parentOptions = computed<CategoryTreeNode[]>(() => {
  if (formType.value !== "edit" || editingId.value === null) {
    return tree.value;
  }

  const prune = (nodes: CategoryTreeNode[]): CategoryTreeNode[] =>
    nodes.filter((node) => node.id !== editingId.value).map((node) => ({ ...node, children: prune(node.children) }));

  return prune(tree.value);
});

const fetchTree = async (): Promise<void> => {
  loading.value = true;
  try {
    const res = await categoryService.getTree();
    tree.value = res.data;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "获取分类失败");
  } finally {
    loading.value = false;
  }
};

/**
 * 打开分类表单
 * @param type add / edit
 * @param row  add 时为父分类（可为 null 表示根级）；edit 时为被编辑的分类
 */
const openForm = (type: FormType, row: CategoryTreeNode | null): void => {
  formType.value = type;
  editingId.value = type === "edit" && row ? row.id : null;

  form.name = type === "edit" && row ? row.name : "";
  // 从「新增子分类」按钮进入时，父级预填为当前行
  form.parent_id = type === "edit" && row ? row.parent_id : (row?.id ?? null);
  form.sort = type === "edit" && row ? row.sort : 0;

  formVisible.value = true;
};

const handleSubmit = async (): Promise<void> => {
  const name = form.name.trim();
  if (!name) {
    ElMessage.warning("请输入分类名称");
    return;
  }

  saving.value = true;
  try {
    const payload: CategoryPayload = {
      name,
      parent_id: form.parent_id ?? null,
      sort: form.sort,
    };

    if (formType.value === "edit" && editingId.value !== null) {
      await categoryService.updateCategory(editingId.value, payload);
      ElMessage.success("分类更新成功");
    } else {
      await categoryService.createCategory(payload);
      ElMessage.success("分类新增成功");
    }

    formVisible.value = false;
    await fetchTree();
    emit("change");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    saving.value = false;
  }
};

const remove = async (row: CategoryTreeNode): Promise<void> => {
  try {
    await ElMessageBox.confirm(`确定删除分类「${row.name}」？`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }

  try {
    await categoryService.deleteCategory(row.id);
    ElMessage.success("删除成功");
    await fetchTree();
    emit("change");
  } catch (error) {
    // 服务端会说明原因（有子分类 / 仍被引用），直接透出
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
      void fetchTree();
    }
  },
);
</script>

<style scoped>
.header-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.parent-select {
  width: 260px;
}

.form-hint {
  margin-left: 8px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.table-hint {
  margin-top: 12px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

@media (max-width: 600px) {
  .header-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .parent-select {
    width: 100%;
  }

  .form-hint {
    width: 100%;
    margin-left: 0;
  }
}
</style>
