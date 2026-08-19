<template>
  <svg ref="markmapRef" :style="{ width: '100%', height: '100%' }"></svg>
</template>

<script setup lang="ts">
import { ref, onMounted, onUpdated, watch, onUnmounted } from "vue";
import { loadJS, loadCSS } from "markmap-common";
import { Transformer } from "markmap-lib";
import * as markmap from "markmap-view";
import { Markmap } from "markmap-view";

const props = defineProps({
  value: {
    type: String,
    default: "",
  },
});

let resizeObserver: ResizeObserver | null = null;

// 加载资源
const transformer = new Transformer();
const { scripts, styles } = transformer.getAssets();
loadCSS(styles as any);
loadJS(scripts as any, { getMarkmap: () => markmap });

// ref
const markmapRef = ref();
const markmapValue = ref(props.value);
const markmapInstance = ref(null);

// 更新 markmap 数据
const update = async () => {
  const { root } = transformer.transform(markmapValue.value);
  await markmapInstance.value.setData(root);
  markmapInstance.value.fit();
};

// 监听窗口大小变化
const size = () => {
  if (markmapRef.value) {
    // 创建 ResizeObserver 实例
    resizeObserver = new ResizeObserver(() => markmapInstance.value.fit());

    // 开始监听
    resizeObserver.observe(markmapRef.value);
  }
};

onMounted(() => {
  // 创建 markmap 实例
  markmapInstance.value = Markmap.create(markmapRef.value);

  // 更新数据
  update();

  // 监听窗口大小变化
  size();
});
onUpdated(update);

watch(
  () => props.value,
  (value) => {
    markmapValue.value = value;
    update();
  },
);

onUnmounted(() => {
  // 组件卸载时停止监听
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

defineExpose({
  markmapInstance,
});
</script>
