<template>
  <el-dialog v-if="visiable" v-model="visiable" :title="title" width="80%">
    <div style="height: 60vh">
      <Markdown :value="content" />
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";

const props = defineProps({
  modelValue: Boolean,
  title: String,
  content: String,
});

const visiable = ref(false);

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      visiable.value = newVal;
    }
  },
);
</script>
