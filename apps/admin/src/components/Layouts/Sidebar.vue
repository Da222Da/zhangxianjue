<template>
  <el-aside class="sidebar">
    <el-menu :default-active="activeMenu" class="el-menu-vertical" router>
      <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
        <component class="el-icon" :is="item.icon"></component>
        <span>{{ item.title }}</span>
      </el-menu-item>
    </el-menu>
  </el-aside>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Calendar, Document, FolderOpened, Notebook } from "@element-plus/icons-vue";
import type { Component } from "vue";

interface MenuItem {
  path: string;
  name: string;
  icon: Component;
  title: string;
}

const menuItems: MenuItem[] = [
  //   { path: "/", name: "Dashboard", icon: House, title: "首页" },
  { path: "/timeline", name: "Timeline", icon: Calendar, title: "时间轴管理" },
  { path: "/articles", name: "Articles", icon: Document, title: "文章管理" },
  { path: "/notes", name: "Notes", icon: Notebook, title: "笔记管理" },
  { path: "/categories", name: "Categories", icon: FolderOpened, title: "分类管理" },
  //   { path: "/users", name: "Users", icon: User, title: "用户管理" },
  //   { path: "/roles", name: "Roles", icon: Setting, title: "角色管理" }, // 确保使用正确的图标名称
  //   { path: "/permissions", name: "Permissions", icon: Lock, title: "权限管理" },
];

const route = useRoute();

const activeMenu = computed(() => route.path);
</script>

<style lang="scss" scoped>
.sidebar {
  width: var(--sidebar-width);
  height: calc(100vh - var(--header-height)); /* 减去 Header 的高度 */
}

.el-menu-vertical {
  height: 100%;
  border-right: none;
}

.el-menu-vertical .el-menu-item {
  display: flex;
  align-items: center;
}

.el-menu-vertical .el-icon {
  font-size: 1rem;
}

/* 响应式设计：在小屏幕下隐藏侧边栏 */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
}
</style>
