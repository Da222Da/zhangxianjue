<!-- src/views/permissions/index.vue -->
<template>
  <el-main v-loading="loading">
    <el-alert
      class="permission-alert"
      type="info"
      :closable="false"
      show-icon
      title="权限点由代码与数据库迁移定义，这里只负责把权限分配给角色。保存后立即生效，无需用户重新登录。"
    />

    <div class="permission-layout">
      <!-- 左：角色列表 -->
      <aside class="role-panel">
        <h3 class="panel-title">角色</h3>
        <button
          v-for="role in roles"
          :key="role.id"
          type="button"
          class="role-item"
          :class="{ 'is-active': role.id === currentRoleId }"
          @click="selectRole(role)"
        >
          <span class="role-name">{{ role.name }}</span>
          <el-tag size="small" type="info">{{ role.permission_ids.length }}</el-tag>
        </button>
        <p v-if="roles.length === 0" class="empty-hint">暂无角色</p>
      </aside>

      <!-- 右：权限勾选 -->
      <section class="permission-panel">
        <header class="panel-header">
          <div>
            <h3 class="panel-title">{{ currentRole ? `${currentRole.name}的权限` : "请选择角色" }}</h3>
            <p v-if="currentRole?.code === 'admin'" class="panel-hint">管理员角色必须保留「后台访问」权限，否则后台会失去入口。</p>
          </div>
          <div class="panel-actions">
            <el-button :disabled="!currentRole || saving" @click="resetSelection">重置</el-button>
            <el-button type="primary" :loading="saving" :disabled="!currentRole" @click="saveSelection">保存</el-button>
          </div>
        </header>

        <el-checkbox-group v-model="selectedIds" class="permission-groups">
          <div v-for="group in permissionGroups" :key="group.name" class="permission-group">
            <h4 class="group-title">{{ group.name }}</h4>
            <el-checkbox
              v-for="permission in group.items"
              :key="permission.id"
              :value="permission.id"
              :disabled="isLocked(permission)"
              class="permission-item"
            >
              <span class="permission-name">{{ permission.name }}</span>
              <code class="permission-code">{{ permission.code }}</code>
              <span class="permission-desc">{{ permission.description }}</span>
            </el-checkbox>
          </div>
        </el-checkbox-group>

        <p v-if="permissions.length === 0 && !loading" class="empty-hint">暂无权限点，请先执行数据库迁移。</p>
      </section>
    </div>
  </el-main>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import permissionService from "@/api/permissionService";
import roleService from "@/api/roleService";
import type { Permission, Role } from "@/types/api";

interface PermissionGroup {
  name: string;
  items: Permission[];
}

const loading = ref(false);
const saving = ref(false);
const roles = ref<Role[]>([]);
const permissions = ref<Permission[]>([]);
const currentRoleId = ref<number | null>(null);
const selectedIds = ref<number[]>([]);

const currentRole = computed(() => roles.value.find((role) => role.id === currentRoleId.value) ?? null);

/** 权限点按 group_name 分组，保持服务端返回顺序 */
const permissionGroups = computed<PermissionGroup[]>(() => {
  const groups = new Map<string, Permission[]>();
  for (const permission of permissions.value) {
    const list = groups.get(permission.group_name) ?? [];
    list.push(permission);
    groups.set(permission.group_name, list);
  }
  return [...groups.entries()].map(([name, items]) => ({ name, items }));
});

/** 管理员角色的「后台访问」是防锁死底线，不允许取消 */
const isLocked = (permission: Permission): boolean => currentRole.value?.code === "admin" && permission.code === "admin:access";

const selectRole = (role: Role): void => {
  currentRoleId.value = role.id;
  selectedIds.value = [...role.permission_ids];
};

const resetSelection = (): void => {
  if (currentRole.value) {
    selectedIds.value = [...currentRole.value.permission_ids];
  }
};

const fetchData = async (): Promise<void> => {
  loading.value = true;
  try {
    const [roleRes, permissionRes] = await Promise.all([roleService.getRoles(), permissionService.getPermissions()]);
    roles.value = roleRes.data;
    permissions.value = permissionRes.data;

    // 默认选中第一个角色；刷新后保留当前选择（若仍然存在）
    const target = roles.value.find((role) => role.id === currentRoleId.value) ?? roles.value[0] ?? null;
    if (target) {
      selectRole(target);
    } else {
      currentRoleId.value = null;
      selectedIds.value = [];
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "获取角色与权限失败");
  } finally {
    loading.value = false;
  }
};

const saveSelection = async (): Promise<void> => {
  if (!currentRole.value) {
    return;
  }

  saving.value = true;
  try {
    const updated = await roleService.setRolePermissions(currentRole.value.id, { permission_ids: selectedIds.value });
    // 用服务端返回的新角色替换本地项，保证权限数量等派生字段同步
    const index = roles.value.findIndex((role) => role.id === updated.id);
    if (index >= 0) {
      roles.value[index] = updated;
    }
    selectedIds.value = [...updated.permission_ids];
    ElMessage.success("权限已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存权限失败");
  } finally {
    saving.value = false;
  }
};

onMounted(fetchData);
</script>

<style scoped lang="scss">
.permission-alert {
  margin-bottom: 16px;
}

.permission-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.role-panel {
  flex: 0 0 220px;
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-bg-color);
}

.panel-title {
  margin: 0 0 12px;
  font-size: 15px;
}

.role-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 9px 10px;
  margin-bottom: 6px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-regular);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
}

.role-item:hover {
  background: var(--el-fill-color-light);
}

.role-item.is-active {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.role-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.permission-panel {
  flex: 1;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-bg-color);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.panel-hint {
  margin: 4px 0 0;
  color: var(--el-color-warning);
  font-size: 12px;
}

.panel-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.permission-groups {
  display: block;
}

.permission-group {
  padding: 12px 0;
  border-top: 1px dashed var(--el-border-color-light);
}

.group-title {
  margin: 0 0 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 600;
}

.permission-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: auto;
  margin: 0 0 10px;
  padding: 2px 0;
}

.permission-name {
  min-width: 84px;
  color: var(--el-text-color-primary);
}

.permission-code {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.permission-desc {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.empty-hint {
  margin: 12px 0 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

@media (max-width: 900px) {
  .permission-layout {
    flex-direction: column;
  }

  .role-panel {
    flex-basis: auto;
    width: 100%;
    box-sizing: border-box;
  }

  .permission-item {
    flex-wrap: wrap;
  }
}

@media (max-width: 600px) {
  .panel-header {
    flex-direction: column;
  }

  .panel-actions {
    width: 100%;
  }

  .panel-actions .el-button {
    flex: 1;
  }

  .permission-panel,
  .role-panel {
    padding: 12px;
  }

  .permission-desc {
    flex: 1 1 100%;
  }
}
</style>
