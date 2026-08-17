<!-- src/components/Layout/index.vue -->
<template>
  <div class="layout">
    <Header />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script lang="ts" setup>
import Header from "./Header.vue";
</script>

<style scoped>
.layout {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.main-content {
  height: calc(100vh - 60px);
  flex: 1;
  padding: 1rem;
  box-sizing: border-box;
}
</style>
