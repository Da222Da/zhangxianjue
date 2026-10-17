<!-- src/views/login/index.vue -->
<template>
  <div class="login-page">
    <el-card class="login-card" shadow="always">
      <template #header>
        <h2 class="login-title">后台管理登录</h2>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="0" @keyup.enter="handleSubmit">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" clearable autocomplete="username" />
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
import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import { Lock, User } from "@element-plus/icons-vue";
import { useAuth } from "@/composables/useAuth";
import type { LoginParams } from "@/types/api";

const { login, submitting } = useAuth();

const formRef = ref<FormInstance>();
const form = reactive<LoginParams>({ username: "", password: "" });

const rules: FormRules<LoginParams> = {
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
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
    await login({ ...form });
  } catch (error) {
    // ApiError 的 message 即服务端返回的提示（如「无效的用户名或密码」）
    ElMessage.error(error instanceof Error ? error.message : "登录失败，请稍后重试");
  }
};
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #dfe6f0 100%);
}

.login-card {
  width: 360px;
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
