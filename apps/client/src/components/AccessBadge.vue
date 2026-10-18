<!-- src/components/AccessBadge.vue -->
<template>
  <span class="access-badge" :class="isFree ? 'access-badge--free' : 'access-badge--vip'">
    {{ isFree ? "限免" : "VIP" }}
  </span>
</template>

<script setup lang="ts">
/**
 * 封面右上角的访问角标
 *
 * isFree=true → 橙色「限免」；false → 金色「VIP」。
 * 样式对齐参考图的流媒体角标：小圆角实色块 + 右上角定位。
 *
 * ⚠️ 父级封面容器必须是 position: relative；顶部偏移可用
 * `--access-badge-top` 覆盖（书籍卡片顶部有仿窗口装饰栏，需要下移）。
 */
defineProps<{
  isFree: boolean;
}>();
</script>

<style scoped>
.access-badge {
  position: absolute;
  top: var(--access-badge-top, 10px);
  right: 10px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.04em;
  box-shadow: 2px 2px 0 rgb(47 53 66 / 18%);
}

.access-badge--free {
  background: #ff6b35;
  color: #fff;
}

.access-badge--vip {
  background: #f3c04c;
  color: #4d3300;
}
</style>
