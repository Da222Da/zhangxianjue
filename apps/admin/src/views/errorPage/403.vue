<!-- src/views/errorPage/403.vue -->
<template>
  <div class="forbidden">
    <el-container>
      <el-main>
        <el-result icon="warning" title="403" sub-title="抱歉，当前账号没有访问该页面的权限。">
          <template #extra>
            <el-button type="primary" @click="goHome">返回文章管理</el-button>
          </template>
        </el-result>
      </el-main>
    </el-container>
  </div>
</template>

<script lang="ts" setup>
import { useRouter } from "vue-router";

const router = useRouter();

/** 能进入后台的账号一定具备 admin:access，文章管理是最稳妥的落点 */
const goHome = (): void => {
  void router.push({ name: "Articles" });
};
</script>

<style scoped>
.forbidden {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80vh;
}
</style>
