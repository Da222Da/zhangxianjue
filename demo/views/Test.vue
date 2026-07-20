<template>
  <div style="width: 100%; height: 90vh">
    <Markdown v-if="value" :value="value" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const value = ref("");
onMounted(async () => {
  try {
    const response = await fetch("../assets/markdown/index.md");
    value.value = await response.text();
  } catch (error) {
    console.error("Error fetching markdown file:", error);
  }
});
</script>

<style scoped></style>
