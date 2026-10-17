<!-- src/components/Layouts/Header.vue -->
<template>
  <el-header height="60px" class="header">
    <div class="header-content">
      <!-- 左侧系统名称 -->
      <div class="logo">
        <h2>后台管理</h2>
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
import { useAuth } from "@/composables/useAuth";

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
}

.logo h2 {
  color: white;
  margin: 0;
  font-size: 1.5rem;
}

.user-info {
  display: flex;
  align-items: center;
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
</style>
