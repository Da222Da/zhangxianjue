<!-- src/views/dashboard/index.vue -->
<template>
  <div class="dashboard">
    <!-- 欢迎卡片 -->
    <!-- <el-card class="box-card">
      <div class="user-info">
        <el-avatar :src="user.avatar || defaultAvatar" :size="258" />
        <div class="user-details">
          <h2>欢迎, {{ user.username }}!</h2>
          <el-descriptions title="基本信息" :column="1">
            <el-descriptions-item label="邮箱：">{{ user.email }}</el-descriptions-item>
            <el-descriptions-item label="角色：">{{ getRoleName(user.role_id) }}</el-descriptions-item>
            <el-descriptions-item label="电话：">{{ user.phone }}</el-descriptions-item>
            <el-descriptions-item label="注册时间：">{{ formatDate(user.createdAt) }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </el-card> -->

    <!-- 统计信息卡片 -->
    <!-- <el-row :gutter="20" class="stat-row">
      <el-col :span="8">
        <el-card>
          <div class="stat-card">
            <el-icon><User /></el-icon>
            <div class="stat-content">
              <h3>总用户数</h3>
              <p>{{ dashboardStats?.userCount || 0 }}</p>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <div class="stat-card">
            <el-icon><User /></el-icon>
            <div class="stat-content">
              <h3>活跃用户</h3>
              <p>{{ dashboardStats?.activeUserCount || 0 }}</p>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <div class="stat-card">
            <el-icon><Lock /></el-icon>
            <div class="stat-content">
              <h3>权限数量</h3>
              <p>{{ dashboardStats?.permissionCount || 0 }}</p>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row> -->
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
// import { useAuthStore } from "@/store/auth";
import { User, Lock } from "@element-plus/icons-vue";

// import statsService from "@/api/statsService";
// import type { DashboardStats } from "@/types/api";

// const authStore = useAuthStore();

// 获取用户信息
// const user = computed(
//   () =>
//     authStore.user || {
//       username: "未登录",
//       email: "未登录",
//       role_id: 0,
//       phone: "未登录",
//       avatar: "",
//       createdAt: "",
//     },
// );

// const dashboardStats = ref<DashboardStats>();

// 默认头像
const defaultAvatar = "http://img.zzqlyx.com/20240903/yk.png";

// 模拟角色名称映射（实际应从后端获取或在 store 中定义）
enum roles {
  "超级管理员",
  "管理员",
  "普通用户",
}

// 获取角色名称
const getRoleName = (roleId: number): string => {
  return roles[roleId] || "未知角色";
};

// 格式化日期
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString();
};
// 获取统计数据
// const getDashboardStats = async (): Promise<void> => {
//   try {
//     const { data } = await statsService.getDashboardStats();
//     console.log(data);
//     dashboardStats.value = data ?? {};
//   } catch (error) {}
// };

onMounted(() => {
  //   getDashboardStats();
});
</script>

<style scoped lang="scss">
.dashboard {
  .box-card {
    margin-bottom: 1rem;
    .user-info {
      display: flex;
      align-items: center;
      .user-details {
        margin-left: 1rem;
      }
    }
  }

  .stat-row {
    .el-col {
      .el-card {
        padding: 1rem;

        .stat-card {
          display: flex;
          align-items: center;

          .el-icon {
            font-size: 2rem;
            margin-right: 1rem;
          }

          .stat-content {
            h3 {
              margin: 0;
              font-size: 1rem;
            }

            p {
              margin: 5px 0 0;
              font-size: 1.5rem;
              font-weight: bold;
              color: var(--primary);
            }
          }
        }
      }
    }
  }
}
</style>
