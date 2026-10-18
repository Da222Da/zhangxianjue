<!-- src/views/Library/index.vue -->
<template>
  <div class="library-page">
    <header class="page-header">
      <!-- 分区标签（■ LIBRARY / 书库）已上移到面包屑，这里不再重复 -->
      <h1 class="page-title sketch-underline">书库</h1>

      <!-- 分类单选：选项从真实书籍里归纳，额外补一个「全部」 -->
      <div
        v-if="!loading && !errorMessage && books.length > 0"
        class="category-filter"
        role="radiogroup"
        aria-label="按分类筛选书籍"
      >
        <button
          type="button"
          class="filter-chip"
          :class="{ 'is-active': selectedCategory === 'all' }"
          role="radio"
          :aria-checked="selectedCategory === 'all'"
          @click="selectedCategory = 'all'"
        >
          全部
        </button>
        <button
          v-for="item in categoryOptions"
          :key="item.value"
          type="button"
          class="filter-chip"
          :class="{ 'is-active': selectedCategory === item.value }"
          role="radio"
          :aria-checked="selectedCategory === item.value"
          @click="selectedCategory = item.value"
        >
          {{ item.name }}
        </button>
      </div>
    </header>

    <!-- 加载态 -->
    <div v-if="loading" class="book-grid">
      <div v-for="index in 3" :key="index" class="book-card sketch-box">
        <el-skeleton animated>
          <template #template>
            <el-skeleton-item variant="image" class="skeleton-cover" />
            <div class="skeleton-body">
              <el-skeleton-item variant="text" style="width: 40%" />
              <el-skeleton-item variant="h3" style="width: 70%" />
              <el-skeleton-item variant="text" />
              <el-skeleton-item variant="text" style="width: 80%" />
            </div>
          </template>
        </el-skeleton>
      </div>
    </div>

    <!-- 错误态 -->
    <div v-else-if="errorMessage" class="state-box sketch-box">
      <h2>{{ errorMessage }}</h2>
      <p>请检查网络后重试。</p>
      <button type="button" class="state-button" @click="fetchBooks">重新加载</button>
    </div>

    <!-- 空态 -->
    <div v-else-if="books.length === 0" class="state-box sketch-box">
      <h2>书库还是空的</h2>
      <p>管理员添加书籍与章节后，这里会出现内容。</p>
    </div>

    <!-- 书籍卡片 -->
    <div v-else class="book-grid">
      <router-link
        v-for="(book, index) in filteredBooks"
        :key="book.id"
        class="book-card sketch-box"
        :to="{ name: 'LibraryDetail', params: { id: book.id }, query: book.title ? { title: book.title } : {} }"
      >
        <!-- 封面：顶部一条仿窗口的装饰栏，和参考图一致 -->
        <div class="book-cover" :class="`book-cover--tone-${index % 4}`">
          <div class="cover-window" aria-hidden="true">
            <span class="cover-dot"></span>
            <span class="cover-dot"></span>
            <span class="cover-dot"></span>
            <span class="cover-window__title">{{ book.title }}</span>
          </div>

          <img v-if="book.cover" :src="resolveAssetUrl(book.cover)" :alt="book.title" class="cover-image" />
          <div v-else class="cover-fallback" aria-hidden="true">
            <span class="cover-fallback__mark">{{ book.title.charAt(0) }}</span>
            <span class="cover-fallback__title">{{ book.title }}</span>
          </div>

          <!-- 右上角访问角标：限免 / VIP -->
          <AccessBadge :is-free="book.is_free" />
        </div>

        <div class="book-body">
          <div class="book-meta">
            <span class="book-index">{{ String(index + 1).padStart(2, "0") }} / {{ book.category || "未分类" }}</span>
          </div>

          <h2 class="book-title">{{ book.title }}</h2>

          <div v-if="book.tags.length > 0" class="book-tags">
            <span v-for="tag in book.tags" :key="tag.id" class="book-tag">{{ tag.name }}</span>
          </div>
          <p class="book-desc">{{ book.description || "暂无简介" }}</p>

          <div class="book-footer">
            <span class="book-chapters">
              {{ book.volume_count > 1 ? `${book.volume_count} 卷 · ` : "" }}{{ book.chapter_count }} 章
            </span>
            <span class="book-more">查看课程 <span aria-hidden="true">→</span></span>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import bookService from "@/api/bookService";
import AccessBadge from "@/components/AccessBadge.vue";
import { resolveAssetUrl } from "@/services/apiConfig";
import type { Book } from "@/types/api";

/** 分类筛选值：全部 / 未分类 / 具体分类 id */
type CategoryFilter = "all" | "uncategorized" | number;

interface CategoryOption {
  value: CategoryFilter;
  name: string;
}

const books = ref<Book[]>([]);
const loading = ref(true);
const errorMessage = ref("");
const selectedCategory = ref<CategoryFilter>("all");

/**
 * 分类选项从书籍列表归纳
 *
 * 只展示真实存在的分类（没有书籍的分类不出现），并按书籍顺序去重；
 * 若存在未分类书籍，额外补一个「未分类」。
 */
const categoryOptions = computed<CategoryOption[]>(() => {
  const seen = new Map<number, string>();
  for (const book of books.value) {
    if (book.category_id !== null && book.category) {
      seen.set(book.category_id, book.category);
    }
  }

  const options: CategoryOption[] = [...seen.entries()].map(([value, name]) => ({ value, name }));
  if (books.value.some((book) => book.category_id === null)) {
    options.push({ value: "uncategorized", name: "未分类" });
  }
  return options;
});

