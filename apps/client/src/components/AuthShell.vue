<!-- src/components/AuthShell.vue -->
<template>
  <div class="auth-page">
    <div class="auth-card sketch-box">
      <!-- 品牌区：与 Header 同一枚 favicon，返回首页 -->
      <router-link to="/timeline" class="auth-brand" aria-label="返回首页">
        <span class="auth-brand__badge" aria-hidden="true">
          <img class="auth-brand__mark" src="/favicon.svg" alt="" />
        </span>
        <span class="auth-brand__text">Unreal Engine 攻略笔记</span>
      </router-link>

      <!-- ⚠️ sketch-underline 是 inline-block：必须包在 h1 里，否则标题会贴到品牌行上 -->
      <h1 class="auth-title"><span class="sketch-underline">{{ title }}</span></h1>
      <p v-if="subtitle" class="auth-subtitle">{{ subtitle }}</p>

      <div class="auth-body">
        <slot />
      </div>

      <div class="auth-switch">
        <slot name="footer" />
      </div>

      <router-link to="/timeline" class="auth-back">← 返回时间轴</router-link>
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<style scoped>
.auth-page {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 32px 16px;
  box-sizing: border-box;
}

.auth-card {
  position: relative;
  width: min(420px, 100%);
  padding: 34px 32px 26px;
  box-sizing: border-box;
  background: var(--surface);
}

/* 右上角一枚橙色小方块，呼应站点的手绘标记 */
.auth-card::after {
  content: "";
  position: absolute;
  top: 22px;
  right: 24px;
  width: 9px;
  height: 9px;
  background: var(--orange);
  transform: rotate(-6deg);
}

.auth-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  text-decoration: none;
}

.auth-brand__badge {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: 12px 5px 13px 6px / 6px 13px 5px 12px;
  background: var(--surface);
  box-shadow: 2px 2px 0 var(--sketch-shadow);
  transform: rotate(-2deg);
}

.auth-brand__mark {
  width: 34px;
  height: 34px;
}

.auth-brand__text {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.auth-title {
  margin: 26px 0 6px;
  color: var(--text-h);
  font-size: 28px;
  line-height: 1.2;
}

.auth-subtitle {
  margin: 14px 0 24px;
  color: var(--text);
  font-size: 14px;
  line-height: 1.7;
}

.auth-body {
  margin-top: 8px;
}

.auth-switch {
  margin-top: 18px;
  color: var(--text);
  font-size: 14px;
  text-align: center;
}

.auth-switch :deep(a) {
  color: var(--brand-accent);
  font-weight: 600;
  text-decoration: none;
}

.auth-switch :deep(a:hover) {
  opacity: 0.75;
}

.auth-back {
  display: block;
  margin-top: 18px;
  color: var(--text);
  font-size: 12px;
  text-align: center;
  text-decoration: none;
  opacity: 0.7;
}

.auth-back:hover {
  opacity: 1;
}

/* ===== 表单控件手绘化（只作用于登录 / 注册卡片）===== */
.auth-body :deep(.el-form-item) {
  margin-bottom: 20px;
}

.auth-body :deep(.el-form-item__label) {
  padding-bottom: 4px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.auth-body :deep(.el-input__wrapper) {
  border-radius: var(--sketch-radius-sm);
  background: var(--surface);
  box-shadow: 0 0 0 1.4px var(--ink) inset;
  transition: box-shadow 0.2s;
}

.auth-body :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1.6px var(--brand-accent) inset;
}

.auth-body :deep(.el-input__inner) {
  color: var(--text-h);
  font-size: 15px;
}

.auth-body :deep(.el-form-item__error) {
  color: #c0392b;
}

/*
 * ⚠️ 提交按钮是插槽内容，作用域 id 属于 Login / Register 而不是本组件，
 * 不带 :deep 的选择器匹配不到。必须从带本组件作用域的 .auth-body 往下穿透。
 */
.auth-body :deep(.auth-submit) {
  width: 100%;
  height: 44px;
  border-radius: var(--sketch-radius-sm);
  box-shadow: 3px 3px 0 var(--sketch-shadow);
  font-size: 15px;
  letter-spacing: 0.12em;
}

.auth-body :deep(.auth-submit:hover) {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--sketch-shadow);
}

.auth-body :deep(.auth-submit:active) {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--sketch-shadow);
}

@media (max-width: 480px) {
  .auth-card {
    padding: 26px 20px 20px;
  }

  .auth-title {
    font-size: 24px;
  }
}
</style>
