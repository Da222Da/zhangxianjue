<template>
  <el-header height="60px" class="header">
    <div class="header-content">
      <!-- 左侧系统名称 -->
      <div class="logo">
        <!-- <h2>用户权限系统</h2> -->
      </div>

      <!-- 右侧用户信息和操作 -->
      <div class="user-info">
        <el-dropdown trigger="click">
          <span class="el-dropdown-link">
            <!-- <el-avatar :src="user?.avatar || defaultAvatar" :size="36" class="avatar"></el-avatar> -->
            <span class="username">{{ user?.username }}</span>
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
import { computed } from "vue";
import { ElMessageBox, ElMessage } from "element-plus";
// import { useAuthStore } from "@/store/auth";

// const authStore = useAuthStore();

// 获取用户信息
// const user = computed(() => authStore.user);

// 默认头像
const defaultAvatar = "http://img.zzqlyx.com/20240903/yk.png";

// 处理退出登录
// const handleLogout = () => {
//   ElMessageBox.confirm("确定要退出登录吗？", "提示", {
//     confirmButtonText: "确定",
//     cancelButtonText: "取消",
//     type: "info",
//   })
//     .then(() => {
//       authStore.logout();
//     })
//     .catch(() => {
//       // 用户取消退出
//     });
// };
</script>

<style lang="scss" scoped>
// @import "@/assets/styles/variables.scss";
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

.guest-info {
  display: flex;
  align-items: center;
}

.guest-info .btn-text {
  color: white;
  margin-left: 8px;
}

.guest-info .btn-text:hover {
  color: #ffd04b;
}
</style>
