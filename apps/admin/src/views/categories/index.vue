<!-- src/views/categories/index.vue -->
<template>
  <el-main>
    <div class="header-actions">
      <el-button type="primary" size="small" @click="openDialog('add', null)">新增根分类</el-button>
    </div>

    <el-table v-loading="loading" :data="tree" row-key="id" :tree-props="{ children: 'children' }" default-expand-all stripe border style="width: 100%">
      <el-table-column prop="name" label="名称" min-width="240" show-overflow-tooltip />
      <el-table-column prop="sort" label="排序" width="90" align="center" />
      <el-table-column label="操作" width="300" align="center">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button link type="primary" size="small" @click="openDialog('add', row)">新增子分类</el-button>
            <el-button link type="primary" size="small" @click="openDialog('edit', row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <p class="table-hint">删除分类前需先清空它的子分类，并把引用它的文章 / 笔记改到其它分类。</p>
  </el-main>

  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="480px" @close="handleClose" destroy-on-close>
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
      <el-button @click="handleClose">关闭</el-button>
      <el-button type="primary" :loading="saving" @click="handleSubmit">{{ dialogType === "edit" ? "保存" : "新增" }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import categoryService from "@/api/categoryService";
import type { CategoryPayload, CategoryTreeNode } from "@/types/api";

type DialogType = "add" | "edit";

const loading = ref(false);
const saving = ref(false);
const tree = ref<CategoryTreeNode[]>([]);

const dialogVisible = ref(false);
const dialogType = ref<DialogType>("add");
/** 编辑时的目标分类 id */
const editingId = ref<number | null>(null);

const form = reactive<{ name: string; parent_id: number | null; sort: number }>({
  name: "",
  parent_id: null,
  sort: 0,
});

const dialogTitle = computed(() => (dialogType.value === "edit" ? "编辑分类" : "新增分类"));

/**
 * 上级分类的可选项
 *
 * ⚠️ 编辑时必须把「自己及自己的子孙」从候选项里剔除，
 * 否则用户能选出一个环（服务端也会拦，但这里先挡一道，避免无谓的报错）。
 */
const parentOptions = computed<CategoryTreeNode[]>(() => {
  if (dialogType.value !== "edit" || editingId.value === null) {
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
 * 打开弹窗
 * @param type add / edit
 * @param row  add 时为父分类（可为 null 表示根级）；edit 时为被编辑的分类
 */
const openDialog = (type: DialogType, row: CategoryTreeNode | null): void => {
  dialogType.value = type;
  editingId.value = type === "edit" && row ? row.id : null;

  form.name = type === "edit" && row ? row.name : "";
  // 从「新增子分类」按钮进入时，父级预填为当前行
  form.parent_id = type === "edit" && row ? row.parent_id : (row?.id ?? null);
  form.sort = type === "edit" && row ? row.sort : 0;

  dialogVisible.value = true;
};

const handleClose = (): void => {
  dialogVisible.value = false;
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

    if (dialogType.value === "edit" && editingId.value !== null) {
      await categoryService.updateCategory(editingId.value, payload);
      ElMessage.success("分类更新成功");
    } else {
      await categoryService.createCategory(payload);
      ElMessage.success("分类新增成功");
    }

    handleClose();
    await fetchTree();
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
  } catch (error) {
    // 服务端会说明原因（有子分类 / 仍被引用），直接透出
    ElMessage.error(error instanceof Error ? error.message : "删除失败");
  }
};

onMounted(() => {
  void fetchTree();
});
</script>

<style scoped>
.header-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
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
</style>
