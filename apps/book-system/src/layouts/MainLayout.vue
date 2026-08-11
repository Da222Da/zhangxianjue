<template>
  <div class="main-layout">
    <header class="top-nav" v-if="!isFullscreen">
      <div class="nav-brand" @click="$router.push('/screen3d')">
        <span class="logo-mark">📖</span>
        <span>图书推荐系统</span>
      </div>
      <nav class="nav-links">
        <router-link
          v-for="item in visibleMenus"
          :key="item.path"
          :to="item.path"
          :class="{ active: isActive(item.path) }"
        >
          {{ item.title }}
        </router-link>
      </nav>
      <div class="nav-user">
        <span class="role-tag">{{ roleLabel }}</span>
        <span>{{ userStore.user?.username }}</span>
        <el-button text type="danger" size="small" @click="handleLogout">退出</el-button>
      </div>
    </header>
    <main :class="['main-content', { 'full-screen': isFullscreen }]">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore, useThemeStore } from '@/stores'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const themeStore = useThemeStore()

const menus = [
  { path: '/screen3d', title: '3D场景大屏', roles: ['admin', 'editor', 'user'] },
  { path: '/dashboard', title: '图表数据大屏', roles: ['admin', 'editor', 'user'] },
  { path: '/predict', title: '模型预测', roles: ['admin', 'editor', 'user'] },
  { path: '/books', title: '图书管理', roles: ['admin', 'editor'] },
  { path: '/users', title: '用户管理', roles: ['admin'] },
  { path: '/db-settings', title: '数据库设置', roles: ['admin'] },
  { path: '/style', title: '样式设置', roles: ['admin'] }
]

const visibleMenus = computed(() =>
  menus.filter((m) => m.roles.includes(userStore.user?.role))
)

const isFullscreen = computed(() => !!route.meta.fullscreen)

const roleLabel = computed(() => {
  const map = { admin: '管理员', editor: '编辑', user: '普通用户' }
  return map[userStore.user?.role] || ''
})

function isActive(path) {
  return route.path.startsWith(path)
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}

onMounted(() => {
  themeStore.loadTheme()
})
</script>

<style scoped lang="scss">
.main-layout {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-nav {
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 24px;
  background: rgba(10, 22, 40, 0.92);
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: blur(10px);
  z-index: 100;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: var(--primary-color);
  cursor: pointer;
  font-weight: 600;
  margin-right: 40px;
  white-space: nowrap;
}

.nav-links {
  display: flex;
  gap: 4px;
  flex: 1;
  overflow-x: auto;

  a {
    padding: 6px 14px;
    color: rgba(232, 240, 248, 0.65);
    text-decoration: none;
    font-size: 14px;
    border-radius: 4px;
    white-space: nowrap;
    transition: all 0.2s;

    &:hover {
      color: var(--text-color);
      background: rgba(255, 255, 255, 0.06);
    }

    &.active, &.router-link-active {
      color: var(--primary-color);
      background: rgba(201, 162, 39, 0.12);
    }
  }
}

.nav-user {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: rgba(232, 240, 248, 0.8);
  margin-left: 16px;
}

.role-tag {
  padding: 2px 8px;
  font-size: 11px;
  border: 1px solid var(--primary-color);
  border-radius: 3px;
  color: var(--primary-color);
}

.main-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;

  &.full-screen {
    height: 100vh;
    flex: 1;
  }
}
</style>
