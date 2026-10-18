<!-- src/views/LibraryDetail/index.vue -->
<template>
  <div class="library-detail">
    <!-- 加载 / 错误 -->
    <div v-if="loadingBook" class="chapter-main sketch-box">
      <el-skeleton :rows="8" animated />
    </div>

    <div v-else-if="forbidden" class="state-box sketch-box">
      <h2>本书为 VIP 专属</h2>
      <p>开通会员或联系管理员获取阅读权益后，即可阅读全部章节。</p>
      <div class="state-actions">
        <router-link
          class="state-button"
          :to="{ name: 'Account', query: { upgrade: '1', redirect: route.fullPath } }"
        >
          前往申请会员 →
        </router-link>
        <router-link class="state-button" :to="{ name: 'Library' }">返回书库</router-link>
      </div>
    </div>

    <div v-else-if="errorMessage" class="state-box sketch-box">
      <h2>{{ errorMessage }}</h2>
      <p>请检查链接，或返回书库重新选择。</p>
      <router-link class="state-button" :to="{ name: 'Library' }">返回书库</router-link>
    </div>

    <div v-else-if="book" class="reader-layout">
      <!-- 左：章节导航 -->
      <aside class="chapter-nav sketch-box">
        <p class="nav-eyebrow">COURSE EXPLORER</p>
        <h1 class="nav-book-title">{{ book.title }}</h1>
        <p v-if="book.category || book.tags.length > 0" class="nav-book-meta">
          <span v-if="book.category">{{ book.category }}</span>
          <span v-for="tag in book.tags" :key="tag.id" class="nav-level">{{ tag.name }}</span>
        </p>

        <nav class="nav-list">
          <section v-for="volume in book.volumes" :key="volume.id" class="nav-volume">
            <!-- 只有一卷时不展示卷名（通常是迁移生成的「默认分卷」），多卷时才需要分组标题 -->
            <p v-if="showVolumeTitles" class="nav-volume-title">{{ volume.title }}</p>
            <button
              v-for="item in volume.chapters"
              :key="item.id"
              type="button"
              class="nav-item"
              :class="{ 'is-active': item.id === selectedChapterId }"
              @click="selectChapter(item)"
            >
              <span class="nav-index">{{ chapterNumberById.get(item.id) }}</span>
              <span class="nav-title">{{ item.title }}</span>
            </button>
            <p v-if="volume.chapters.length === 0" class="nav-volume-empty">本卷暂无章节</p>
          </section>
        </nav>

        <p v-if="allChapters.length === 0" class="nav-empty">本书还没有章节</p>
      </aside>

      <!-- 右：章节正文 -->
      <main class="chapter-main sketch-box">
        <div class="chapter-position">
          <span class="position-label">课程位置</span>
          <span class="position-value">
            <template v-if="showVolumeTitles && currentVolumeTitle">{{ currentVolumeTitle }} · </template>第
            {{ selectedIndex + 1 }} / {{ allChapters.length }} 节
          </span>
        </div>
        <div class="progress" aria-hidden="true">
          <div class="progress-bar" :style="{ width: progressPercent }"></div>
        </div>

        <template v-if="chapter">
          <h2 class="chapter-title">{{ chapter.title }}</h2>

          <div v-if="chapter.summary" class="chapter-summary">
            <strong>本节内容</strong>
            <p>{{ chapter.summary }}</p>
          </div>

          <div v-loading="loadingChapter" class="chapter-content">
            <Markdown v-if="chapter.content" :model-value="chapter.content" mode="previewOnly" toc-mode="off" />
            <p v-else class="content-empty">本章暂无正文。</p>
          </div>

          <div class="chapter-actions">
            <button type="button" class="action-button" :disabled="selectedIndex <= 0" @click="goRelative(-1)">← 上一节</button>
            <button
              type="button"
              class="action-button is-primary"
              :disabled="selectedIndex < 0 || selectedIndex >= allChapters.length - 1"
              @click="goRelative(1)"
            >
              下一节 →
            </button>
          </div>
        </template>

        <el-skeleton v-else :rows="6" animated />
      </main>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
// 局部引入：markdown 渲染器（含 markdown-it / katex）随本路由懒加载
import { Markdown } from "@zhangxianjue/markdown";
import "@zhangxianjue/markdown/style.css";
import "katex/dist/katex.min.css";
import bookService from "@/api/bookService";
import type { BookDetail, ChapterDetail, ChapterListItem } from "@/types/api";

/** 由路由参数注入（router 中该路由开启了 props: true） */
const props = defineProps<{
  id: string;
}>();

const route = useRoute();
const router = useRouter();

