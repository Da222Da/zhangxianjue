<!-- src/components/Layouts/SidebarMenu.vue -->
<template>
  <el-menu :default-active="activeMenu" class="sidebar-menu" router @select="emit('navigate')">
    <el-menu-item v-for="item in visibleMenuItems" :key="item.path" :index="item.path">
      <el-icon class="menu-icon">
        <component :is="item.icon" />
      </el-icon>
      <span>{{ item.title }}</span>
    </el-menu-item>
  </el-menu>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Avatar, Calendar, Document, Key, Notebook, Reading, Stamp, UserFilled } from "@element-plus/icons-vue";
import type { Component } from "vue";
import { Permissions } from "@/constants/permissions";
import type { PermissionCode } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth";

interface MenuItem {
  path: string;
  name: string;
  icon: Component;
  title: string;
  /** 访问该页面所需权限；路由守卫与菜单共用同一套编码 */
  permission: PermissionCode;
}

const menuItems: MenuItem[] = [
  { path: "/timeline", name: "Timeline", icon: Calendar, title: "时间轴管理", permission: Permissions.TIMELINE_MANAGE },
  { path: "/articles", name: "Articles", icon: Document, title: "文章管理", permission: Permissions.ARTICLE_MANAGE },
  { path: "/notes", name: "Notes", icon: Notebook, title: "笔记管理", permission: Permissions.NOTE_MANAGE },
  { path: "/books", name: "Books", icon: Reading, title: "书库管理", permission: Permissions.BOOK_MANAGE },
  { path: "/users", name: "Users", icon: UserFilled, title: "用户管理", permission: Permissions.USER_MANAGE },
  { path: "/membership", name: "Membership", icon: Stamp, title: "会员申请", permission: Permissions.USER_MANAGE },
  { path: "/roles", name: "Roles", icon: Avatar, title: "角色管理", permission: Permissions.ROLE_MANAGE },
  { path: "/permissions", name: "Permissions", icon: Key, title: "权限管理", permission: Permissions.PERMISSION_MANAGE },
];

const emit = defineEmits<{
  /** 移动端抽屉里点击菜单后通知父级关闭抽屉 */
  navigate: [];
}>();

const route = useRoute();
const authStore = useAuthStore();

/**
 * 菜单按权限过滤
 *
 * ⚠️ 这里只是「不给入口」，真正的拦截在路由守卫与服务端中间件；
 * 前端卸载菜单不能当权限控制使用。
 */
const visibleMenuItems = computed(() => menuItems.filter((item) => authStore.hasPermission(item.permission)));

const activeMenu = computed(() => route.path);
</script>

<style lang="scss" scoped>
.sidebar-menu {
  height: 100%;
  border-right: none;
}

.sidebar-menu .el-menu-item {
  display: flex;
  align-items: center;
}

.menu-icon {
  font-size: 1rem;
}
</style>
