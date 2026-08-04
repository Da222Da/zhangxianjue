<!-- src/App.vue -->
<template>
  <!-- <Layout v-if="isAuthenticated">
    <router-view />
  </Layout> -->
  <router-view />
</template>

<script lang="ts" setup>
// import { computed } from 'vue';
// import Layout from '@/components/Layouts/index.vue';
// import { useAuthStore } from '@/store/auth';

// const authStore = useAuthStore();
// const isAuthenticated = computed(() => !!authStore.accessToken);
</script>

<style>
body {
  margin: 0;
  font-family: Arial, sans-serif;
}
</style>
