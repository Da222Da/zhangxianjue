<!-- src/views/Auth/ForgotPassword.vue -->
<template>
  <AuthShell title="找回密码" subtitle="输入注册手机号并完成图形验证码，即可设置新密码。">
    <div class="forgot-form">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="handleSubmit">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" :prefix-icon="Iphone" placeholder="11 位手机号" autocomplete="tel" clearable />
        </el-form-item>

        <el-form-item label="新密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            :prefix-icon="Lock"
            placeholder="6-72 个字符"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-form-item label="确认新密码" prop="confirm">
          <el-input
            v-model="form.confirm"
            type="password"
            :prefix-icon="Lock"
            placeholder="再次输入新密码"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-form-item label="图形验证码" prop="captchaCode">
          <CaptchaField v-model="form.captchaCode" :image="image" :loading="loading" @refresh="refresh" />
        </el-form-item>

        <el-button class="auth-submit" type="primary" :loading="submitting" @click="handleSubmit">重置密码</el-button>
      </el-form>

      <p class="security-hint">⚠️ 当前仅通过图形验证码校验身份，请勿使用重要密码。</p>
    </div>

    <template #footer>
      想起密码了？
      <router-link :to="loginRoute">返回登录</router-link>
    </template>
  </AuthShell>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import { Iphone, Lock } from "@element-plus/icons-vue";
import AuthShell from "@/components/AuthShell.vue";
import CaptchaField from "@/components/CaptchaField.vue";
import { useAuth } from "@/composables/useAuth";
import { useCaptcha } from "@/composables/useCaptcha";

interface ForgotForm {
  phone: string;
  password: string;
  confirm: string;
  captchaCode: string;
}

const route = useRoute();
const router = useRouter();
const { forgotPassword, submitting } = useAuth();
const { captchaId, image, loading, refresh } = useCaptcha();

const formRef = ref<FormInstance>();
const form = reactive<ForgotForm>({ phone: "", password: "", confirm: "", captchaCode: "" });

const rules: FormRules<ForgotForm> = {
  phone: [
    { required: true, message: "请输入手机号", trigger: "blur" },
    { pattern: /^1[3-9]\d{9}$/, message: "手机号格式不正确", trigger: "blur" },
  ],
  password: [
    { required: true, message: "请输入新密码", trigger: "blur" },
    { min: 6, max: 72, message: "密码需为 6-72 个字符", trigger: "blur" },
  ],
  confirm: [
    { required: true, message: "请再次输入新密码", trigger: "blur" },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== form.password) {
          callback(new Error("两次输入的密码不一致"));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
  captchaCode: [{ required: true, message: "请输入图形验证码", trigger: "blur" }],
};

const loginRoute = computed(() => ({
  name: "Login",
  query: {
    ...(route.query.redirect ? { redirect: route.query.redirect } : {}),
    ...(typeof route.query.phone === "string" ? { phone: route.query.phone } : {}),
  },
}));

const handleSubmit = async (): Promise<void> => {
  if (!formRef.value) {
    return;
  }

  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }

  try {
    await forgotPassword({
      phone: form.phone.trim(),
      password: form.password,
      captchaId: captchaId.value,
      captchaCode: form.captchaCode.trim(),
    });
    ElMessage.success("密码已重置，请使用新密码登录");
    await router.replace({
      name: "Login",
      query: {
        ...(route.query.redirect ? { redirect: route.query.redirect } : {}),
        phone: form.phone.trim(),
      },
    });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "重置失败，请稍后重试");
    form.captchaCode = "";
    await refresh();
  }
};

// 从登录页跳过来时带上手机号
const phoneFromQuery = route.query.phone;
if (typeof phoneFromQuery === "string") {
  form.phone = phoneFromQuery;
}
</script>

<style scoped>
.forgot-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.security-hint {
  margin: 4px 0 0;
  color: var(--orange);
  font-size: 12px;
  line-height: 1.6;
}
</style>
