<template>
  <div style="width: 100%; height: 90vh">
    <Markdown :value="value" :config="config" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";

const value = ref("");
const config = {
  clickToMermaidMindmapNodes: function (e: MouseEvent) {
    const { nodeId, nodeText } = this;

    // 在这里执行你的业务逻辑，比如弹窗、跳转等
    alert(`你点击了节点: ${nodeText}`);
  },
};
onMounted(() => {
  nextTick(async () => {
    try {
      const response = await fetch("../assets/markdown/mermaid.md");
      value.value = await response.text();
    } catch (error) {
      console.error("Error fetching markdown file:", error);
    }
  });
});
</script>
