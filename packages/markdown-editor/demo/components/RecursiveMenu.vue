<template>
  <!-- 有子节点的情况：渲染 el-sub-menu -->
  <el-sub-menu v-if="menuData.children && menuData.children.length" :index="menuData.path || ''">
    <template #title>
      <span>{{ menuData.title }}</span>
    </template>

    <!-- 递归调用自身，遍历子节点 -->
    <recursive-menu v-for="child in menuData.children" :key="child.path" :menuData="child" />
  </el-sub-menu>

  <!-- 没有子节点的情况：渲染 el-menu-item -->
  <el-menu-item v-else :index="menuData.path">
    <span>{{ menuData.title }}</span>
  </el-menu-item>
</template>

<script setup>
// 接收父组件传递过来的单个菜单项数据
defineProps({
  menuData: {
    type: Object,
    required: true,
  },
});
</script>
