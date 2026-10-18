<!-- src/components/Layouts/Header.vue -->
<template>
  <el-header height="60px" class="header">
    <div class="header-content">
      <!-- 左侧：小屏菜单按钮 + 系统名称 -->
      <div class="brand">
        <el-button class="menu-toggle" text :icon="Menu" aria-label="打开导航菜单" @click="emit('toggle-menu')" />
        <div class="logo">
          <h2>后台管理</h2>
        </div>
      </div>

      <!-- 右侧用户信息和操作 -->
      <div class="user-info">
        <el-dropdown trigger="click">
          <span class="el-dropdown-link">
            <el-avatar :src="authStore.user?.avatar || undefined" :size="36" class="avatar">
              {{ authStore.displayName.charAt(0) }}
            </el-avatar>
            <span class="username">{{ authStore.displayName }}</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </el-header>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";
import { ElMessageBox } from "element-plus";
import { Menu } from "@element-plus/icons-vue";
import { useAuth } from "@/composables/useAuth";

const emit = defineEmits<{
  "toggle-menu": [];
}>();

const { authStore, loadUser, logout } = useAuth();

// 处理退出登录
const handleLogout = () => {
  ElMessageBox.confirm("确定要退出登录吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "info",
  })
    .then(() => logout())
    .catch(() => {
      // 用户取消退出，无需处理
    });
};

// 令牌持久化在 localStorage，刷新页面后 user 可能为空，进入布局时补齐
onMounted(() => {
  void loadUser();
});
</script>

<style lang="scss" scoped>
.header {
  background-color: var(--primary); /* Element Plus 默认主题色 */
  display: flex;
  align-items: center;
  padding: 0 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.brand {
  display: flex;
  align-items: center;
  min-width: 0;
}

.logo {
  min-width: 0;
}

.logo h2 {
  color: white;
  margin: 0;
  font-size: 1.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 桌面端隐藏汉堡按钮；小屏由媒体查询打开 */
.menu-toggle {
  display: none;
  margin-right: 4px;
  color: white;
}

.user-info {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.el-dropdown-link {
  display: flex;
  align-items: center;
}

.avatar {
  margin-right: 8px;
}

.username {
  color: white;
  margin-right: 16px;
  cursor: pointer;
}

@media (max-width: 768px) {
  .header {
    padding: 0 12px;
  }

  .menu-toggle {
    display: inline-flex;
  }

  .logo h2 {
    font-size: 1.2rem;
  }
}

@media (max-width: 480px) {
  .header {
    padding: 0 8px;
  }

  .logo h2 {
    font-size: 1.05rem;
  }

  .username {
    display: none;
  }

  .avatar {
    margin-right: 0;
  }
}
</style>
