<!-- src/components/Layout/index.vue -->
<template>
  <div class="layout">
    <!-- <Header /> -->
    <div class="page-container">
      <Sidebar />
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script lang="ts" setup>
import Header from "./Header.vue";
import Sidebar from "./Sidebar.vue";
</script>

<style scoped>
.layout {
  width: 100%;
  display: flex;
  flex-direction: column;
}
.page-container {
  width: 100%;
  height: calc(100vh - 60px);
  display: flex;
}
.main-content {
  flex: 1;
  padding: 1rem;
  box-sizing: border-box;
}
</style>
