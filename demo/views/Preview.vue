<template>
  <div style="width: 100%; height: 90vh">
    <Markdown v-if="value" :value="value" :PreviewConfig="PreviewConfig" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const value = ref("");
const PreviewConfig = {
  handleClickToMermaidNodes: function (e: MouseEvent) {
    const node = this;
    if (!node) return; // 如果没有找到目标元素，直接返回
    // 从 DOM 元素中提取节点信息，例如 ID
    const nodeId = node.id;
    const nodeText = node.textContent.trim();
    // 在这里执行你的业务逻辑，比如弹窗、跳转等
    alert(`你点击了节点: ${nodeText}`);
  },
};
onMounted(async () => {
  try {
    const response = await fetch("../assets/markdown/index.md");
    value.value = await response.text();
  } catch (error) {
    console.error("Error fetching markdown file:", error);
  }
});
</script>
