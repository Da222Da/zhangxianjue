<!-- src/components/Layout/index.vue -->
<template>
  <div class="layout">
    <Header @toggle-menu="mobileMenuVisible = true" />
    <div class="page-container">
      <Sidebar />
      <main class="main-content">
        <router-view />
      </main>
    </div>

    <!-- 小屏导航：侧栏隐藏后从这里进入，点击菜单自动关闭 -->
    <el-drawer
      v-if="isMobile"
      v-model="mobileMenuVisible"
      class="mobile-nav-drawer"
      direction="ltr"
      size="220px"
      :with-header="false"
    >
      <SidebarMenu @navigate="mobileMenuVisible = false" />
    </el-drawer>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from "vue";
import Header from "./Header.vue";
import Sidebar from "./Sidebar.vue";
import SidebarMenu from "./SidebarMenu.vue";

/** 768px 以下侧栏隐藏，改用 Header 按钮唤出抽屉 */
const MOBILE_QUERY = "(max-width: 768px)";

const mobileMenuVisible = ref(false);
const isMobile = ref(false);
let mediaQuery: MediaQueryList | null = null;

const applyViewport = (matches: boolean): void => {
  isMobile.value = matches;
  // 从手机宽度拉回桌面时，抽屉不应当继续挂在页面上
  if (!matches) {
    mobileMenuVisible.value = false;
  }
};

const handleMediaChange = (event: MediaQueryListEvent): void => {
  applyViewport(event.matches);
};

onMounted(() => {
  mediaQuery = window.matchMedia(MOBILE_QUERY);
  applyViewport(mediaQuery.matches);
  mediaQuery.addEventListener("change", handleMediaChange);
});

onUnmounted(() => {
  mediaQuery?.removeEventListener("change", handleMediaChange);
});
</script>

<style scoped>
.layout {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.page-container {
  width: 100%;
  height: calc(100vh - var(--header-height));
  height: calc(100dvh - var(--header-height));
  display: flex;
}

.main-content {
  flex: 1;
  /* ⚠️ flex 子项默认 min-width:auto，表格会被撑出视口而不是内部滚动 */
  min-width: 0;
  padding: 1rem;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
}

/* 页面本身已经用 .main-content 留白，去掉 el-main 的默认内边距，避免双重留白 */
.main-content :deep(.el-main) {
  padding: 0;
}

/* 抽屉内容交给菜单自己撑满，去掉 el-drawer 的默认内边距 */
:global(.mobile-nav-drawer .el-drawer__body) {
  padding: 0;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .main-content {
    padding: 0.75rem;
  }
}
</style>
