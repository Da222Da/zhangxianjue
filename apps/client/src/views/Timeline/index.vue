<template>
  <div class="timeline-page">
    <!-- 加载态 -->
    <el-skeleton v-if="loading" :rows="6" animated />

    <!-- 错误态 -->
    <el-alert v-else-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon>
      <template #default>
        <el-button link type="primary" @click="fetchEvents">重新加载</el-button>
      </template>
    </el-alert>

    <template v-else>
      <header class="page-header">
        <h1 class="page-title sketch-underline">时间轴</h1>
        <p class="page-subtitle">按年份记录走过的节点：做过的事、踩过的坑，以及正在发生的。</p>
      </header>

      <el-empty v-if="groups.length === 0" description="还没有时间轴事件" />

      <div v-else class="timeline">
        <section v-for="group in groups" :key="group.year" class="year-group">
          <!-- 年份列在宽屏下吸顶，滚动时始终知道自己在看哪一年 -->
          <div class="year-head">
            <span class="year-label">{{ group.year }}</span>
            <span class="year-count">{{ group.events.length }} 件</span>
          </div>

          <ol class="event-list">
            <li v-for="event in group.events" :key="event.id" class="event-item">
              <span class="event-dot" aria-hidden="true"></span>

              <article class="event-card">
                <h3 class="event-title">{{ event.title }}</h3>
                <p v-if="event.description" class="event-desc">{{ event.description }}</p>

                <!--
                  自定义按钮可以有多个：站内路径走 vue-router（不整页刷新），外链新标签页打开。
                  协议白名单由服务端保证，这里只按路径形态分流。
                -->
                <div v-if="event.buttons.length > 0" class="event-buttons">
                  <TimelineButtonLink
                    v-for="(button, index) in event.buttons"
                    :key="index"
                    :text="button.text"
                    :url="button.url"
                    :internal="button.internal"
                  />
                </div>
              </article>
            </li>
          </ol>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import timelineService from "@/api/timelineService";
import TimelineButtonLink from "./TimelineButtonLink.vue";
import type { TimelineEvent } from "@/types/api";

/** 按钮在视图层的形态：内部链接与外部链接分流 */
interface EventButton {
  text: string;
  url: string;
  /** 站内路径（以单个 / 开头）→ 交给 vue-router */
  internal: boolean;
}

interface EventView extends Omit<TimelineEvent, "buttons"> {
  buttons: EventButton[];
}

interface YearGroup {
  year: number;
  events: EventView[];
}

const events = ref<TimelineEvent[]>([]);
const loading = ref(true);
const errorMessage = ref("");

/** 站内路径：单个 / 开头；// 开头的是协议相对外链，按外链处理 */
const isInternalUrl = (url: string): boolean => url.startsWith("/") && !url.startsWith("//");

/**
 * 按年份分组
 *
 * 服务端已按 year DESC, sort ASC 排好；这里再用 Map 聚合，
 * 并按年份倒序输出一次，不依赖服务端返回顺序。
 */
const groups = computed<YearGroup[]>(() => {
  const buckets = new Map<number, EventView[]>();

  for (const event of events.value) {
    const view: EventView = {
      id: event.id,
      year: event.year,
      title: event.title,
      description: event.description,
      sort: event.sort,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      buttons: event.buttons.map((button) => ({
        text: button.text,
        url: button.url,
        internal: isInternalUrl(button.url),
      })),
    };

    const bucket = buckets.get(event.year);
    if (bucket) {
      bucket.push(view);
    } else {
      buckets.set(event.year, [view]);
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, yearEvents]) => ({ year, events: yearEvents }));
});

const fetchEvents = async (): Promise<void> => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await timelineService.getList();
    events.value = res.data;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "时间轴加载失败";
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchEvents();
});
</script>

<style scoped>
.timeline-page {
  padding: 8px 0 48px;
}

/* ===== 页头（与攻略笔记卡片墙同一套） ===== */
.page-header {
  margin-bottom: 30px;
}

.page-title {
  margin: 0 0 20px;
  color: var(--text-h);
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.25;
}

.page-subtitle {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  line-height: 1.7;
}

/* ===== 年份分组 ===== */
.timeline {
  margin-top: 4px;
}

.year-group {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  column-gap: 24px;
}

.year-group + .year-group {
  margin-top: 32px;
}

.year-head {
  /* 宽屏下年份吸顶，长列表滚动时始终有定位参照 */
  position: sticky;
  top: 8px;
  align-self: start;
  padding-top: 6px;
}

.year-label {
  display: block;
  color: var(--text-h);
  font-size: 1.7rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: 0.02em;
}

.year-count {
  display: block;
  margin-top: 5px;
  color: var(--text);
  font-size: 11px;
  opacity: 0.65;
}

/* ===== 事件轴 ===== */
.event-list {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 纵向轴线：淡墨色，和卡片描边区分开，避免整页都是粗线 */
.event-list::before {
  content: "";
  position: absolute;
  left: 7px;
  top: 10px;
  bottom: 6px;
  border-left: 2px solid var(--border);
}

.event-item {
  position: relative;
  padding-left: 32px;
}

.event-item + .event-item {
  margin-top: 16px;
}

/* 轴上的节点：歪一点点的圆，橙色点亮 */
.event-dot {
  position: absolute;
  left: 0;
  top: 20px;
  width: 16px;
  height: 16px;
  border: 2px solid var(--ink);
  border-radius: 52% 48% 46% 54% / 48% 52% 54% 46%;
  background: var(--orange);
}

/* ===== 事件卡片 ===== */
.event-card {
  padding: 16px 18px;
  background: var(--surface);
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius);
  box-shadow: 4px 4px 0 var(--sketch-shadow);
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    border-color 0.2s;
}

.event-card:hover {
  transform: translateY(-2px);
  border-color: var(--brand-accent);
  box-shadow: 6px 6px 0 var(--sketch-shadow);
}

.event-title {
  margin: 0 0 6px;
  color: var(--text-h);
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.5;
}

.event-desc {
  margin: 0;
  color: var(--text);
  font-size: 13.5px;
  line-height: 1.75;
}

/* 自定义按钮可以有多个，横向排列、窄屏自动换行 */
.event-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

/* ===== 窄屏：年份移到卡片上方，轴线保留 ===== */
@media (max-width: 768px) {
  .year-group {
    display: block;
  }

  .year-head {
    position: static;
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding-top: 0;
    margin-bottom: 12px;
  }

  .year-group + .year-group {
    margin-top: 28px;
  }
}
</style>
