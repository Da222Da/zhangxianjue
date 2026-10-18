<!-- src/views/timeline/TimelineButtonRow.vue -->
<template>
  <div class="button-row">
    <el-input v-model="text" maxlength="50" placeholder="按钮文案，如「查看笔记」" />
    <el-input v-model="url" maxlength="1024" placeholder="链接：/notes/1 或 https://…" />
    <el-button link type="danger" @click="emit('remove')">删除</el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TimelineButton } from "@/types/api";

const props = defineProps<{
  /** 草稿里的按钮对象；父级打开弹窗时已深拷贝，这里直接写回安全 */
  button: TimelineButton;
}>();

const emit = defineEmits<{
  remove: [];
}>();

/*
 * 拆成子组件是为了绕开 vue-tsc 3.3 的一个作用域问题：
 * `v-for` 里的组件只要带事件（v-model / @update / @input），同一循环元素内**后续的兄弟节点**
 * 就再也找不到循环别名，报「Cannot find name 'btn' / 'index'」。
 * 把行内容收进子组件后，v-for 元素只剩一个没有子节点的组件，问题消失。
 */
const text = computed({
  get: () => props.button.text,
  set: (value: string) => {
    props.button.text = value;
  },
});

const url = computed({
  get: () => props.button.url,
  set: (value: string) => {
    props.button.url = value;
  },
});
</script>

<style scoped>
.button-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.button-row :deep(.el-button) {
  flex-shrink: 0;
}

/* 窄屏把两个输入框各占一行，删除按钮右对齐 */
@media (max-width: 600px) {
  .button-row {
    flex-wrap: wrap;
  }

  .button-row :deep(.el-input) {
    flex: 1 1 100%;
  }

  .button-row :deep(.el-button) {
    margin-left: auto;
  }
}
</style>
