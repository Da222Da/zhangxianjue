<template>
  <div class="notes-page">
    <!-- 加载态 -->
    <el-skeleton v-if="loading" :rows="6" animated />

    <!-- 错误态 -->
    <el-alert v-else-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon>
      <template #default>
        <el-button link type="primary" @click="fetchNotes">重新加载</el-button>
      </template>
    </el-alert>

    <template v-else>
      <header class="page-header">
        <!-- 分区标签（■ NOTES / 攻略笔记）已上移到面包屑，这里不再重复 -->
        <h1 class="page-title sketch-underline">攻略笔记</h1>
        <p class="page-subtitle">把学习过程中的思考与取舍整理成思维导图，点开卡片查看完整脑图。</p>
      </header>

      <!-- 空态 -->
      <el-empty v-if="notes.length === 0" description="暂无笔记" />

      <template v-else>
        <ul class="notes-grid">
          <li v-for="(item, index) in notes" :key="item.id" class="note-card" @click="openNote(item)">
            <div class="card-cover">
              <el-image v-if="item.cover" :src="resolveAssetUrl(item.cover)" fit="cover" lazy class="cover-img" />
              <div v-else class="cover-placeholder">暂无封面</div>
            </div>

            <div class="card-body">
              <div class="card-meta">
                <span class="card-index">{{ formatIndex(index) }} / 攻略笔记</span>
                <span v-if="item.category" class="card-tag">{{ item.category }}</span>
              </div>

              <h3 class="card-title">{{ item.title }}</h3>
              <p class="card-desc">{{ item.description || "暂无描述" }}</p>

              <div class="card-footer">
                <span class="card-time">更新于 {{ formatDate(item.updatedAt) }}</span>
                <span class="card-link">查看笔记 <span class="card-arrow">→</span></span>
              </div>
            </div>
          </li>
        </ul>

        <p v-if="truncated" class="notes-hint">笔记较多，当前仅展示前 {{ PAGE_SIZE }} 篇</p>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import noteService from "@/api/noteService";
import { resolveAssetUrl } from "@/services/apiConfig";
import { formatDate } from "@/util/index.ts";
import type { NoteListItem } from "@/types/api";

/** 单次拉取上限，与 server 的 MAX_PAGE_SIZE 对齐 */
const PAGE_SIZE = 100;

const router = useRouter();

const notes = ref<NoteListItem[]>([]);
const total = ref(0);
const loading = ref(true);
const errorMessage = ref("");

/** 列表被单页上限截断时给出提示，避免用户误以为笔记只有这些 */
const truncated = computed(() => total.value > PAGE_SIZE);

/** 卡片左上角的序号，补零到两位（01、02……） */
const formatIndex = (index: number): string => String(index + 1).padStart(2, "0");

const fetchNotes = async (): Promise<void> => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await noteService.getList({ pageSize: PAGE_SIZE });
    notes.value = res.data;
    total.value = res.total ?? res.data.length;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "笔记加载失败";
  } finally {
    loading.value = false;
  }
};

/**
 * 打开笔记详情
 *
 * 只把标题带进 query（详情页的 meta.title 据此显示面包屑末端）；
 * 分区本身由路由 meta.section 决定，不再需要 ?parent= 参数。
 * 正文不在列表里，由详情页按 id 单独拉取。
 */
const openNote = (note: NoteListItem): void => {
  router.push({
    name: "NotesDetail",
    params: { id: String(note.id) },
    query: { title: note.title },
  });
};

onMounted(() => {
  fetchNotes();
});
</script>

<style scoped>
/*
 * 配色对齐参考站：纸灰底 + 深绿点缀。
 * 刻意用局部变量而非覆盖 Element Plus 主题变量，避免影响 client 的其它页面。
 */
.notes-page {
  /* 色板已提升到全局（assets/css/style.css 的 --brand-* 与主题令牌），
     这里只做别名，避免同一组色值在 Header 和本页各写一遍、日后改一处漏一处 */
  --notes-accent: var(--brand-accent);
  --notes-accent-soft: var(--brand-accent-soft);
  --notes-border: var(--border);
  --notes-title: var(--text-h);
  --notes-text: var(--text);

  padding: 8px 0 40px;
}

/* ===== 页头 ===== */
.page-header {
  margin-bottom: 24px;
}

.page-title {
  /* 底部留 20px：手绘波浪下划线（.sketch-underline）画在文字下方 8px 处 */
  margin: 0 0 20px;
  color: var(--notes-title);
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.25;
}

.page-subtitle {
  margin: 0;
  color: var(--notes-text);
  font-size: 14px;
  line-height: 1.7;
}

/* ===== 卡片网格 ===== */
/* auto-fill 让列数随容器宽度自适应：窄屏自动降到 2 列 / 1 列，无需 media query */
.notes-grid {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px;
}

/*
 * 手绘卡片：歪斜的墨线描边 + 纸张本体 + 错位投影。
 * 三张一组交替微小倾斜（--tilt），避免整页卡片像尺子画出来的一样整齐。
 */
.note-card {
  --tilt: 0deg;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface);
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius);
  box-shadow: 4px 4px 0 var(--sketch-shadow);
  cursor: pointer;
  transform: rotate(var(--tilt));
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.note-card:nth-child(3n + 1) {
  --tilt: -0.35deg;
}

.note-card:nth-child(3n + 2) {
  --tilt: 0.3deg;
}

.note-card:hover {
  transform: rotate(var(--tilt)) translateY(-4px);
  border-color: var(--notes-accent);
  box-shadow: 6px 8px 0 var(--sketch-shadow);
}

.card-cover {
  /* 固定 16:9 并裁切，保证不同尺寸封面在网格里高度一致 */
  aspect-ratio: 16 / 9;
  background: var(--code-bg);
}

.cover-img {
  width: 100%;
  height: 100%;
  display: block;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.card-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 16px 18px 14px;
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.card-index {
  color: var(--text);
  font-size: 11px;
  letter-spacing: 0.08em;
  opacity: 0.65;
}

/* 分类标签用橙色，作为蓝主色之外唯一的高亮色 */
.card-tag {
  padding: 2px 9px;
  border: 1px solid var(--orange);
  border-radius: 10px 3px 9px 4px / 4px 9px 3px 10px;
  background: var(--orange-soft);
  color: var(--orange);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.card-title {
  margin: 0 0 8px;
  color: var(--notes-title);
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.5;
  transition: color 0.2s;
  /* 标题最多两行，避免长短不一把卡片撑得参差不齐 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-card:hover .card-title {
  color: var(--notes-accent);
}

.card-desc {
  margin: 0 0 16px;
  flex: 1;
  color: var(--notes-text);
  font-size: 13px;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 12px;
  border-top: 1.5px dashed var(--notes-border);
}

.card-time {
  color: var(--text);
  font-size: 12px;
  opacity: 0.65;
}

.card-link {
  color: var(--notes-accent);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.card-arrow {
  display: inline-block;
  transition: transform 0.2s;
}

.note-card:hover .card-arrow {
  transform: translateX(3px);
}

.notes-hint {
  margin-top: 20px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  text-align: center;
}
</style>
