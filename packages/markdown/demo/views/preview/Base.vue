<template>
  <div style="width: 100%; height: 90vh">
    <Markdown :value="value" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const isLoading = ref(true);
const value = ref("");

onMounted(() => {
  fetchData();
});

// 异步数据请求
const fetchData = async () => {
  try {
    isLoading.value = true;
    const response = await fetch("../assets/markdown/index.md");
    value.value = await response.text();
    isLoading.value = false; // 数据加载完成，触发组件渲染
  } catch (error) {
    console.error("Error fetching markdown file:", error);
  }
};
</script>
