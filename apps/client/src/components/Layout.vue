<!-- src/components/Layout/index.vue -->
<template>
  <div class="w-100 h-100">
    <Header />

    <!-- 内容区域 -->
    <div class="w-100 box-content">
      <el-row class="w-100 h-100 m-0" :gutter="20">
        <el-col :xs="0" :sm="4"></el-col>
        <el-col :xs="24" :sm="16" class="w-100 h-100 p-0">
          <!-- 面包屑 -->
          <Breadcrumb :height="BreadcrumbHeight" />

          <!-- 内容区域 -->
          <div :style="contentStyle">
            <router-view />
          </div>
        </el-col>
        <el-col :xs="0" :sm="4"></el-col>
      </el-row>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import Header from "./Header.vue";
import Breadcrumb from "./Breadcrumb.vue";

const BreadcrumbHeight = ref(30);
const contentStyle = computed(() => {
  return {
    /*
     * ⚠️ 这里原来少了一个右括号（`calc(100% - 30px`），属于非法 CSS，
     * 浏览器会整条丢弃 —— 于是容器没有高度，页面里的 `height: 100%`
     * 全部退化成 auto，内容高度失去约束。已补上闭合括号。
     */
    height: `calc(100% - ${BreadcrumbHeight.value}px)`,
  };
});
</script>

<style scoped>
.box-content {
  /* 与 Header 共用同一个高度令牌，避免两处各写一个像素值、改一处漏一处 */
  height: calc(100vh - var(--header-height));
  padding: 1rem;
  box-sizing: border-box;
  overflow-y: auto;
}

/* 移动端收窄留白，把宽度还给内容 */
@media (max-width: 768px) {
  .box-content {
    padding: 0.5rem;
  }
}
</style>