const book = ref<BookDetail | null>(null);
const chapter = ref<ChapterDetail | null>(null);
const selectedChapterId = ref<number | null>(null);
const loadingBook = ref(true);
const loadingChapter = ref(false);
const errorMessage = ref("");
/** 当前书籍为 VIP 专属且访客无阅读权益（服务端 403） */
const forbidden = ref(false);

/** 章节请求序号：快速点击时只采纳最后一次响应，避免旧响应覆盖新章节 */
let chapterRequestSeq = 0;

/** 跨分卷展平后的章节列表：上一节 / 下一节与进度条都以它为顺序 */
const allChapters = computed<ChapterListItem[]>(() =>
  (book.value?.volumes ?? []).flatMap((volume) => volume.chapters),
);

/** 全局章节序号（跨分卷连续编号），避免每卷都从 00 开始 */
const chapterNumberById = computed<Map<number, string>>(() => {
  const map = new Map<number, string>();
  allChapters.value.forEach((chapter, index) => {
    map.set(chapter.id, String(index + 1).padStart(2, "0"));
  });
  return map;
});

/** 只有一卷时视为「没有分卷」，导航与位置信息都不显示卷名 */
const showVolumeTitles = computed(() => (book.value?.volumes.length ?? 0) > 1);

const selectedIndex = computed(() => allChapters.value.findIndex((item) => item.id === selectedChapterId.value));

/** 当前章节所属分卷的标题，用于「课程位置」 */
const currentVolumeTitle = computed(() => {
  const chapterId = selectedChapterId.value;
  if (chapterId === null) {
    return "";
  }
  return book.value?.volumes.find((volume) => volume.chapters.some((chapter) => chapter.id === chapterId))?.title ?? "";
});

const progressPercent = computed(() => {
  const total = allChapters.value.length;
  if (total === 0 || selectedIndex.value < 0) {
    return "0%";
  }
  return `${((selectedIndex.value + 1) / total) * 100}%`;
});

/** 从 query 里取合法的章节 id */
const resolveChapterFromQuery = (bookDetail: BookDetail): number | null => {
  const raw = route.query.chapter;
  if (typeof raw !== "string") {
    return null;
  }
  const id = Number(raw);
  const chapters = bookDetail.volumes.flatMap((volume) => volume.chapters);
  return chapters.some((item) => item.id === id) ? id : null;
};

/** 拉取章节正文 */
const loadChapter = async (chapterId: number): Promise<void> => {
  const bookId = Number(props.id);
  const seq = ++chapterRequestSeq;

  selectedChapterId.value = chapterId;
  loadingChapter.value = true;
  try {
    const res = await bookService.getChapterDetail(bookId, chapterId);
    if (seq !== chapterRequestSeq) {
      return;
    }
    chapter.value = res.data;
  } catch (error) {
    if (seq === chapterRequestSeq) {
      chapter.value = null;
      errorMessage.value = error instanceof Error ? error.message : "章节加载失败";
    }
  } finally {
    if (seq === chapterRequestSeq) {
      loadingChapter.value = false;
    }
  }
};

/** 切换章节：同步到 URL，刷新 / 分享后仍停在当前节 */
const selectChapter = async (item: ChapterListItem): Promise<void> => {
  if (item.id === selectedChapterId.value) {
    return;
  }

  await loadChapter(item.id);
  await router.replace({
    query: {
      ...route.query,
      chapter: String(item.id),
    },
  });
};

/** 上一节 / 下一节（跨分卷连续） */
const goRelative = (offset: number): void => {
  const target = allChapters.value[selectedIndex.value + offset];
  if (target) {
    void selectChapter(target);
  }
};

/** 拉取书籍与章节 */
const fetchBook = async (): Promise<void> => {
  const bookId = Number(props.id);
  if (!Number.isInteger(bookId) || bookId <= 0) {
    errorMessage.value = "书籍链接无效";
    loadingBook.value = false;
    return;
  }

  loadingBook.value = true;
  errorMessage.value = "";
  forbidden.value = false;
  chapter.value = null;
  try {
    const res = await bookService.getBookDetail(bookId);
    book.value = res.data;

    const fromQuery = resolveChapterFromQuery(res.data);
    const chapters = res.data.volumes.flatMap((volume) => volume.chapters);
    const target = fromQuery ?? chapters[0]?.id;
    if (target !== undefined) {
      await loadChapter(target);
    }
  } catch (error) {
    book.value = null;
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 403) {
      forbidden.value = true;
    } else {
      errorMessage.value = error instanceof Error ? error.message : "书籍加载失败";
    }
  } finally {
    loadingBook.value = false;
  }
};

onMounted(fetchBook);

// 在书库中切换到另一本书时组件会复用，需要重新拉取
watch(
  () => props.id,
  () => {
    void fetchBook();
  },
);
</script>

<style scoped>
.library-detail {
  padding: 8px 0 40px;
}

