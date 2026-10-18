<template>
  <div class="library-page">
    <!-- ===== 搜索区 ===== -->
    <section class="hero">
      <div class="hero-mark" aria-hidden="true">
        <el-icon :size="28"><Search /></el-icon>
      </div>

      <h1 class="hero-title sketch-underline">文章库</h1>
      <p class="hero-subtitle">一键直达，搜遍全站文章</p>

      <form class="search-box" @submit.prevent="handleSubmit">
        <el-icon class="search-icon" :size="20"><Search /></el-icon>
        <input v-model="keyword" class="search-input" type="search" placeholder="输入关键词搜索文章…" aria-label="搜索文章" @input="scheduleSearch" />
        <button class="search-button" type="submit">搜索</button>
      </form>
    </section>

    <!-- ===== 分类标签（两级联动） ===== -->
    <!--
      分类筛选期间保持可见：点根分类会立刻出结果，如果这里同时隐藏，
      第 2 层就永远没机会被点到。关键词搜索时才让位给结果列表。
    -->
    <section v-if="showCategoryPanel" class="category-section">
      <h2 class="section-title sketch-marker">分类</h2>
      <p v-if="categories.length === 0" class="panel-empty">暂无分类</p>

      <template v-else>
        <div class="chips">
          <button
            v-for="root in categories"
            :key="root.id"
            type="button"
            class="chip"
            :class="{ 'chip--expanded': activeRootId === root.id, 'chip--active': submitted?.categoryId === root.id }"
            @click="selectRootCategory(root)"
          >
            {{ root.name }}
            <span v-if="root.children.length > 0" class="chip-caret" aria-hidden="true">{{ activeRootId === root.id ? "▾" : "▸" }}</span>
          </button>
        </div>

        <!-- 第 2 层：只渲染直接子分类，更深层级不展示但仍会被父级搜索命中 -->
        <div v-if="childCategories.length > 0" class="chips chips--children">
          <button
            v-for="child in childCategories"
            :key="child.id"
            type="button"
            class="chip chip--child"
            :class="{ 'chip--active': submitted?.categoryId === child.id }"
            @click="selectChildCategory(child)"
          >
            {{ child.name }}
          </button>
        </div>
      </template>
    </section>

    <!-- ===== 搜索结果 ===== -->
    <section v-if="submitted" class="result-section">
      <div class="result-header">
        <h2 class="section-title">
          {{ resultTitle }}
          <span v-if="!loading && !errorMessage" class="result-count">共 {{ articles.length }} 篇</span>
        </h2>
        <el-button link type="primary" @click="resetSearch">返回</el-button>
      </div>

      <el-skeleton v-if="loading" :rows="4" animated />

      <el-alert v-else-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon>
        <template #default>
          <el-button link type="primary" @click="retry">重新搜索</el-button>
        </template>
      </el-alert>

      <el-empty v-else-if="articles.length === 0" description="没有找到匹配的文章" />

      <ul v-else class="result-list">
        <li v-for="item in articles" :key="item.id" class="result-item" @click="openArticle(item)">
          <div class="result-main">
            <h3 class="result-title">
              <template v-for="(part, index) in highlightParts(item.title, activeKeyword)" :key="index">
                <mark v-if="part.match" class="hit">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </template>
            </h3>
            <p class="result-desc">
              <template v-for="(part, index) in highlightParts(item.description || '暂无摘要', activeKeyword)" :key="index">
                <mark v-if="part.match" class="hit">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </template>
            </p>
          </div>
          <div class="result-meta">
            <el-tag v-if="item.category" size="small" type="info">{{ item.category }}</el-tag>
            <span class="result-time">{{ formatDate(item.updatedAt) }}</span>
          </div>
        </li>
      </ul>
    </section>

  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Search } from "@element-plus/icons-vue";
import articleService from "@/api/articleService";
import categoryService from "@/api/categoryService";
import { formatDate } from "@/util/index.ts";
import type { Article, CategoryTreeNode } from "@/types/api";

/** 单次拉取上限，与 server 的 MAX_PAGE_SIZE 对齐 */
const PAGE_SIZE = 100;

/** 一次搜索的筛选条件。keyword 与 categoryId 互斥使用 */
interface SearchQuery {
  keyword: string;
  categoryId: number | null;
  /** 结果标题展示用的可读标签：关键词本身，或「父 / 子」形式的分类路径 */
  label: string;
}

const router = useRouter();

const keyword = ref("");
const categories = ref<CategoryTreeNode[]>([]);
const articles = ref<Article[]>([]);
/** null 表示尚未搜索，展示分类标签 */
const submitted = ref<SearchQuery | null>(null);
const loading = ref(false);
const errorMessage = ref("");
/** 当前展开的根分类 id；null 表示尚未展开任何一级 */
const activeRootId = ref<number | null>(null);

const resultTitle = computed(() => {
  if (!submitted.value) {
    return "";
  }
  return submitted.value.categoryId !== null ? `分类：${submitted.value.label}` : `搜索：${submitted.value.label}`;
});

/** 当前生效的关键词；按分类筛选时为空，此时结果不做高亮 */
const activeKeyword = computed(() => submitted.value?.keyword ?? "");

