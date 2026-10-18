<!-- src/views/Account/index.vue -->
<template>
  <div class="account-page">
    <header class="page-header">
      <p class="page-eyebrow"><span class="page-square" aria-hidden="true"></span>ACCOUNT / 个人中心</p>
      <!-- ⚠️ sketch-underline 是 inline-block：必须包在 h1 里，否则会和上方的 inline-flex 标签排成一行 -->
      <h1 class="page-title"><span class="sketch-underline">我的账号</span></h1>
      <p class="page-subtitle">管理密码、会员身份与阅读权限。</p>
    </header>

    <el-alert
      v-if="upgradeHint"
      class="upgrade-alert"
      type="warning"
      show-icon
      :closable="false"
      title="VIP 内容仅对会员和朋友开放"
      description="提交会员申请后，由管理员审核通过即可阅读全部书籍与笔记正文。"
    />

    <div class="account-grid">
      <!-- 账号信息 -->
      <section class="account-card sketch-box">
        <h2 class="card-title">账号信息</h2>

        <div class="profile">
          <el-avatar :size="54" :src="avatarUrl" class="profile-avatar">{{ authStore.initial }}</el-avatar>
          <div class="profile-meta">
            <strong class="profile-name">{{ authStore.displayName || "—" }}</strong>
            <el-tag size="small" :type="roleTagType">{{ authStore.user?.role_name || "加载中" }}</el-tag>
          </div>
        </div>

        <dl class="info-list">
          <div class="info-row">
            <dt>手机号</dt>
            <dd>{{ authStore.user?.phone || "未绑定" }}</dd>
          </div>
          <div v-if="authStore.user?.membership_expires_at" class="info-row">
            <dt>会员到期</dt>
            <dd>{{ formatDate(authStore.user.membership_expires_at) }}</dd>
          </div>
          <div class="info-row">
            <dt>注册时间</dt>
            <dd>{{ formatDate(authStore.user?.createdAt) }}</dd>
          </div>
        </dl>
      </section>

      <!-- 会员 / 书库 -->
      <section class="account-card sketch-box" :class="{ 'is-highlight': upgradeHint }">
        <h2 class="card-title">会员与阅读权益</h2>

        <template v-if="isMember">
          <p class="member-state">你已是会员，可阅读书库与攻略笔记中的全部 VIP 内容。</p>
          <p v-if="authStore.user?.membership_expires_at" class="member-time">
            有效期至：{{ formatDate(authStore.user.membership_expires_at) }}
          </p>
          <router-link class="action-button is-primary" to="/library">进入书库 →</router-link>
        </template>

        <template v-else-if="isFriend">
          <p class="member-state">你是朋友账号，可阅读书库与攻略笔记中的全部 VIP 内容。</p>
          <router-link class="action-button is-primary" to="/library">进入书库 →</router-link>
        </template>

        <template v-else-if="isAdmin">
          <p class="member-state">管理员账号无需申请会员，可直接阅读全部内容。</p>
          <router-link class="action-button is-primary" to="/library">进入书库 →</router-link>
        </template>

        <template v-else-if="status === 'pending'">
          <p class="member-state">会员申请已提交，正在等待管理员审核。</p>
          <p v-if="appliedAt" class="member-time">申请时间：{{ formatDate(appliedAt) }}</p>
          <button type="button" class="action-button" :disabled="loading" @click="refreshAll">刷新状态</button>
        </template>

        <template v-else>
          <p class="member-state">
            <template v-if="status === 'rejected'">上次申请未通过，可以重新提交。</template>
            <template v-else>升级为会员后，即可解锁书库与攻略笔记中的全部 VIP 内容。</template>
          </p>
          <button type="button" class="action-button is-primary" :disabled="applying" @click="handleApply">
            {{ applying ? "提交中…" : "申请升级为会员" }}
          </button>
          <p class="member-note">申请由管理员人工审核，通常会在看到后尽快处理。</p>
        </template>
      </section>

      <!-- 修改密码 -->
      <section class="account-card sketch-box change-password-card">
        <h2 class="card-title">修改密码</h2>

        <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-position="top" @keyup.enter="handleChangePassword">
          <el-form-item label="旧密码" prop="oldPassword">
            <el-input v-model="passwordForm.oldPassword" type="password" show-password autocomplete="current-password" placeholder="请输入当前密码" />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input v-model="passwordForm.newPassword" type="password" show-password autocomplete="new-password" placeholder="6-72 个字符" />
          </el-form-item>
          <el-form-item label="确认新密码" prop="confirm">
            <el-input v-model="passwordForm.confirm" type="password" show-password autocomplete="new-password" placeholder="再次输入新密码" />
          </el-form-item>
          <el-button class="action-button is-primary" :loading="submitting" @click="handleChangePassword">保存新密码</el-button>
        </el-form>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import { useAuth } from "@/composables/useAuth";
import { useMembership } from "@/composables/useMembership";
import { resolveAssetUrl } from "@/services/apiConfig";
import { formatDate } from "@/util/index.ts";

interface PasswordForm {
  oldPassword: string;
  newPassword: string;
  confirm: string;
}

