<!-- src/components/CaptchaField.vue -->
<template>
  <div class="captcha-field">
    <el-input v-model="code" placeholder="图形验证码" maxlength="4" autocomplete="off" />

    <button
      type="button"
      class="captcha-image"
      :disabled="loading"
      aria-label="刷新图形验证码"
      title="点击刷新"
      @click="emit('refresh')"
    >
      <img v-if="image" :src="image" alt="图形验证码" />
      <span v-else class="captcha-placeholder">加载中…</span>
    </button>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";

const props = defineProps<{
  /** SVG data URI，由 useCaptcha 获取 */
  image: string;
  modelValue: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  refresh: [];
}>();

/** 用户输入的验证码文本 */
const code = computed({
  get: () => props.modelValue,
  set: (value: string) => {
    emit("update:modelValue", value);
  },
});
</script>

<style scoped>
.captcha-field {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.captcha-field :deep(.el-input) {
  flex: 1;
}

.captcha-image {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 40px;
  flex-shrink: 0;
  padding: 0;
  overflow: hidden;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  background: var(--surface);
  cursor: pointer;
}

.captcha-image:disabled {
  cursor: wait;
  opacity: 0.7;
}

.captcha-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.captcha-placeholder {
  color: var(--text);
  font-size: 12px;
}
</style>