/**
 * 分类区是否可见
 *
 * - 未搜索：展示分类，供浏览
 * - 按分类搜索：保持可见，这样点完根分类后第 2 层仍在页面上，可以继续细化
 * - 按关键词搜索：隐藏，把版面让给结果
 */
const showCategoryPanel = computed(() => !submitted.value || submitted.value.categoryId !== null);

/** 当前展开的根分类的直接子分类（第 2 层） */
const childCategories = computed<CategoryTreeNode[]>(() => {
  if (activeRootId.value === null) {
    return [];
  }
  return categories.value.find((node) => node.id === activeRootId.value)?.children ?? [];
});

/** 转义正则元字符，避免用户输入 `.*` 之类把匹配搞乱 */
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface HighlightPart {
  text: string;
  match: boolean;
}

/**
 * 把命中关键词的片段切出来供模板高亮
 *
 * 用带捕获组的 split：结果按「非命中 / 命中 / 非命中 …」交替排列，
 * 因此奇数下标就是命中片段。大小写不敏感，与服务端 LIKE 的行为一致。
 */
const highlightParts = (text: string, term: string): HighlightPart[] => {
  if (!term) {
    return [{ text, match: false }];
  }

  return text
    .split(new RegExp(`(${escapeRegExp(term)})`, "gi"))
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((part) => part.text !== "");
};

/**
 * 分类拉取失败时降级为空，不阻塞搜索主流程
 *
 * 数据源是真实的分类表（/admin/category），不再从文章里反推分类名。
 */
const fetchCategories = async (): Promise<void> => {
  try {
    const res = await categoryService.getTree();
    categories.value = res.data;
  } catch {
    categories.value = [];
  }
};

/** 请求序号：输入即搜会产生并发请求，只采纳最后一次的结果 */
let requestSeq = 0;

const runSearch = async (query: SearchQuery): Promise<void> => {
  const seq = ++requestSeq;

  submitted.value = query;
  loading.value = true;
  errorMessage.value = "";

  try {
    const res = await articleService.getList({
      keyword: query.keyword || undefined,
      category_id: query.categoryId ?? undefined,
      pageSize: PAGE_SIZE,
    });
    // 过期响应直接丢弃，否则慢请求可能覆盖掉后发起的搜索结果
    if (seq !== requestSeq) {
      return;
    }
    articles.value = res.data;
  } catch (error) {
    if (seq !== requestSeq) {
      return;
    }
    articles.value = [];
    errorMessage.value = error instanceof Error ? error.message : "搜索失败";
  } finally {
    if (seq === requestSeq) {
      loading.value = false;
    }
  }
};

/** 输入防抖定时器 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const cancelDebounce = (): void => {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
};

/**
 * 输入即搜（防抖 300ms）
 *
 * ✅ 服务端本来就是 `LIKE %keyword%` 的模糊匹配，缺的是「不用按回车」。
 * ⚠️ 用 `@input` 而不是 `watch(keyword)`：分类标签会以代码方式改写
 *    `keyword`，用 watch 会连带触发一次自动搜索，还要额外处理时序。
 */
const scheduleSearch = (): void => {
  cancelDebounce();

  const term = keyword.value.trim();
  if (!term) {
    // 清空输入框时回到分类标签
    resetSearch();
    return;
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runSearch({ keyword: term, categoryId: null, label: term });
  }, 300);
};

/** 搜索框提交：空白关键词不发起请求 */
const handleSubmit = (): void => {
  const term = keyword.value.trim();
  if (!term) {
    return;
  }
  // 已经手动提交，取消待触发的自动搜索，避免重复请求
  cancelDebounce();
  void runSearch({ keyword: term, categoryId: null, label: term });
};

/**
 * 点击根分类：展开第 2 层，并立即按该分类（含全部子孙）搜索
 *
 * ✅ 决策：展开与搜索合并为一次点击。分类区在分类搜索期间保持可见，
 *    所以展开出来的子分类不会被结果页挤掉，可以接着点第 2 层继续细化。
 */
const selectRootCategory = (root: CategoryTreeNode): void => {
  activeRootId.value = root.id;
  cancelDebounce();
  keyword.value = "";
  void runSearch({ keyword: "", categoryId: root.id, label: root.name });
};

/** 点击子分类：细化筛选，结果标题展示「父 / 子」以区分同名分类 */
const selectChildCategory = (child: CategoryTreeNode): void => {
  const root = categories.value.find((node) => node.id === activeRootId.value);
  cancelDebounce();
  keyword.value = "";
  void runSearch({
    keyword: "",
    categoryId: child.id,
    label: root ? `${root.name} / ${child.name}` : child.name,
  });
};

const retry = (): void => {
  if (submitted.value) {
    void runSearch(submitted.value);
  }
};

const resetSearch = (): void => {
  submitted.value = null;
  keyword.value = "";
  articles.value = [];
  errorMessage.value = "";
  activeRootId.value = null;
};

/**
 * 打开文章详情
 *
 * 把标题带进 query，详情页的 meta.title 据此显示面包屑末端。
 */
