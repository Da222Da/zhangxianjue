<!-- src/components/Header.vue -->
<template>
  <header class="site-header">
    <div class="header-inner">
      <!--
        品牌区：只保留图标，回到首页。
        ⚠️ 纯图标链接必须给 aria-label，否则读屏软件读不出可访问名称。
      -->
      <router-link to="/timeline" class="brand" aria-label="返回首页">
        <!--
          品牌图标与浏览器 favicon 是**同一个文件**，改一处两边同时生效。
          alt 留空 + aria-hidden：链接本身已有 aria-label，图标纯装饰。
          外面套一层手绘纸片：logo 线条很细，直接贴在页面上会显得单薄。
        -->
        <span class="brand-badge" aria-hidden="true">
          <img class="brand-mark" src="/favicon.svg" alt="" />
        </span>
      </router-link>

      <!-- 主导航：当前项加深加粗，并在文字下方带一条主色下划线 -->
      <nav class="site-nav">
        <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item" :class="{ 'is-active': item.section === activeSection }">
          {{ item.label }}
        </router-link>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

/**
 * 导航项 = 带 `meta.section.navOrder` 的路由
 *
 * ✅ 决策：从路由表派生，菜单和面包屑共用同一份 `meta.section`，
 * 不用在两处各维护一份「路径 → 文案」的映射。新增导航项只需在路由 meta 里
 * 补一个 `navOrder`，详情页不带 navOrder 所以不会混进导航。
 *
 * ⚠️ 必须按 navOrder 排序：`router.getRoutes()` 的返回顺序由路由匹配器决定，
 * 与路由表里的声明顺序无关（实测动态参数路由会排在静态路由前面）。
 */
const navItems = computed(() =>
  router
    .getRoutes()
    .filter((record) => record.meta.section?.navOrder !== undefined && record.meta.section.to)
    .sort((a, b) => (a.meta.section?.navOrder ?? 0) - (b.meta.section?.navOrder ?? 0))
    .map((record) => ({
      to: record.meta.section?.to ?? record.path,
      label: record.meta.section?.zh ?? "",
      section: record.meta.section?.en ?? "",
    })),
);

/**
 * 当前路由所属分区
 *
 * ⚠️ 这里刻意**不用** router-link 自带的 `.router-link-active`：
 * vue-router 的判定是「链接目标的路由记录是否出现在当前 matched 里」
 * （见其 activeRecordIndex 实现）。`/notes` 与 `/notes/:id` 是兄弟记录而不是父子，
 * 所以在详情页里 `/notes` 的链接**不会被判定为 active**。
 *
 * 改为按 `meta.section.en` 判定后，详情页共享所属分区的 section，
 * 因此在 `/notes/1` 时「攻略笔记」依然高亮。
 */
const activeSection = computed(() => route.meta.section?.en);
</script>

<style scoped>
.site-header {
  /*
   * 用主题令牌而非写死 #fff：style.css 里有 prefers-color-scheme 深色分支，
   * 写死白色会让深色模式下头部糊成一块白板
   */
  position: relative;
  background: var(--surface);

  /*
   * ⚠️ 高度必须落在 .site-header 上并配合 border-box：
   * Layout 的内容区高度是 calc(100vh - var(--header-height))，
   * 头的实际高度一旦比令牌多 1px，页面总高就会变成 100vh + 1px，触发整页纵向滚动条。
   * 因此底边改用绝对定位的 ::after 画（不占高度），而不是 border-bottom。
   */
  height: var(--header-height);
  box-sizing: border-box;
}

/* 手绘波浪底边：用 mask 画一条抖动的线，颜色跟随 --border，深浅色自动适配 */
.site-header::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 6px;
  background-color: var(--border);
  -webkit-mask: var(--squiggle) repeat-x;
  mask: var(--squiggle) repeat-x;
  -webkit-mask-size: 48px 6px;
  mask-size: 48px 6px;
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 40px;
  max-width: var(--content-max-width);
  /* 跟随父级，父级已把 1px 边框算进 --header-height */
  height: 100%;
  margin: 0 auto;
  padding: 0 24px;
  /* ⚠️ 必须显式声明：全局没有 box-sizing 重置，默认 content-box 会让
     实际宽度变成 max-width + 左右各 24px，与下方内容区错位 */
  box-sizing: border-box;
}

/* ===== 品牌区（纯图标）===== */
.brand {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  text-decoration: none;
}

/* 手绘纸片底座：给细线条的 logo 一个轮廓，同时呼应页面的纸张语言 */
.brand-badge {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: 14px 6px 16px 8px / 8px 16px 6px 14px;
  background: var(--surface);
  box-shadow: 2px 2px 0 var(--sketch-shadow);
  transform: rotate(-2deg);
  transition: transform 0.25s;
}

.brand:hover .brand-badge {
  transform: rotate(-2deg) scale(1.05);
}

/* 图标本身复用 favicon.svg（柑橘生命周期环） */
.brand-mark {
  display: block;
  width: 46px;
  height: 46px;
}

/* ===== 主导航 ===== */
.site-nav {
  display: flex;
  align-items: center;
  gap: 28px;
  /* 把导航推到右侧，替代原来挂在 el-menu-item 上的 margin-right: auto */
  margin-left: auto;
}

.nav-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 8px 0;
  color: var(--text);
  font-size: 15px;
  text-decoration: none;
  transition: color 0.2s;
}

.nav-item:hover {
  color: var(--text-h);
}

/* 选中态由 meta.section 判定，不依赖 router-link-active，原因见 script 中的说明 */
.nav-item.is-active {
  color: var(--text-h);
  font-weight: 600;
}

/* 选中下划线贴着文字留 8px 间距（= padding 的下边界），而不是贴头部底边 */
.nav-item.is-active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 5px;
  background-color: var(--brand-accent);
  /* 手绘波浪线：与标题下划线同一套笔触 */
  -webkit-mask: var(--squiggle) repeat-x;
  mask: var(--squiggle) repeat-x;
  -webkit-mask-size: 36px 5px;
  mask-size: 36px 5px;
}

@media (max-width: 768px) {
  .header-inner {
    gap: 16px;
    padding: 0 16px;
  }

  .site-nav {
    gap: 18px;
  }
}
</style>
