<!-- src/views/NotFound.vue -->
<template>
  <div class="not-found">
    <el-container>
      <el-header></el-header>
      <el-main>
        <div class="not-found-content">
          <h1>404</h1>
          <p>抱歉，您访问的页面不存在。</p>
          <el-button type="primary" size="large" @click="goHome">返回首页</el-button>
        </div>
      </el-main>
      <el-footer></el-footer>
    </el-container>
  </div>
</template>

<script lang="ts" setup>
import { useRouter } from "vue-router";

const router = useRouter();

const goHome = () => {
  router.push({ name: "Dashboard" }); // 确保你的首页路由名为 'Dashboard'
};
</script>

<style scoped lang="scss">
.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 80vh;
  .not-found-content {
    text-align: center;
    h1 {
      font-size: 3rem;
      margin-bottom: 1.5rem;
    }
    p {
      font-size: 1.5rem;
      margin-bottom: 2rem;
    }
  }
}
</style>