.reader-layout {
  display: flex;
  align-items: flex-start;
  gap: 22px;
}

/* ===== 左侧章节导航 ===== */
.chapter-nav {
  position: sticky;
  top: 16px;
  flex: 0 0 230px;
  max-height: calc(100vh - var(--header-height) - 60px);
  padding: 18px 16px;
  overflow-y: auto;
  background: var(--surface);
}

.nav-eyebrow {
  margin: 0 0 6px;
  color: var(--text);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.18em;
  opacity: 0.7;
}

.nav-book-title {
  margin: 0 0 8px;
  color: var(--text-h);
  font-size: 16px;
  line-height: 1.4;
}

.nav-book-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 14px;
  color: var(--text);
  font-size: 12px;
}

.nav-level {
  padding: 1px 7px;
  border-radius: 8px 3px 7px 4px / 4px 7px 3px 8px;
  background: var(--accent-bg);
  color: var(--brand-accent);
  font-weight: 600;
}

.state-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 12px;
  border-top: 1.5px dashed var(--border);
}

.nav-volume + .nav-volume {
  margin-top: 10px;
}

.nav-volume-title {
  margin: 6px 0 4px;
  padding-left: 9px;
  color: var(--text);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  opacity: 0.72;
}

.nav-volume-empty {
  margin: 4px 0 8px 9px;
  color: var(--text);
  font-size: 11px;
  opacity: 0.5;
}

.nav-item {
  display: flex;
  align-items: baseline;
  gap: 9px;
  width: 100%;
  padding: 7px 9px;
  border: none;
  border-radius: var(--sketch-radius-sm);
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.nav-item:hover {
  background: var(--accent-bg);
}

.nav-item.is-active {
  background: var(--accent-bg);
  color: var(--text-h);
  font-weight: 600;
}

.nav-index {
  flex-shrink: 0;
  color: var(--text);
  font-family: var(--mono);
  font-size: 11px;
  opacity: 0.65;
}

.nav-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-empty {
  margin: 16px 0 0;
  color: var(--text);
  font-size: 12px;
  text-align: center;
  opacity: 0.7;
}

/* ===== 右侧正文 ===== */
.chapter-main {
  flex: 1;
  min-width: 0;
  padding: 22px 26px 26px;
  background: var(--surface);
}

.chapter-position {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text);
  font-size: 12px;
}

.position-label {
  font-weight: 600;
  letter-spacing: 0.04em;
}

.position-value {
  opacity: 0.8;
}

.progress {
  height: 4px;
  margin: 8px 0 26px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--border);
}

.progress-bar {
  height: 100%;
  background: var(--brand-accent);
  transition: width 0.25s ease;
}

.chapter-title {
  margin: 0 0 18px;
  color: var(--text-h);
  font-size: 1.9rem;
  line-height: 1.3;
}

.chapter-summary {
  margin: 0 0 26px;
  padding: 14px 16px;
  border-left: 4px solid #7fa56f;
  border-radius: 0 10px 10px 0;
  background: #eef4ea;
}

.chapter-summary strong {
  display: block;
  margin-bottom: 6px;
  color: #4d6b41;
  font-size: 13px;
}

.chapter-summary p {
  margin: 0;
  color: #40553a;
  font-size: 14px;
  line-height: 1.7;
}

/* 深色模式下把浅绿面板压暗，避免整块发白 */
@media (prefers-color-scheme: dark) {
  .chapter-summary {
    background: rgb(127 165 111 / 18%);
  }

  .chapter-summary strong {
    color: #b7d4a8;
  }

  .chapter-summary p {
    color: #d9e7d2;
  }
}

.chapter-content {
  min-height: 120px;
}

.content-empty {
  padding: 32px 0;
  color: var(--text);
  font-size: 14px;
  text-align: center;
  opacity: 0.7;
}

.chapter-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 30px;
  padding-top: 18px;
  border-top: 1.5px dashed var(--border);
}

.action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 18px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  background: var(--surface);
  color: var(--text-h);
  font: inherit;
  font-size: 14px;
  box-shadow: 2px 2px 0 var(--sketch-shadow);
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.action-button:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--sketch-shadow);
}

.action-button.is-primary {
  background: var(--accent-bg);
  font-weight: 600;
}

.action-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 2px 2px 0 var(--sketch-shadow);
}

@media (max-width: 900px) {
  .reader-layout {
    flex-direction: column;
  }

  .chapter-nav {
    position: static;
    flex: none;
    width: 100%;
    max-height: 260px;
    box-sizing: border-box;
  }

  .chapter-main {
    width: 100%;
    padding: 18px 16px 22px;
    box-sizing: border-box;
  }

  .chapter-title {
    font-size: 1.5rem;
  }
}
</style>
