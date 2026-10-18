<!-- src/views/users/index.vue -->
<template>
  <el-main>
    <!-- 顶部操作栏：搜索 + 筛选 + 新增 -->
    <div class="header-actions">
      <el-input
        v-model="keyword"
        class="keyword-input"
        placeholder="搜索用户名 / 手机号"
        clearable
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-select v-model="roleId" class="filter-select" placeholder="全部角色" clearable @change="handleSearch">
        <el-option v-for="role in roles" :key="role.id" :label="role.name" :value="role.id" />
      </el-select>
      <el-select v-model="status" class="filter-select" placeholder="全部状态" clearable @change="handleSearch">
        <el-option label="启用" :value="1" />
        <el-option label="禁用" :value="0" />
      </el-select>
      <el-button type="primary" size="small" @click="handleSearch">搜索</el-button>
      <el-button type="primary" size="small" @click="openCreate">新增用户</el-button>
    </div>

    <el-table v-loading="loading" :data="users" row-key="id" stripe border style="width: 100%">
      <el-table-column label="操作" width="210" align="center" fixed="left">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="openPasswordDialog(row)">重置密码</el-button>
            <el-button link type="danger" size="small" :disabled="row.id === currentUserId" @click="removeUser(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="头像" width="78" align="center">
        <template #default="{ row }">
          <el-avatar :size="34" :src="row.avatar ? resolveAssetUrl(row.avatar) : undefined">
            {{ row.username.charAt(0).toUpperCase() }}
          </el-avatar>
        </template>
      </el-table-column>
      <el-table-column prop="id" label="ID" width="70" align="center" />
      <el-table-column prop="username" label="用户名" min-width="140" show-overflow-tooltip />
      <el-table-column prop="phone" label="手机号" width="150">
        <template #default="{ row }">{{ row.phone || "—" }}</template>
      </el-table-column>
      <el-table-column label="角色" width="130">
        <template #default="{ row }">
          <el-tag :type="row.role_code === 'admin' ? 'danger' : 'info'" size="small">{{ row.role_name || `#${row.role_id}` }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="会员到期" width="172">
        <template #default="{ row }">
          <span :class="{ 'empty-cell': !row.membership_expires_at }">
            {{ row.membership_expires_at ? formatDateTime(row.membership_expires_at) : "—" }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === 1"
            :loading="statusSavingId === row.id"
            :disabled="row.id === currentUserId"
            @change="handleSwitchChange(row, $event)"
          />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="172">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      class="pagination"
      background
      layout="total, sizes, prev, pager, next"
      :page-sizes="[10, 20, 50]"
      :total="total"
      @current-change="fetchUsers"
      @size-change="handleSearch"
    />

    <p class="table-hint">⚠️ 不能禁用或删除当前登录的账号；最后一名启用状态的管理员也不能被禁用、降级或删除。</p>
  </el-main>

  <!-- 新增 / 编辑 -->
  <el-dialog v-model="dialogVisible" :title="dialogType === 'create' ? '新增用户' : '编辑用户'" width="520px" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="86px">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="form.username" placeholder="2-32 位，中英文 / 数字 / 下划线 / 连字符" />
      </el-form-item>
      <el-form-item label="手机号" prop="phone">
        <el-input v-model="form.phone" placeholder="11 位大陆手机号（client 登录标识）" />
      </el-form-item>
      <el-form-item v-if="dialogType === 'create'" label="密码" prop="password">
        <el-input v-model="form.password" type="password" show-password placeholder="6-72 个字符" autocomplete="new-password" />
      </el-form-item>
      <el-form-item label="角色" prop="role_id">
        <el-select
          v-model="form.role_id"
          placeholder="请选择角色"
          style="width: 100%"
          :disabled="dialogType === 'edit' && editingId === currentUserId"
          @change="handleRoleChange"
        >
          <el-option v-for="role in roles" :key="role.id" :label="role.name" :value="role.id" />
        </el-select>
        <span v-if="dialogType === 'edit' && editingId === currentUserId" class="form-hint">不能修改当前登录账号的角色</span>
      </el-form-item>
      <el-form-item v-if="isMemberRole" label="会员到期">
        <el-date-picker
          v-model="form.membership_expires_at"
          type="datetime"
          placeholder="选择会员到期时间"
          style="width: 100%"
        />
        <span class="form-hint">默认一年后；到期后自动降级为普通用户</span>
      </el-form-item>
      <el-form-item label="状态">
        <el-switch v-model="form.enabled" active-text="启用" inactive-text="禁用" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
    </template>
  </el-dialog>

  <!-- 重置密码 -->
  <el-dialog v-model="passwordDialogVisible" title="重置密码" width="440px" destroy-on-close>
    <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="86px">
      <el-form-item label="账号">
        <span>{{ passwordTarget?.username }}</span>
      </el-form-item>
      <el-form-item label="新密码" prop="password">
        <el-input v-model="passwordForm.password" type="password" show-password placeholder="6-72 个字符" autocomplete="new-password" />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirm">
        <el-input v-model="passwordForm.confirm" type="password" show-password placeholder="再次输入新密码" autocomplete="new-password" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="passwordDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="passwordSaving" @click="submitPassword">确认重置</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import roleService from "@/api/roleService";
import userService from "@/api/userService";
import { useAuth } from "@/composables/useAuth";
import { resolveAssetUrl } from "@/services/apiConfig";
import { useAuthStore } from "@/store/auth";
import type { Role, User, UserStatus } from "@/types/api";

type DialogType = "create" | "edit";

interface UserForm {
  username: string;
  phone: string;
  password: string;
  role_id: number | null;
  /** 仅会员角色使用 */
  membership_expires_at: Date | null;
  enabled: boolean;
}

const { loadUser } = useAuth();
const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id ?? -1);

const users = ref<User[]>([]);
const roles = ref<Role[]>([]);
const loading = ref(false);
const saving = ref(false);
const statusSavingId = ref<number | null>(null);

const keyword = ref("");
const roleId = ref<number | null>(null);
const status = ref<UserStatus | null>(null);

const page = ref(1);
const pageSize = ref(10);
const total = ref(0);

const dialogVisible = ref(false);
const dialogType = ref<DialogType>("create");
const editingId = ref<number | null>(null);
const formRef = ref<FormInstance>();
const form = reactive<UserForm>({
  username: "",
  phone: "",
  password: "",
  role_id: null,
  membership_expires_at: null,
  enabled: true,
});

const passwordDialogVisible = ref(false);
const passwordSaving = ref(false);
const passwordTarget = ref<User | null>(null);
const passwordFormRef = ref<FormInstance>();
const passwordForm = reactive({ password: "", confirm: "" });

const formRules = computed<FormRules<UserForm>>(() => {
  const rules: FormRules<UserForm> = {
    username: [
      { required: true, message: "请输入用户名", trigger: "blur" },
      { min: 2, max: 32, message: "用户名需为 2-32 个字符", trigger: "blur" },
    ],
    phone: [{ pattern: /^1[3-9]\d{9}$/, message: "手机号格式不正确", trigger: "blur" }],
    role_id: [{ required: true, message: "请选择角色", trigger: "change" }],
  };

  // 只有新增时才需要密码；编辑时密码走「重置密码」独立入口
  if (dialogType.value === "create") {
    rules.password = [
      { required: true, message: "请输入密码", trigger: "blur" },
      { min: 6, max: 72, message: "密码需为 6-72 个字符", trigger: "blur" },
    ];
  }

  return rules;
});

const passwordRules: FormRules<{ password: string; confirm: string }> = {
  password: [
    { required: true, message: "请输入新密码", trigger: "blur" },
    { min: 6, max: 72, message: "密码需为 6-72 个字符", trigger: "blur" },
  ],
  confirm: [
    { required: true, message: "请再次输入新密码", trigger: "blur" },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== passwordForm.password) {
          callback(new Error("两次输入的密码不一致"));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
};

/** 时间显示：去掉 ISO 的 T / 毫秒与 Z，避免表格里出现一串机器格式 */
const formatDateTime = (value: string): string => value.replace("T", " ").slice(0, 19);

/** 当前选择的角色是否为会员 */
const isMemberRole = computed(() => roles.value.find((role) => role.id === form.role_id)?.code === "member");

/** 默认会员到期时间：一年后 */
const defaultMembershipExpiry = (): Date => {
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  return expiresAt;
};

/** 角色切换：切到会员时给默认一年；切走时清空时效 */
const handleRoleChange = (): void => {
  if (isMemberRole.value) {
    form.membership_expires_at ??= defaultMembershipExpiry();
  } else {
    form.membership_expires_at = null;
  }
};

const fetchUsers = async (): Promise<void> => {
  loading.value = true;
  try {
    const res = await userService.getUsers({
      keyword: keyword.value.trim() || undefined,
      role_id: roleId.value ?? undefined,
      status: status.value ?? undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    users.value = res.data;
    total.value = res.total ?? res.data.length;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "获取用户列表失败");
  } finally {
    loading.value = false;
  }
};

/** 角色列表是用户页的参考数据；失败时降级为空，不阻断用户列表 */
const fetchRoles = async (): Promise<void> => {
  try {
    const res = await roleService.getRoles();
    roles.value = res.data;
  } catch {
    roles.value = [];
  }
};

const handleSearch = (): void => {
  page.value = 1;
  void fetchUsers();
};

const openCreate = (): void => {
  dialogType.value = "create";
  editingId.value = null;
  Object.assign(form, {
    username: "",
    phone: "",
    password: "",
    role_id: roles.value.find((role) => role.code === "user")?.id ?? roles.value[0]?.id ?? null,
    membership_expires_at: null,
    enabled: true,
  });
  handleRoleChange();
  dialogVisible.value = true;
};

const openEdit = (row: User): void => {
  dialogType.value = "edit";
  editingId.value = row.id;
  Object.assign(form, {
    username: row.username,
    phone: row.phone ?? "",
    password: "",
    role_id: row.role_id,
    membership_expires_at: row.membership_expires_at ? new Date(row.membership_expires_at) : null,
    enabled: row.status === 1,
  });
  // 历史会员可能没有到期时间，补一个默认一年
  handleRoleChange();
  dialogVisible.value = true;
};

/** 提交新增 / 编辑；编辑后若改的是自己，顺带刷新登录态里的展示信息 */
const submitForm = async (): Promise<void> => {
  if (!formRef.value) {
    return;
  }
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid || form.role_id === null) {
    return;
  }

  const membershipExpiresAt = isMemberRole.value
    ? (form.membership_expires_at ?? defaultMembershipExpiry()).toISOString()
    : null;

  saving.value = true;
  try {
    if (dialogType.value === "create") {
      await userService.createUser({
        username: form.username.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role_id: form.role_id,
        membership_expires_at: membershipExpiresAt,
        status: form.enabled ? 1 : 0,
      });
      ElMessage.success("用户创建成功");
    } else if (editingId.value !== null) {
      await userService.updateUser(editingId.value, {
        username: form.username.trim(),
        // 空串表示清空手机号（服务端会归一化为 null）
        phone: form.phone.trim(),
        role_id: form.role_id,
        membership_expires_at: membershipExpiresAt,
        status: form.enabled ? 1 : 0,
      });
      ElMessage.success("用户更新成功");
      if (editingId.value === currentUserId.value) {
        await loadUser();
      }
    }

    dialogVisible.value = false;
    await fetchUsers();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    saving.value = false;
  }
};

/** el-switch 的 change 载荷类型较宽，这里收窄后转交业务处理 */
const handleSwitchChange = (row: User, value: string | number | boolean): void => {
  void handleStatusChange(row, value);
};

/** 启用 / 禁用；失败时重新拉取列表，把开关恢复成服务端的真实状态 */
const handleStatusChange = async (row: User, value: string | number | boolean): Promise<void> => {
  const nextStatus: UserStatus = value ? 1 : 0;
  statusSavingId.value = row.id;
  try {
    await userService.updateUser(row.id, { status: nextStatus });
    ElMessage.success(nextStatus === 1 ? "账号已启用" : "账号已禁用");
    await fetchUsers();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "状态更新失败");
    await fetchUsers();
  } finally {
    statusSavingId.value = null;
  }
};

const openPasswordDialog = (row: User): void => {
  passwordTarget.value = row;
  passwordForm.password = "";
  passwordForm.confirm = "";
  passwordDialogVisible.value = true;
};

const submitPassword = async (): Promise<void> => {
  if (!passwordFormRef.value || !passwordTarget.value) {
    return;
  }
  const valid = await passwordFormRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }

  passwordSaving.value = true;
  try {
    await userService.resetPassword(passwordTarget.value.id, { password: passwordForm.password });
    ElMessage.success("密码已重置");
    passwordDialogVisible.value = false;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "重置密码失败");
  } finally {
    passwordSaving.value = false;
  }
};

const removeUser = async (row: User): Promise<void> => {
  try {
    await ElMessageBox.confirm(`确定删除用户「${row.username}」吗？该操作不可恢复。`, "删除用户", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }

  try {
    await userService.deleteUser(row.id);
    ElMessage.success("用户已删除");
    // 删掉当前页最后一条时回退一页，避免停在空白页
    if (users.value.length === 1 && page.value > 1) {
      page.value -= 1;
    }
    await fetchUsers();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "删除失败");
  }
};

onMounted(async () => {
  await Promise.all([fetchUsers(), fetchRoles()]);
});
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

.filter-select {
  width: 150px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.form-hint {
  margin-left: 8px;
  color: var(--el-text-color-placeholder);
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
  flex-wrap: wrap;
  gap: 2px;
}
</style>
