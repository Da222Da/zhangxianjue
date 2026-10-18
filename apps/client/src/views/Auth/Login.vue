<!-- src/views/Auth/Login.vue -->
<template>
  <AuthShell title="欢迎回来" subtitle="登录后，页头会显示你的头像与昵称。">
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="handleSubmit">
      <el-form-item label="手机号 / 用户名" prop="account">
        <el-input v-model="form.account" :prefix-icon="User" placeholder="请输入手机号或用户名" autocomplete="username" clearable />
      </el-form-item>

      <el-form-item label="密码" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          :prefix-icon="Lock"
          placeholder="请输入密码"
          show-password
          autocomplete="current-password"
        />
      </el-form-item>

      <el-form-item label="图形验证码" prop="captchaCode">
        <CaptchaField v-model="form.captchaCode" :image="image" :loading="loading" @refresh="refresh" />
      </el-form-item>

      <el-button class="auth-submit" type="primary" :loading="submitting" @click="handleSubmit">登 录</el-button>
    </el-form>

    <template #footer>
      <div class="auth-links">
        <router-link :to="forgotRoute">忘记密码？</router-link>
        <span class="auth-links__sep">·</span>
        <span>还没有账号？</span>
        <router-link :to="registerRoute">立即注册</router-link>
      </div>
    </template>
  </AuthShell>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import { Lock, User } from "@element-plus/icons-vue";
import AuthShell from "@/components/AuthShell.vue";
import CaptchaField from "@/components/CaptchaField.vue";
import { useAuth } from "@/composables/useAuth";
import { useCaptcha } from "@/composables/useCaptcha";

interface LoginForm {
  /** 手机号或用户名：由输入内容自动判断 */
  account: string;
  password: string;
  captchaCode: string;
}

/** 手机号形态：11 位、1 开头、第二位 3-9 */
const PHONE_PATTERN = /^1[3-9]\d{9}$/;

const route = useRoute();
const { login, devLogin, submitting } = useAuth();
const { captchaId, image, loading, refresh } = useCaptcha();

const formRef = ref<FormInstance>();
const form = reactive<LoginForm>({ account: "", password: "", captchaCode: "" });

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
        // 纯数字但不是合法手机号：明确提示，避免被当成用户名去登录
        if (/^\d+$/.test(account) && !PHONE_PATTERN.test(account)) {
          callback(new Error("手机号格式不正确"));
          return;
        }
        if (account.length > 32) {
          callback(new Error("用户名长度不能超过 32 个字符"));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
  captchaCode: [{ required: true, message: "请输入图形验证码", trigger: "blur" }],
};

/** 切页时保留 ?redirect=，登录成功后回到来源页 */
const registerRoute = computed(() => ({
  name: "Register",
  query: route.query.redirect ? { redirect: route.query.redirect } : {},
}));
const forgotRoute = computed(() => {
  const account = form.account.trim();
  return {
    name: "ForgotPassword",
    query: {
      ...(route.query.redirect ? { redirect: route.query.redirect } : {}),
      // 找回密码只支持手机号：只有输入的是手机号时才带上
      ...(PHONE_PATTERN.test(account) ? { phone: account } : {}),
    },
  };
});

const handleSubmit = async (): Promise<void> => {
  if (!formRef.value) {
    return;
  }

  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }

  try {
    const account = form.account.trim();
    const credentials = PHONE_PATTERN.test(account) ? { phone: account } : { username: account };

    await login({
      ...credentials,
      password: form.password,
      captchaId: captchaId.value,
      captchaCode: form.captchaCode.trim(),
    });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "登录失败，请稍后重试");
    // 验证码是一次性的：失败后必须换一张
    form.captchaCode = "";
    await refresh();
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
 *   两者都为空时退回到 server/.env 的 `DEV_LOGIN_*`（请求体不传凭据）；
 * - 走 `/auth/dev/login`，跳过图形验证码；服务端只在 DEVELOPMENT +
 *   `DEV_LOGIN_ENABLED=true` 时挂载该路由，且只接受本机请求；
 * - 退出登录时写入 `__dev_skip_auto_login`，避免被立刻登录回去；
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
    await devLogin(params);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "本地 .env 自动登录失败");
  }
};

// 从找回密码页折返时带上手机号；随后尝试本地自动登录
onMounted(async () => {
  const phone = route.query.phone;
  if (typeof phone === "string") {
    form.account = phone;
  }

  await tryDevAutoLogin();
});
</script>

<style scoped>
.auth-links {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
}

.auth-links__sep {
  color: var(--border);
}
</style>