/** 当前分类下的书籍；「全部」直接返回原列表 */
const filteredBooks = computed<Book[]>(() => {
  if (selectedCategory.value === "all") {
    return books.value;
  }
  if (selectedCategory.value === "uncategorized") {
    return books.value.filter((book) => book.category_id === null);
  }
  return books.value.filter((book) => book.category_id === selectedCategory.value);
});

const fetchBooks = async (): Promise<void> => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await bookService.getBooks();
    books.value = res.data;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "书库加载失败";
  } finally {
    loading.value = false;
  }
};

onMounted(fetchBooks);
</script>

<style scoped>
.library-page {
  padding: 8px 0 40px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  display: inline-block;
  margin: 0;
  color: var(--text-h);
  font-size: 2rem;
  line-height: 1.3;
}

/* ===== 分类单选 ===== */
.category-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 16px 0 0;
}

.filter-chip {
  padding: 5px 16px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
  box-shadow: 2px 2px 0 var(--sketch-shadow);
  cursor: pointer;
  transition:
    background-color 0.18s,
    color 0.18s,
    transform 0.18s,
    box-shadow 0.18s;
}

/* 交替轻微倾斜，保持手绘卡片的错落感 */
.filter-chip:nth-child(odd) {
  transform: rotate(-0.4deg);
}

.filter-chip:nth-child(even) {
  transform: rotate(0.3deg);
}

.filter-chip:hover {
  transform: translate(-1px, -1px) rotate(0deg);
  box-shadow: 3px 3px 0 var(--sketch-shadow);
}

.filter-chip.is-active {
  background: var(--accent-bg);
  color: var(--brand-accent);
  transform: rotate(0deg);
  box-shadow: 3px 3px 0 var(--sketch-shadow);
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 24px;
}

.book-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text);
  text-decoration: none;
  background: var(--surface);
  transition:
    transform 0.22s,
    box-shadow 0.22s;
}

.book-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--sketch-shadow);
}

/* ===== 封面 ===== */
.book-cover {
  --access-badge-top: 34px;
  position: relative;
  aspect-ratio: 16 / 9;
  margin: -1px -1px 0;
  overflow: hidden;
  background: linear-gradient(135deg, var(--blue-soft), var(--orange-soft));
  border-bottom: var(--sketch-line) solid var(--ink);
}

.book-cover--tone-1 {
  background: linear-gradient(135deg, #e8f0e4, #d7e6d2);
}

.book-cover--tone-2 {
  background: linear-gradient(135deg, #f4e9dc, #ead7c2);
}

.book-cover--tone-3 {
  background: linear-gradient(135deg, #e5e9f4, #d5dcef);
}

.cover-window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  background: rgb(255 255 255 / 72%);
  border-bottom: 1px solid rgb(47 53 66 / 16%);
  backdrop-filter: blur(4px);
}

.cover-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
}

.cover-dot:first-child {
  background: #e07a5f;
}

.cover-window__title {
  margin-left: 4px;
  overflow: hidden;
  color: var(--text);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-fallback {
  position: absolute;
  inset: 26px 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.cover-fallback__mark {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: 16px 7px 18px 9px / 9px 18px 7px 16px;
  background: var(--surface);
  color: var(--text-h);
  font-size: 26px;
  font-weight: 700;
  transform: rotate(-3deg);
  box-shadow: 3px 3px 0 var(--sketch-shadow);
}

.cover-fallback__title {
  max-width: 80%;
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.8;
}

/* ===== 卡片正文 ===== */
.book-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 16px 18px 14px;
}

.book-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.book-index {
  color: var(--text);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.book-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 10px;
}

.book-tag {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: 10px 3px 9px 4px / 4px 9px 3px 10px;
  background: var(--accent-bg);
  color: var(--brand-accent);
  font-size: 11px;
  font-weight: 600;
}

.book-title {
  margin: 0 0 10px;
  color: var(--text-h);
  font-size: 20px;
  line-height: 1.35;
}

.book-desc {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--text);
  font-size: 14px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.book-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1.5px dashed var(--border);
  font-size: 13px;
}

.book-chapters {
  color: var(--text);
}

.book-more {
  color: var(--brand-accent);
  font-weight: 600;
}

/* ===== 状态框 ===== */
.state-box {
  padding: 40px 28px;
  text-align: center;
  background: var(--surface);
}

.state-box h2 {
  margin: 0 0 10px;
  color: var(--text-h);
  font-size: 20px;
}

.state-box p {
  margin: 0 0 18px;
  color: var(--text);
  font-size: 14px;
}

.state-button {
  display: inline-flex;
  padding: 9px 18px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  background: var(--accent-bg);
  color: var(--text-h);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 2px 2px 0 var(--sketch-shadow);
  cursor: pointer;
}

.skeleton-cover {
  width: 100%;
  aspect-ratio: 16 / 9;
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}

@media (max-width: 640px) {
  .page-title {
    font-size: 1.6rem;
  }

  .category-filter {
    gap: 8px;
    margin-top: 14px;
  }

  .filter-chip {
    padding: 4px 12px;
    font-size: 12px;
  }

  .book-grid {
    grid-template-columns: 1fr;
  }
}
</style>
