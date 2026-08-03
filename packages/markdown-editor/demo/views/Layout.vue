<template>
  <el-container class="app-container">
    <el-aside width="250px">
      <el-menu class="aside-menu flex-menu" :default-active="activeRoute" :default-openeds="defaultOpeneds" router :unique-opened="true">
        <div class="menu-top">
          <!-- 首页单独写死，因为它是没有子菜单的顶级项 -->
          <el-menu-item index="/">
            <span>首页</span>
          </el-menu-item>

          <!-- 动态渲染菜单数据 -->
          <template v-for="menu in menuData" :key="menu.path">
            <!-- 使用递归组件 -->
            <recursive-menu :menuData="menu" />
          </template>
        </div>

        <!-- ===== 底部菜单组（登录） ===== -->
        <div class="menu-bottom">
          <el-menu-item index="/test">
            <span>测试页面</span>
          </el-menu-item>
          <el-menu-item index="/login">
            <span>前往登录</span>
          </el-menu-item>
        </div>
      </el-menu>
    </el-aside>

    <el-main class="main-content">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { dynamicRoutes } from '../scripts/router.ts'; // 导入路由配置
import RecursiveMenu from '../components/RecursiveMenu.vue';

const route = useRoute();
const activeRoute = computed(() => route.path);

function generateMenuData(routes) {
  const hideNames = ['home', 'login'];

  return routes
    .filter((route) => !hideNames.includes(route.title))
    .filter((route) => route.mate?.menuName) // 过滤掉没有 title 的路由
    .map((route) => {
      const menuItem = {
        path: route.mate?.menuPath,
        title: route.mate?.menuName,
      };

      // 如果存在子路由，递归生成子菜单
      if (route.children && route.children.length > 0) {
        menuItem.children = generateMenuData(route.children);
      }

      return menuItem;
    });
}
const menuData = generateMenuData(dynamicRoutes);

// 动态计算默认展开项：提取所有包含 children 的顶级菜单的 path
const defaultOpeneds = computed(() => {
  return menuData
    .filter((menu) => menu.children && menu.children.length > 0)
    .map((menu) => {
      return menu.path;
    });
});
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100vh;
}
.el-aside {
  height: 100%;
  border-right: 1px solid var(--el-menu-border-color);
  overflow-y: auto;
}
.main-content {
  padding: 20px;
  overflow-y: auto;
}

.aside-menu {
  height: 100%;
  border-right: none;
}
.flex-menu {
  display: flex;
  flex-direction: column;
}
.menu-top {
  flex: 1; /* 占据剩余所有空间，把底部顶下去 */
}
.menu-bottom {
  flex-shrink: 0; /* 不允许被压缩 */
  border-top: 1px solid var(--el-menu-border-color);
}
</style>
