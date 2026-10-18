<!-- src/components/Layouts/Sidebar.vue -->
<template>
  <el-aside class="sidebar">
    <SidebarMenu />
  </el-aside>
</template>

<script lang="ts" setup>
import SidebarMenu from "./SidebarMenu.vue";
</script>

<style lang="scss" scoped>
.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  height: calc(100vh - var(--header-height));
  height: calc(100dvh - var(--header-height));
  overflow-y: auto;
}

/* 小屏改用 Header 的抽屉菜单，侧栏让出整行宽度 */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
}
</style>
