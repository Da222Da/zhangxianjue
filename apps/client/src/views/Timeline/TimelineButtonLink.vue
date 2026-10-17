<!-- src/views/Timeline/TimelineButtonLink.vue -->
<template>
  <router-link v-if="internal" :to="url" class="event-button">
    {{ text }}
    <span class="event-button-arrow" aria-hidden="true">→</span>
  </router-link>
  <a v-else :href="url" target="_blank" rel="noopener noreferrer" class="event-button">
    {{ text }}
    <span class="event-button-arrow" aria-hidden="true">↗</span>
  </a>
</template>

<script setup lang="ts">
defineProps<{
  text: string;
  url: string;
  /** 站内路径交给 vue-router，外链交给浏览器 */
  internal: boolean;
}>();
</script>

<style scoped>
/* 手绘小纸片：hover 时填充主色 */
.event-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 13px;
  border: 1.4px solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  background: var(--brand-accent-soft);
  color: var(--brand-accent);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.event-button:hover {
  background: var(--brand-accent);
  color: #fff;
}

.event-button-arrow {
  transition: transform 0.2s;
}

.event-button:hover .event-button-arrow {
  transform: translateX(2px);
}
</style>
