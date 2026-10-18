<!-- src/views/roles/index.vue -->
<template>
  <el-main>
    <div class="header-actions">
      <el-button type="primary" size="small" @click="openCreate">新增角色</el-button>
    </div>

    <el-table v-loading="loading" :data="roles" row-key="id" stripe border style="width: 100%">
      <el-table-column label="操作" width="150" align="center" fixed="left">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-tooltip :disabled="canDelete(row)" :content="deleteDisabledReason(row)" placement="top">
              <span>
                <el-button link type="danger" size="small" :disabled="!canDelete(row)" @click="removeRole(row)">删除</el-button>
              </span>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="id" label="ID" width="70" align="center" />
      <el-table-column prop="name" label="角色名" min-width="140" show-overflow-tooltip />
      <el-table-column label="编码" width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <code class="role-code">{{ row.code }}</code>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">{{ row.description || "—" }}</template>
      </el-table-column>
      <el-table-column label="成员数" width="90" align="center">
        <template #default="{ row }">{{ row.user_count }}</template>
      </el-table-column>
      <el-table-column label="权限" width="100" align="center">
        <template #default="{ row }">
          <el-tooltip :content="row.permission_codes.join('、') || '未分配权限'" placement="top">
            <el-tag size="small" type="info">{{ row.permission_ids.length }} 项</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.is_system" size="small" type="warning">内置</el-tag>
          <el-tag v-else size="small">自定义</el-tag>
        </template>
      </el-table-column>
    </el-table>

    <p class="table-hint">
      内置角色不能删除；仍有成员的角色需先把用户改到其它角色。角色权限在「权限管理」页勾选。
    </p>
  </el-main>

  <el-dialog v-model="dialogVisible" :title="dialogType === 'create' ? '新增角色' : '编辑角色'" width="480px" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="角色名" prop="name">
        <el-input v-model="form.name" placeholder="请输入角色名" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="可选，说明该角色的职责" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import roleService from "@/api/roleService";
import type { Role } from "@/types/api";

type DialogType = "create" | "edit";

const roles = ref<Role[]>([]);
const loading = ref(false);
const saving = ref(false);

const dialogVisible = ref(false);
const dialogType = ref<DialogType>("create");
const editingId = ref<number | null>(null);
const formRef = ref<FormInstance>();
const form = reactive({ name: "", description: "" });

const rules: FormRules<{ name: string }> = {
  name: [{ required: true, message: "请输入角色名", trigger: "blur" }],
};

const fetchRoles = async (): Promise<void> => {
  loading.value = true;
  try {
    const res = await roleService.getRoles();
    roles.value = res.data;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "获取角色列表失败");
  } finally {
    loading.value = false;
  }
};

/** 内置角色与仍有成员的角色不允许删除，提前在 UI 上禁用 */
const canDelete = (role: Role): boolean => !role.is_system && role.user_count === 0;

const deleteDisabledReason = (role: Role): string => {
  if (role.is_system) {
    return "系统内置角色不能删除";
  }
  if (role.user_count > 0) {
    return `该角色下还有 ${role.user_count} 个用户，请先调整他们的角色`;
  }
  return "";
};

const openCreate = (): void => {
  dialogType.value = "create";
  editingId.value = null;
  form.name = "";
  form.description = "";
  dialogVisible.value = true;
};

const openEdit = (role: Role): void => {
  dialogType.value = "edit";
  editingId.value = role.id;
  form.name = role.name;
  form.description = role.description ?? "";
  dialogVisible.value = true;
};

const submitForm = async (): Promise<void> => {
  if (!formRef.value) {
    return;
  }
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    if (dialogType.value === "create") {
      await roleService.createRole({ name: form.name.trim(), description: form.description.trim() || null });
      ElMessage.success("角色创建成功，可在「权限管理」中分配权限");
    } else if (editingId.value !== null) {
      await roleService.updateRole(editingId.value, { name: form.name.trim(), description: form.description.trim() || null });
      ElMessage.success("角色更新成功");
    }

    dialogVisible.value = false;
    await fetchRoles();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    saving.value = false;
  }
};

const removeRole = async (role: Role): Promise<void> => {
  try {
    await ElMessageBox.confirm(`确定删除角色「${role.name}」吗？`, "删除角色", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }

  try {
    await roleService.deleteRole(role.id);
    ElMessage.success("角色已删除");
    await fetchRoles();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "删除失败");
  }
};

onMounted(fetchRoles);
</script>

<style scoped lang="scss">
.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.role-code {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-size: 12px;
}

.table-hint {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 2px;
}
</style>
