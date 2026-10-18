<!-- src/views/login/index.vue -->
<template>
  <div class="login-page">
    <el-card class="login-card" shadow="always">
      <template #header>
        <h2 class="login-title">后台管理登录</h2>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="0" @keyup.enter="handleSubmit">
        <el-form-item prop="account">
          <el-input v-model="form.account" placeholder="手机号 / 用户名" :prefix-icon="User" clearable autocomplete="username" />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" class="login-button" :loading="submitting" @click="handleSubmit">登 录</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import { Lock, User } from "@element-plus/icons-vue";
import { useAuth } from "@/composables/useAuth";
import type { LoginParams } from "@/types/api";

interface LoginForm {
  /** 手机号或用户名：由输入内容自动判断 */
  account: string;
  password: string;
}

/** 手机号形态：11 位、1 开头、第二位 3-9 */
const PHONE_PATTERN = /^1[3-9]\d{9}$/;

const { login, devAutoLogin, submitting } = useAuth();

const formRef = ref<FormInstance>();
const form = reactive<LoginForm>({ account: "", password: "" });

const rules: FormRules<LoginForm> = {
  account: [
    { required: true, message: "请输入手机号或用户名", trigger: "blur" },
    {
      validator: (_rule, value: string, callback) => {
        const account = value.trim();
        if (!account) {
          callback(new Error("请输入手机号或用户名"));
          return;
        }
        if (/^\d+$/.test(account) && !PHONE_PATTERN.test(account)) {
          callback(new Error("手机号格式不正确"));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
};

/** 按输入内容组装登录参数 */
const buildLoginParams = (account: string, password: string): LoginParams => {
  const value = account.trim();
  return {
    ...(PHONE_PATTERN.test(value) ? { phone: value } : { username: value }),
    password,
  };
};

/** 提交登录：校验通过后交由 useAuth 编排，失败时透出服务端文案 */
const handleSubmit = async (): Promise<void> => {
  if (!formRef.value) {
    return;
  }

  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }

  try {
    await login(buildLoginParams(form.account, form.password));
  } catch (error) {
    // ApiError 的 message 即服务端返回的提示（如「无效的用户名或密码」）
    ElMessage.error(error instanceof Error ? error.message : "登录失败，请稍后重试");
  }
};

// ===== 本地 .env 自动登录（仅开发模式） =====
const DEV_PHONE = import.meta.env.VITE_DEV_AUTO_LOGIN_PHONE?.trim() ?? "";
const DEV_USERNAME = import.meta.env.VITE_DEV_AUTO_LOGIN_USERNAME?.trim() ?? "";
const DEV_PASSWORD = import.meta.env.VITE_DEV_AUTO_LOGIN_PASSWORD ?? "";

/**
 * 打开登录页时自动登录
 *
 * - 优先使用前端 .env 的 `VITE_DEV_AUTO_LOGIN_PHONE` / `USERNAME` + `PASSWORD`；
 *   两者都为空时退回到 server/.env 的 `DEV_LOGIN_*`；
 * - 只在 `import.meta.env.DEV` 生效，生产构建不会走这段；
 * - 退出登录时会写入 `__dev_skip_auto_login`，避免被立刻登录回去；
 * - 自动登录失败时保留表单，允许手动输入。
 */
const tryDevAutoLogin = async (): Promise<void> => {
  const enabled =
    import.meta.env.VITE_DEV_AUTO_LOGIN === "true" || (!!DEV_PASSWORD && (!!DEV_PHONE || !!DEV_USERNAME));
  if (!import.meta.env.DEV || !enabled) {
    return;
  }
  if (sessionStorage.getItem("__dev_skip_auto_login") === "1") {
    return;
  }

  const params =
    DEV_PASSWORD && DEV_PHONE
      ? { phone: DEV_PHONE, password: DEV_PASSWORD }
      : DEV_PASSWORD && DEV_USERNAME
        ? { username: DEV_USERNAME, password: DEV_PASSWORD }
        : undefined;

  try {
    await devAutoLogin(params);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "本地 .env 自动登录失败");
  }
};

onMounted(() => {
  void tryDevAutoLogin();
});
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  padding: 16px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #f5f7fa 0%, #dfe6f0 100%);
}

.login-card {
  width: 100%;
  max-width: 360px;
}

.login-title {
  margin: 0;
  font-size: 1.25rem;
  text-align: center;
}

.login-button {
  width: 100%;
}
</style>