const openArticle = (article: Article): void => {
  router.push({
    name: "ArticlesDetail",
    params: { id: String(article.id) },
    query: { title: article.title },
  });
};

onMounted(() => {
  void fetchCategories();
});

// 组件卸载时清掉待触发的防抖任务，避免离开页面后仍发起请求
onBeforeUnmount(cancelDebounce);
</script>

<style scoped>
.library-page {
  padding: 8px 0 48px;
}

/* ===== 搜索区 ===== */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0 8px;
  text-align: center;
}

/* 手绘徽标：纸底 + 墨线描边 + 蓝色图标，轻微倾斜 */
.hero-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: 18px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: 18px 8px 20px 10px / 10px 20px 8px 18px;
  background: var(--surface);
  color: var(--brand-accent);
  box-shadow: 4px 4px 0 var(--sketch-shadow);
  transform: rotate(-2deg);
}

.hero-title {
  /* 底部留出 18px：手绘波浪下划线画在文字下方 8px 处，太近会压到副标题 */
  margin: 0 0 18px;
  color: var(--text-h);
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.hero-subtitle {
  margin: 0;
  color: var(--text);
  font-size: 14px;
}

/* 搜索框：一条手画的粗轮廓，投影向右下错开，像贴了张纸 */
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(720px, 100%);
  height: 56px;
  margin: 26px auto 0;
  padding: 0 8px 0 18px;
  box-sizing: border-box;
  background: var(--surface);
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius);
  box-shadow: 4px 4px 0 var(--sketch-shadow);
}

.search-icon {
  flex-shrink: 0;
  color: var(--text);
}

.search-input {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-h);
  font-size: 15px;
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--el-text-color-placeholder);
}

.search-button {
  flex-shrink: 0;
  height: 42px;
  padding: 0 26px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  background: var(--brand-accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  box-shadow: 2px 2px 0 var(--sketch-shadow);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
}

.search-button:hover {
  opacity: 0.92;
}

/* 按下时向左上压进去一格，抵消投影 */
.search-button:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

/* ===== 分类标签 ===== */
.category-section {
  max-width: 980px;
  margin: 40px auto 0;
  padding-top: 28px;
  border-top: 1.5px dashed var(--border);
}

.section-title {
  margin: 0 0 14px;
  color: var(--text-h);
  font-size: 14px;
  font-weight: 600;
}

.panel-empty {
  margin: 0;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* 分类标签：手绘小纸片，描边不圆 */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 6px 14px;
  overflow: hidden;
  border: 1.4px solid var(--ink);
  border-radius: 12px 4px 11px 5px / 5px 11px 4px 12px;
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s, background 0.2s, transform 0.15s, box-shadow 0.15s;
}

.chip:hover {
  background: var(--brand-accent-soft);
  color: var(--brand-accent);
  transform: translateY(-1px);
  box-shadow: 2px 2px 0 var(--sketch-shadow);
}

.chip:active {
  transform: translateY(0);
  box-shadow: none;
}

/* 已展开的根分类：弱高亮，表示「下面这行属于它」，不等同于当前筛选 */
.chip--expanded,
.chip--expanded:hover {
  background: var(--brand-accent-soft);
  color: var(--brand-accent);
}

/* 当前正在生效的筛选（根分类或子分类）：实心主色。写在 expanded 之后，两者同时命中时以它为准 */
.chip--active,
.chip--active:hover {
  background: var(--brand-accent);
  color: #fff;
}

/*
 * 第 2 层：用左侧竖线表达层级归属（比缩进更不易被误认为独立分组）
 * 只渲染直接子分类，更深的层级不在界面上出现。
 */
.chips--children {
  margin-top: 10px;
  padding-left: 14px;
  border-left: 1.5px dashed var(--border);
}

.chip--child {
  font-size: 12.5px;
}

.chip-caret {
  font-size: 10px;
  line-height: 1;
  opacity: 0.7;
}

/* ===== 搜索结果 ===== */
.result-section {
  max-width: 900px;
  margin: 36px auto 0;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.result-count {
  margin-left: 8px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  font-weight: 400;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 结果条目：与笔记卡片同一套手绘纸片 */
.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1.4px solid var(--border);
  border-radius: 12px 5px 13px 6px / 6px 13px 5px 12px;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
}

.result-item:hover {
  border-color: var(--brand-accent);
  transform: translateY(-1px);
  box-shadow: 3px 3px 0 var(--sketch-shadow);
}

.result-main {
  min-width: 0;
}

.result-title {
  margin: 0 0 6px;
  color: var(--text-h);
  font-size: 15px;
  font-weight: 600;
}

.result-desc {
  margin: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.result-meta {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
}

.result-time {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

/* 命中关键词：橙色记号笔效果。覆盖 mark 默认的黄底 */
.hit {
  padding: 0 2px;
  border-radius: 3px 1px 4px 1px;
  background: var(--orange-soft);
  color: var(--ink);
  box-shadow: inset 0 -0.45em 0 var(--orange-soft);
}

@media (max-width: 768px) {
  .search-button {
    padding: 0 18px;
  }
}
</style>
