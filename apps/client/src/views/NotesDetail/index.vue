<template>
  <div class="note-detail">
    <!-- 加载态 -->
    <el-skeleton v-if="loading" :rows="8" animated />

    <!-- 无权限：VIP 专属笔记 -->
    <el-result
      v-else-if="forbidden"
      icon="warning"
      title="这篇笔记为 VIP 专属"
      sub-title="开通会员或联系管理员获取阅读权益后，即可查看完整脑图"
    >
      <template #extra>
        <el-button type="primary" @click="goUpgrade">前往申请会员</el-button>
        <el-button @click="goNotes">返回攻略笔记</el-button>
      </template>
    </el-result>

    <!-- 错误态：笔记不存在或链接非法 -->
    <el-result v-else-if="errorMessage" icon="warning" :title="errorMessage" sub-title="请检查链接，或返回攻略笔记重新进入">
      <template #extra>
        <el-button type="primary" @click="goNotes">返回攻略笔记</el-button>
      </template>
    </el-result>

    <template v-else-if="note">
      <h1 class="note-title">{{ note.title }}</h1>

      <div class="note-meta">
        <el-tag v-if="note.category" size="small" type="info">{{ note.category }}</el-tag>
        <span class="meta-item">发布于 {{ formatDate(note.createdAt) }}</span>
        <span v-if="note.updatedAt !== note.createdAt" class="meta-item">更新于 {{ formatDate(note.updatedAt) }}</span>
      </div>

      <p v-if="note.description" class="note-summary">{{ note.description }}</p>

      <el-divider />

      <!--
        思维导图正文：readonly 只关掉折叠交互，缩放与平移仍可用。
        ⚠️ 容器必须有确定高度 —— 组件内部按 height:100% 计算画布尺寸，
        父级没有高度时画布会塌成 0。这与 Articles 详情页「markdown 不给固定高度」相反：
        markdown 是文档流随页面滚动，思维导图是画布式组件。
      -->
      <div v-if="hasContent" class="mindmap-wrapper">
        <MarkmapSketch :value="note.content" readonly @link-click="handleLinkClick" />
      </div>
      <el-empty v-else description="这篇笔记还没有内容" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
// 局部引入而非全局注册：内含 d3 / rough.js，放在这里可随本路由懒加载
import { MarkmapSketch } from "@zhangxianjue/markmap";
import type { TreeNode } from "@zhangxianjue/markmap";
import "@zhangxianjue/markmap/style.css";
import noteService from "@/api/noteService";
import { formatDate } from "@/util/index.ts";
import type { Note } from "@/types/api";

/** 由路由参数注入（router 中该路由开启了 props: true） */
const props = defineProps<{
  id: string;
}>();

const router = useRouter();
const route = useRoute();

const note = ref<Note | null>(null);
const loading = ref(true);
const errorMessage = ref("");
/** 笔记为 VIP 专属且访客无阅读权益（服务端 403） */
const forbidden = ref(false);

/** 空串表示还没录入正文，此时不渲染画布而给空态 */
const hasContent = computed(() => !!note.value?.content.trim());

const fetchNote = async (): Promise<void> => {
  const id = Number(props.id);
  if (!Number.isInteger(id) || id <= 0) {
    note.value = null;
    errorMessage.value = "笔记链接无效";
    loading.value = false;
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  forbidden.value = false;
  try {
    const res = await noteService.getDetail(id);
    note.value = res.data;
  } catch (error) {
    note.value = null;
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 403) {
      forbidden.value = true;
    } else {
      // 服务端文案如「笔记不存在」，可直接展示
      errorMessage.value = error instanceof Error ? error.message : "笔记加载失败";
    }
  } finally {
    loading.value = false;
  }
};

const goNotes = (): void => {
  router.push({ name: "Notes" });
};

/** 去个人中心申请会员；登录后由路由守卫带回 */
const goUpgrade = (): void => {
  router.push({ name: "Account", query: { upgrade: "1", redirect: route.fullPath } });
};

/**
 * 判断链接是否应交给 vue-router
 *
 * - `http(s)://` / 协议相对 `//` → 外链，交给浏览器（组件默认新标签页打开）
 * - `mailto:` / `tel:` 等带协议头的 → 交给浏览器
 * - `#锚点` → 交给浏览器（同页锚点）
 * - 其余（`/notes/2` 这类站内路径）→ 走 vue-router，避免整页刷新
 *
 * ⚠️ 站内链接建议写成以 `/` 开头的绝对路径。
 */
const isRouterHref = (href: string): boolean => {
  if (!href || href.startsWith("//") || href.startsWith("#")) {
    return false;
  }
  return !/^[a-z][a-z0-9+.-]*:/i.test(href);
};

/**
 * 接管思维导图节点内的链接点击
 *
 * MarkmapSketch 把链接渲染成真实的 `<a href>`，未 preventDefault 时浏览器会
 * **整页刷新**到目标地址 —— 那样会丢掉 SPA 状态、重新加载整个应用。
 * 这里拦下站内链接改用 router.push，外链与锚点仍保留浏览器默认行为。
 *
 * @param _node 命中链接的节点，本处用不到
 * @param href  链接地址（来自节点 Markdown 的 `[文字](href)`）
 * @param event 原始点击事件，必须同步调用 preventDefault
 */
const handleLinkClick = (_node: TreeNode | undefined, href: string, event: MouseEvent): void => {
  if (!isRouterHref(href)) {
    return;
  }

  // 站内链接一律拦下，不让浏览器整页刷新
  event.preventDefault();

  /*
   * ⚠️ 客户端没有兜底路由（没有 404 页），跳到一个匹配不上的地址会让
   * router-view 渲染空白。常见触发：链接写成 `notes/2` 而不是 `/notes/2`
   * —— vue-router 会按相对路径解析成 `/notes/notes/2`。
   */
  if (router.resolve(href).matched.length === 0) {
    ElMessage.warning(`页面不存在：${href}`);
    return;
  }

  void router.push(href);
};

onMounted(() => {
  fetchNote();
});

// 停留在详情页内切换到另一篇时（id 变化但组件复用）需要重新拉取
watch(
  () => props.id,
  () => {
    fetchNote();
  },
);
</script>

<style scoped>
.note-detail {
  padding: 8px 0 32px;
}

/* 详情标题做成手绘「根节点」的样子：纸底、墨线描边、错位投影 */
.note-title {
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

.note-meta {
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
.note-summary {
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

.mindmap-wrapper {
  height: 65vh;
  min-height: 420px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius);
  background: var(--surface);
  box-shadow: 4px 4px 0 var(--sketch-shadow);
  overflow: hidden;
}
</style>
