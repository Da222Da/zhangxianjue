<!-- src/views/Auth/Register.vue -->
<template>
  <AuthShell title="创建账号" subtitle="注册成功后自动登录。手机号用于登录，不会公开展示。">
    <div class="register-form">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="handleSubmit">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :prefix-icon="User" placeholder="2-32 位，中英文 / 数字 / 下划线" autocomplete="username" clearable />
        </el-form-item>

        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" :prefix-icon="Iphone" placeholder="11 位手机号" autocomplete="tel" clearable />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            :prefix-icon="Lock"
            placeholder="6-72 个字符"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirm">
          <el-input
            v-model="form.confirm"
            type="password"
            :prefix-icon="Lock"
            placeholder="再次输入密码"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-form-item label="图形验证码" prop="captchaCode">
          <CaptchaField v-model="form.captchaCode" :image="image" :loading="loading" @refresh="refresh" />
        </el-form-item>

        <el-button class="auth-submit" type="primary" :loading="submitting" @click="handleSubmit">注 册</el-button>
      </el-form>
    </div>

    <template #footer>
      已经有账号？
      <router-link :to="loginRoute">去登录</router-link>
    </template>
  </AuthShell>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import { Iphone, Lock, User } from "@element-plus/icons-vue";
import AuthShell from "@/components/AuthShell.vue";
import CaptchaField from "@/components/CaptchaField.vue";
import { useAuth } from "@/composables/useAuth";
import { useCaptcha } from "@/composables/useCaptcha";

interface RegisterForm {
  username: string;
  phone: string;
  password: string;
  confirm: string;
  captchaCode: string;
}

const route = useRoute();
const { register, submitting } = useAuth();
const { captchaId, image, loading, refresh } = useCaptcha();

const formRef = ref<FormInstance>();
const form = reactive<RegisterForm>({ username: "", phone: "", password: "", confirm: "", captchaCode: "" });

const rules: FormRules<RegisterForm> = {
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    { min: 2, max: 32, message: "用户名需为 2-32 个字符", trigger: "blur" },
    { pattern: /^[\w一-龥-]{2,32}$/u, message: "仅支持中英文、数字、下划线与连字符", trigger: "blur" },
  ],
  phone: [
    { required: true, message: "请输入手机号", trigger: "blur" },
    { pattern: /^1[3-9]\d{9}$/, message: "手机号格式不正确", trigger: "blur" },
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, max: 72, message: "密码需为 6-72 个字符", trigger: "blur" },
  ],
  confirm: [
    { required: true, message: "请再次输入密码", trigger: "blur" },
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

/** 切回登录页时保留 ?redirect= */
const loginRoute = computed(() => ({
  name: "Login",
  query: route.query.redirect ? { redirect: route.query.redirect } : {},
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
    await register({
      username: form.username.trim(),
      phone: form.phone.trim(),
      password: form.password,
      captchaId: captchaId.value,
      captchaCode: form.captchaCode.trim(),
    });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "注册失败，请稍后重试");
    // 验证码是一次性的：失败后必须换一张
    form.captchaCode = "";
    await refresh();
  }
};
</script>

<style scoped>
/* 注册表单字段较多，收紧间距，避免卡片过高 */
.register-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
</style>
