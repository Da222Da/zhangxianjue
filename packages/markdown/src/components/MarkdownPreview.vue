<!-- src/components/MarkdownPreview.vue -->
<template>
  <div
    ref="rootRef"
    class="md-preview"
    :class="previewClasses"
    @click="handleClick"
    @mouseover="handleMouseOver"
    @mouseout="handleMouseOut"
    v-html="html"
  />

  <!--
    脚注提示框挂到 body：预览区可能自带 overflow / 缩放容器，
    放在里面会被裁切；pointer-events: none 保证它不会干扰鼠标移出。
  -->
  <Teleport to="body">
    <div
      v-if="footnoteTip.visible"
      class="md-footnote-tip"
      :class="{ 'is-below': footnoteTip.below }"
      :style="footnoteTip.style"
      role="tooltip"
    >
      <p class="md-footnote-tip__label">脚注 {{ footnoteTip.label }}</p>
      <div class="md-footnote-tip__content" v-html="footnoteTip.html" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { renderMarkdown } from "../core/renderer";

const props = withDefaults(
  defineProps<{
    value?: string;
    breaks?: boolean;
    tocTitle?: string;
    tocSticky?: boolean;
    tocCollapsible?: boolean;
    tocDefaultCollapsed?: boolean;
    tocMode?: "marker" | "auto" | "off";
  }>(),
  {
    value: "",
    breaks: true,
    tocTitle: "目录",
    tocSticky: true,
    tocCollapsible: true,
    tocDefaultCollapsed: false,
    tocMode: "marker",
  },
);

const rootRef = ref<HTMLDivElement | null>(null);
const html = computed(() =>
  renderMarkdown(props.value, {
    breaks: props.breaks,
    tocTitle: props.tocTitle,
    tocMode: props.tocMode,
  }),
);

/** 目录折叠状态放在预览层，内容重渲染时不会丢 */
const tocCollapsed = ref(props.tocDefaultCollapsed);

const previewClasses = computed(() => ({
  "is-toc-collapsed": tocCollapsed.value,
  "is-toc-static": !props.tocSticky,
  "is-toc-no-collapse": !props.tocCollapsible,
}));

interface FootnoteTip {
  visible: boolean;
  html: string;
  label: string;
  below: boolean;
  style: Record<string, string>;
}

const footnoteTip = ref<FootnoteTip>({
  visible: false,
  html: "",
  label: "",
  below: false,
  style: {},
});

/** 目录点击：站内锚点平滑滚动，避免改变路由 hash */
const handleClick = (event: MouseEvent): void => {
  footnoteTip.value.visible = false;
  const target = event.target as HTMLElement | null;

  // 目录收起 / 展开
  const tocToggle = target?.closest(".md-toc__toggle, .md-toc__collapsed");
  if (tocToggle) {
    event.preventDefault();
    tocCollapsed.value = !tocCollapsed.value;
    return;
  }

  const anchor = target?.closest<HTMLAnchorElement>('a[href^="#"]');
  if (!anchor) {
    return;
  }
  const href = anchor.getAttribute("href") ?? "";
  if (href.length <= 1) {
    return;
  }
  let id = href.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // 保留原样
  }
  const heading = document.getElementById(id);
  if (!heading) {
    return;
  }
  event.preventDefault();
  heading.scrollIntoView({ behavior: "smooth", block: "start" });
};

/** 在预览区内按 id 找元素，避免多实例页面里 document.getElementById 串台 */
function findById(id: string): HTMLElement | null {
  const root = rootRef.value;
  if (!root) {
    return null;
  }
  return Array.from(root.querySelectorAll<HTMLElement>("[id]")).find((element) => element.id === id) ?? null;
}

/**
 * 显示脚注悬浮提示
 *
 * 内容直接从已经渲染并清洗过的脚注列表里克隆，去掉「返回正文」箭头；
 * 位置以视口坐标定位，靠近顶部时翻到下方。
 */
function showFootnoteTip(anchor: HTMLAnchorElement): void {
  const href = anchor.getAttribute("href") ?? "";
  if (!href.startsWith("#")) {
    return;
  }
  let id = href.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // 保留原样
  }
  const source = findById(id);
  if (!source) {
    return;
  }

  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".footnote-backref").forEach((element) => element.remove());

  const rect = anchor.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 24);
  const half = width / 2;
  const center = rect.left + rect.width / 2;
  const left = Math.min(Math.max(center, half + 12), window.innerWidth - half - 12);
  const below = rect.top < 120;
  const top = below ? rect.bottom + 8 : rect.top - 8;

  footnoteTip.value = {
    visible: true,
    html: clone.innerHTML,
    label: (anchor.textContent ?? "").replace(/[\[\]]/g, "").trim(),
    below,
    style: {
      left: `${left}px`,
      top: `${top}px`,
    },
  };
}

const handleMouseOver = (event: MouseEvent): void => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const anchor = target.closest<HTMLAnchorElement>(".footnote-ref a");
  if (anchor) {
    showFootnoteTip(anchor);
  }
};

const handleMouseOut = (event: MouseEvent): void => {
  const target = event.target;
  if (target instanceof HTMLElement && target.closest(".footnote-ref a")) {
    footnoteTip.value.visible = false;
  }
};

const hideFootnoteTip = (): void => {
  footnoteTip.value.visible = false;
};

let observer: IntersectionObserver | null = null;

const teardownScrollSpy = (): void => {
  observer?.disconnect();
  observer = null;
};

/**
 * 滚动高亮当前标题
 *
 * 只在目录存在时启动；页面不支持 IntersectionObserver 时静默降级。
 */
const setupScrollSpy = (): void => {
  teardownScrollSpy();
  const root = rootRef.value;
  if (!root || typeof IntersectionObserver === "undefined") {
    return;
  }

  const links = new Map<string, HTMLAnchorElement>();
  root.querySelectorAll<HTMLAnchorElement>(".md-toc__link").forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    if (href.length > 1) {
      links.set(decodeURIComponent(href.slice(1)), link);
    }
  });
  if (links.size === 0) {
    return;
  }

  const headings = root.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]");
  if (headings.length === 0) {
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        links.forEach((link) => link.classList.remove("is-active"));
        links.get(entry.target.id)?.classList.add("is-active");
      }
    },
    { rootMargin: "-10% 0px -75% 0px", threshold: [0, 1] },
  );
  headings.forEach((heading) => observer?.observe(heading));
};

watch(html, () => {
  footnoteTip.value.visible = false;
  void nextTick(setupScrollSpy);
});

onMounted(() => {
  void nextTick(setupScrollSpy);
  window.addEventListener("scroll", hideFootnoteTip, true);
  window.addEventListener("resize", hideFootnoteTip);
});

onBeforeUnmount(() => {
  teardownScrollSpy();
  window.removeEventListener("scroll", hideFootnoteTip, true);
  window.removeEventListener("resize", hideFootnoteTip);
});
</script>
