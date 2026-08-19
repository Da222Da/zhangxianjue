<template>
  <div ref="toolbarRef" class="toolbar-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { Toolbar } from "markmap-toolbar";

const props = defineProps({
  markmap: {
    type: Object,
    default: null,
  },
});

const toolbarRef = ref();

onMounted(async () => {
  await nextTick();
  const { el } = Toolbar.create(props.markmap.markmapInstance);
  el.style.position = "absolute";
  el.style.bottom = "0.5rem";
  el.style.right = "0.5rem";

  // 将工具栏挂载到指定的 HTML 容器中
  if (toolbarRef.value) {
    toolbarRef.value.append(el);
  }
});
</script>

<style scoped>
.toolbar-container:deep(.mm-toolbar) {
  display: flex;
  -webkit-user-select: none;
  -moz-user-select: none;
  user-select: none;
  align-items: center;
  border-width: 1px;
  --un-border-opacity: 1;
  border-color: rgb(212 212 216 / var(--un-border-opacity));
  border-radius: 0.25rem;
  border-style: solid;
  --un-bg-opacity: 1;
  background-color: rgb(255 255 255 / var(--un-bg-opacity));
  padding: 0.25rem;
  line-height: 1;
}
.toolbar-container:deep(.mm-toolbar-brand) {
  display: none;
}
</style>
