<template>
  <div class="article-detail">
    <!-- 加载态 -->
    <el-skeleton v-if="loading" :rows="8" animated />

    <!-- 错误态：文章不存在或链接非法 -->
    <el-result v-else-if="errorMessage" icon="warning" :title="errorMessage" sub-title="请检查链接，或返回笔记列表重新进入">
      <template #extra>
        <el-button type="primary" @click="goNotes">返回攻略笔记</el-button>
      </template>
    </el-result>

    <template v-else-if="article">
      <!--
        前往笔记：仅当文章关联了笔记时出现，样式对齐参考站的「← 返回疑难解决」
        —— 无边框的主色文字链接，放在标题上方。
        query.title 让笔记详情页的面包屑直接显示笔记标题，而不是「笔记详情」。
      -->
      <router-link v-if="article.note_id !== null" class="back-link" :to="noteLink">
        <span class="back-arrow" aria-hidden="true">←</span>
        前往笔记
      </router-link>

      <el-image v-if="article.cover" :src="resolveAssetUrl(article.cover)" fit="cover" class="article-cover" />

      <h1 class="article-title">{{ article.title }}</h1>

      <div class="article-meta">
        <el-tag v-if="article.category" size="small" type="info">{{ article.category }}</el-tag>
        <span class="meta-item">发布于 {{ formatDate(article.createdAt) }}</span>
        <span v-if="article.updatedAt !== article.createdAt" class="meta-item">更新于 {{ formatDate(article.updatedAt) }}</span>
      </div>

      <p v-if="article.description" class="article-summary">{{ article.description }}</p>

      <el-divider />

      <!--
        markdown 正文：previewOnly 模式为只读渲染，自带悬浮目录，
        其布局随页面滚动（见包内 modes/preview.ts 的 toc.position 说明），
        因此这里刻意不给固定高度，让内容自然撑开。
      -->
      <div class="markdown-body">
        <Markdown :model-value="article.content" mode="previewOnly" toc-mode="auto" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
// 局部引入而非全局注册：markdown 渲染器（含 markdown-it / katex）
// 放在这里可随本路由懒加载，不拖累首页与列表页
import { Markdown } from "@zhangxianjue/markdown";
import "@zhangxianjue/markdown/style.css";
// 公式字体与排版由宿主引入：库模式不允许把 KaTeX 的 @font-face 外置成独立文件
import "katex/dist/katex.min.css";
import articleService from "@/api/articleService";
import { resolveAssetUrl } from "@/services/apiConfig";
import { formatDate } from "@/util/index.ts";
import type { Article } from "@/types/api";

/** 由路由参数注入（router 中该路由开启了 props: true） */
const props = defineProps<{
  id: string;
}>();

const router = useRouter();

const article = ref<Article | null>(null);
const loading = ref(true);
const errorMessage = ref("");

/**
 * 「前往笔记」的跳转目标
 *
 * query.title 让笔记详情页的面包屑显示笔记标题（与从卡片墙进入时一致），
 * note_title 由服务端关联查出；未关联时给出列表页作为兜底（正常不会走到）。
 */
const noteLink = computed(() => {
  const noteId = article.value?.note_id;
  if (noteId === null || noteId === undefined) {
    return { name: "Notes" };
  }
  const title = article.value?.note_title;
  return {
    name: "NotesDetail",
    params: { id: noteId },
    query: title ? { title } : {},
  };
});

const fetchArticle = async (): Promise<void> => {
  const id = Number(props.id);
  if (!Number.isInteger(id) || id <= 0) {
    article.value = null;
    errorMessage.value = "文章链接无效";
    loading.value = false;
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await articleService.getDetail(id);
    article.value = res.data;
  } catch (error) {
    article.value = null;
    // 服务端文案如「文章不存在」，可直接展示
    errorMessage.value = error instanceof Error ? error.message : "文章加载失败";
  } finally {
    loading.value = false;
  }
};

const goNotes = (): void => {
  router.push({ name: "Notes" });
};

onMounted(() => {
  fetchArticle();
});

// 停留在详情页内切换到另一篇时（id 变化但组件复用）需要重新拉取
watch(
  () => props.id,
  () => {
    fetchArticle();
  },
);
</script>

<style scoped>
.article-detail {
  padding: 8px 0 32px;
}

/*
 * 前往笔记：样式对齐参考站的「← 返回疑难解决」
 * —— 无边框的主色文字链接，与面包屑的分区色属于同一套视觉。
 * 颜色走令牌，深色模式下自动提亮（--brand-accent 在 :root[theme=dark] 里被覆盖）。
 */
.back-link {
  /*
   * ⚠️ 必须是 flex（块级）而不是 inline-flex：下面的 h1 用了 inline-block 做手绘标题框，
   * 两者同为行内级时会被排到同一行，链接就跑到标题左边去了。
   */
  display: flex;
  width: fit-content;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  color: var(--brand-accent);
  font-size: 14px;
  line-height: 1.2;
  text-decoration: none;
}

.back-link:hover,
.back-link:focus-visible {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.back-arrow {
  font-size: 15px;
  line-height: 1;
}

/* 正文纸张：与全站手绘卡片同一套墨线 + 错位投影，布局随页面滚动 */
.markdown-body {
  min-height: 200px;
  padding: 24px 28px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  background: var(--surface);
  box-shadow: 4px 4px 0 var(--sketch-shadow);
}

@media (max-width: 640px) {
  .markdown-body {
    padding: 16px;
  }
}

/* 封面套一层手绘相框：墨线描边 + 错位投影 */
.article-cover {
  width: 100%;
  max-height: 320px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  box-shadow: 4px 4px 0 var(--sketch-shadow);
  margin-bottom: 20px;
}

/* 详情标题做成手绘「根节点」的样子 */
.article-title {
  display: inline-block;
  margin: 0 0 18px;
  padding: 6px 16px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  background: var(--surface);
  box-shadow: 3px 3px 0 var(--sketch-shadow);
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.4;
}

.article-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.meta-item {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

/* 摘要：左侧用橙色粗笔触做强调，其余三边维持淡淡的墨线 */
.article-summary {
  margin: 0 0 8px;
  padding: 10px 14px;
  border: 1.5px solid var(--border);
  border-left: 4px solid var(--orange);
  border-radius: 10px 4px 12px 5px / 5px 12px 4px 10px;
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  line-height: 1.6;
}
</style>
