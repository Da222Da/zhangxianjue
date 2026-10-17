<!-- src/components/Breadcrumb.vue -->
<template>
  <div class="box-breadcrumb" :style="{ height: height + 'px' }">
    <!--
      层级分隔统一用 /，与分区标签内部的「英文 / 中文」保持同一种符号：
         ■ NOTES / 攻略笔记 / 当前页标题
      分隔符的样式在下方与 .section-sep 对齐（同色、同透明度、同字号），
      让整条前缀在视觉上是一个整体。
    -->
    <el-breadcrumb v-if="section" separator="/">
      <!-- 分区项：由当前路由的 meta.section 决定，格式统一为 EN / 中文 -->
      <el-breadcrumb-item :to="section.to">
        <span class="section-label">
          <span class="section-square" aria-hidden="true"></span>
          <span class="section-en">{{ section.en }}</span>
          <span class="section-sep">/</span>
          <span class="section-zh">{{ section.zh }}</span>
        </span>
      </el-breadcrumb-item>

      <!-- 详情页才追加页面标题；分区落地页本身就是这一页，不重复显示 -->
      <el-breadcrumb-item v-if="showPageTitle">
        <span class="page-title">{{ pageTitle }}</span>
      </el-breadcrumb-item>
    </el-breadcrumb>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import type { RouteLocationNormalizedLoaded } from "vue-router";

defineProps({
  height: {
    type: Number,
    default: 30,
  },
});

const route = useRoute();

/** meta.title 允许写成 (route) => string，用于详情页这类标题随参数变化的场景 */
const resolveMetaValue = (value: unknown): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (typeof value === "function") {
    return (value as (r: RouteLocationNormalizedLoaded) => string | undefined)(route);
  }
  return typeof value === "string" ? value : undefined;
};

/**
 * 分区：由路由 meta.section 决定（类型见 @/types/router.d.ts）
 *
 * ✅ 决策：不再硬编码「首页」，也不依赖 ?parent= 查询参数。
 * 哪个路由属于哪个分区直接写在路由表里，详情页复用所属分区的配置，
 * 因此从外部直接粘链接进来也能得到完整面包屑。
 */
const section = computed(() => route.meta.section);

const pageTitle = computed(() => resolveMetaValue(route.meta.title) ?? "");

/**
 * 是否追加页面标题
 *
 * 分区落地页（如 /notes）的路径与 section.to 相同，此时不重复；
 * 详情页（如 /notes/1）追加标题。没有落地页的分区（文章库）section.to 为空，
 * 永远追加标题。
 */
const showPageTitle = computed(() => !!pageTitle.value && section.value?.to !== route.path);
</script>

<style lang="scss" scoped>
.box-breadcrumb {
  display: flex;
  align-items: center;
}

/* ===== 分区项：与攻略笔记卡片墙的页头标签同一套视觉 ===== */
.section-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--brand-accent);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

/* 小方块用橙色点缀，呼应参考图里手绘节点的描边色；轻微旋转避免太「矢量」 */
.section-square {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  background: var(--orange);
  transform: rotate(-4deg);
}

.section-en {
  text-transform: uppercase;
}

.section-sep {
  opacity: 0.55;
  letter-spacing: 0;
}

.section-zh {
  letter-spacing: 0.06em;
}

.page-title {
  color: var(--text);
  font-size: 13px;
}

/*
 * 分隔符：与分区标签内部的 /（.section-sep）保持完全一致的视觉
 * —— 主色、55% 不透明度、12px。否则同一个 / 在一行里出现两种深浅会很脏。
 */
.box-breadcrumb :deep(.el-breadcrumb__separator) {
  margin: 0 6px;
  color: var(--brand-accent);
  opacity: 0.55;
  font-size: 12px;
  font-weight: 600;
}

/*
 * ⚠️ Element Plus 会给可点击的面包屑项套一层 <a> 并加上自己的颜色，
 * 不覆盖的话分区名会变成默认灰、hover 时变蓝。用 :deep 穿透到组件内部。
 */
.box-breadcrumb :deep(.el-breadcrumb__inner a) {
  color: var(--brand-accent);
}

.box-breadcrumb :deep(.el-breadcrumb__inner a:hover) {
  color: var(--brand-accent);
  opacity: 0.75;
}
</style>