const route = useRoute();
const { authStore, submitting, changePassword, loadUser } = useAuth();
const { status, appliedAt, loading, applying, loadStatus, apply } = useMembership();

const passwordFormRef = ref<FormInstance>();
const passwordForm = reactive<PasswordForm>({ oldPassword: "", newPassword: "", confirm: "" });

/** 从 VIP 内容被拦截过来时高亮会员卡 */
const upgradeHint = computed(() => route.query.upgrade === "1");
const isMember = computed(() => authStore.user?.role_code === "member");
/** 朋友与会员一样具备 library:view，无需再申请会员 */
const isFriend = computed(() => authStore.user?.role_code === "friend");
const isAdmin = computed(() => authStore.user?.role_code === "admin");
const avatarUrl = computed(() => (authStore.user?.avatar ? resolveAssetUrl(authStore.user.avatar) : undefined));

const roleTagType = computed<"success" | "warning" | "info">(() => {
  if (isMember.value) return "success";
  if (authStore.user?.role_code === "friend") return "warning";
  return "info";
});

const passwordRules: FormRules<PasswordForm> = {
  oldPassword: [{ required: true, message: "请输入旧密码", trigger: "blur" }],
  newPassword: [
    { required: true, message: "请输入新密码", trigger: "blur" },
    { min: 6, max: 72, message: "密码需为 6-72 个字符", trigger: "blur" },
  ],
  confirm: [
    { required: true, message: "请再次输入新密码", trigger: "blur" },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error("两次输入的密码不一致"));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
};

const handleChangePassword = async (): Promise<void> => {
  if (!passwordFormRef.value) {
    return;
  }

  const valid = await passwordFormRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }

  try {
    await changePassword({ oldPassword: passwordForm.oldPassword, newPassword: passwordForm.newPassword });
    ElMessage.success("密码修改成功");
    passwordForm.oldPassword = "";
    passwordForm.newPassword = "";
    passwordForm.confirm = "";
    passwordFormRef.value.clearValidate();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "密码修改失败");
  }
};

const handleApply = async (): Promise<void> => {
  try {
    await apply();
    ElMessage.success("申请已提交，等待管理员审核");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "申请提交失败");
  }
};

/** 刷新用户信息与申请状态：管理员通过后角色会变，需要重新拉取 */
const refreshAll = async (): Promise<void> => {
  await Promise.all([loadUser(), loadStatus()]);
};

onMounted(refreshAll);
</script>

<style scoped>
.account-page {
  padding: 8px 0 40px;
}

.page-header {
  margin-bottom: 22px;
}

.page-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  color: var(--brand-accent);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.page-square {
  width: 7px;
  height: 7px;
  background: var(--orange);
  transform: rotate(-4deg);
}

.page-title {
  margin: 0 0 8px;
  color: var(--text-h);
  font-size: 2rem;
  line-height: 1.3;
}

.page-subtitle {
  margin: 14px 0 0;
  color: var(--text);
  font-size: 14px;
}

.upgrade-alert {
  margin-bottom: 16px;
}

.account-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
  align-items: start;
}

.account-card {
  padding: 20px 22px;
  background: var(--surface);
}

.account-card.is-highlight {
  border-color: var(--orange);
  box-shadow: 4px 4px 0 var(--orange-soft);
}

.card-title {
  margin: 0 0 16px;
  color: var(--text-h);
  font-size: 17px;
}

.profile {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.profile-avatar {
  border: var(--sketch-line) solid var(--ink);
  background: var(--accent-bg);
  color: var(--ink);
  font-weight: 600;
}

.profile-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-name {
  color: var(--text-h);
  font-size: 17px;
}

.info-list {
  margin: 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-top: 1.5px dashed var(--border);
  font-size: 14px;
}

.info-row dt {
  color: var(--text);
}

.info-row dd {
  margin: 0;
  color: var(--text-h);
}

.member-state {
  margin: 0 0 14px;
  color: var(--text);
  font-size: 14px;
  line-height: 1.7;
}

.member-time {
  margin: 0 0 12px;
  color: var(--text);
  font-size: 12px;
  opacity: 0.8;
}

.member-note {
  margin: 10px 0 0;
  color: var(--text);
  font-size: 12px;
  opacity: 0.75;
}

.action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 18px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  background: var(--surface);
  color: var(--text-h);
  font: inherit;
  font-size: 14px;
  text-decoration: none;
  box-shadow: 2px 2px 0 var(--sketch-shadow);
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.action-button:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--sketch-shadow);
}

.action-button.is-primary {
  background: var(--accent-bg);
  font-weight: 600;
}

.action-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.change-password-card :deep(.el-input__wrapper) {
  border-radius: var(--sketch-radius-sm);
  background: var(--surface);
  box-shadow: 0 0 0 1.4px var(--ink) inset;
}

.change-password-card :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1.6px var(--brand-accent) inset;
}

.change-password-card :deep(.el-form-item__label) {
  padding-bottom: 4px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 640px) {
  .account-grid {
    grid-template-columns: 1fr;
  }

  .page-title {
    font-size: 1.6rem;
  }
}
</style>
