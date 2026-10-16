<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import type {
  MarkmapOptions,
  NodeImage,
  ResolvedMarkmapOptions,
  TreeNode,
} from "../types";
import { parseMarkdown } from "../core/parser";
import { resolveOptions } from "../core/options";
import { SketchRenderer } from "../core/renderer";
import {
  exportPng as svgToPng,
  inlineImages,
  serializeSvg,
} from "../core/export";
import ImageLightbox from "./ImageLightbox.vue";

const props = withDefaults(
  defineProps<{
    /** Markdown 文本，配合 v-model:value 使用 */
    value?: string;
    /** 全局配置；同名键会覆盖 front-matter 里的配置 */
    options?: MarkmapOptions;
    /** 只读模式：隐藏折叠标识、禁用折叠交互；缩放平移与 node-click 仍可用 */
    readonly?: boolean;
    /** 首次渲染后自动适应视图 */
    autoFit?: boolean;
    /** 导出 PNG 的像素倍率 */
    exportScale?: number;
    /** 导出时四周留白 */
    exportPadding?: number;
  }>(),
  {
    value: "",
    options: () => ({}),
    readonly: false,
    autoFit: true,
    exportScale: 2,
    exportPadding: 24,
  },
);

const emit = defineEmits<{
  "update:value": [value: string];
  "node-click": [node: TreeNode, event: MouseEvent];
  "node-toggle": [node: TreeNode, folded: boolean];
  "zoom": [transform: { k: number; x: number; y: number }];
  /** 点击节点内链接；调用 event.preventDefault() 可阻止默认跳转 */
  "link-click": [node: TreeNode | undefined, href: string, event: MouseEvent];
  /** 点击节点内图片；调用 event.preventDefault() 可阻止内置查看器 */
  "image-click": [node: TreeNode | undefined, image: NodeImage, event: MouseEvent];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const renderer = shallowRef<SketchRenderer | null>(null);
const resolved = shallowRef<ResolvedMarkmapOptions>(resolveOptions(props.options));
/** 查看器里正在看的图片，null 表示未打开 */
const activeImage = ref<{ src: string; alt: string } | null>(null);

/** front-matter 解析出的配置，作为 props.options 的默认值 */
let frontmatterOptions: MarkmapOptions = {};
/** 已经渲染过的 Markdown，用于避免 setData 触发 v-model 回流时重复渲染 */
let renderedValue: string | null = null;
let resizeObserver: ResizeObserver | null = null;

const containerStyle = computed(
  () =>
    ({
      "--mvs-canvas-bg": resolved.value.backgroundColor || "transparent",
    }) as Record<string, string>,
);

/** 剔除显式传入的 undefined，避免把 front-matter 里的值覆盖掉 */
function definedOptions(options: MarkmapOptions): MarkmapOptions {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) result[key] = value;
  }
  return result as MarkmapOptions;
}

function mergedOptions(): MarkmapOptions {
  return { ...frontmatterOptions, ...definedOptions(props.options) };
}

function parseAndRender(markdown: string, animate = true): void {
  const instance = renderer.value;
  if (!instance) return;
  const parsed = parseMarkdown(markdown ?? "");
  frontmatterOptions = parsed.options;
  renderedValue = markdown;
  instance.update(parsed.root, mergedOptions(), animate);
  resolved.value = instance.getOptions();
  // 内容换了，正在看的那张图可能已经不在文档里
  activeImage.value = null;
}

function applyOptions(): void {
  const instance = renderer.value;
  if (!instance) return;
  instance.setOptions(mergedOptions(), true);
  resolved.value = instance.getOptions();
}

onMounted(() => {
  const svg = svgRef.value;
  if (!svg) return;

  const instance = new SketchRenderer(svg, props.options, {
    onNodeClick: (node, event) => emit("node-click", node, event),
    onToggle: (node, folded) => emit("node-toggle", node, folded),
    onZoom: (transform) =>
      emit("zoom", { k: transform.k, x: transform.x, y: transform.y }),
    onLinkClick: (node, href, event) => emit("link-click", node, href, event),
    onImageClick: (node, image, event) => {
      emit("image-click", node, image, event);
      // emit 是同步的：宿主在监听里 preventDefault 就能拦下内置查看器。
      // 读 instance 而不是 resolved：front-matter 里的配置也要认
      if (event.defaultPrevented || !instance.getOptions().imageViewer) return;
      activeImage.value = { src: image.src, alt: image.alt };
    },
  });
  renderer.value = instance;
  instance.setReadonly(props.readonly);

  parseAndRender(props.value);
  if (props.autoFit) instance.fit(60, false);

  if (typeof ResizeObserver !== "undefined" && containerRef.value) {
    resizeObserver = new ResizeObserver(() => instance.zoom.resize());
    resizeObserver.observe(containerRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  renderer.value?.destroy();
  renderer.value = null;
});

watch(
  () => props.value,
  (value) => {
    if (value === renderedValue) return;
    parseAndRender(value ?? "");
  },
);

watch(
  () => props.options,
  () => applyOptions(),
  { deep: true },
);

watch(
  () => props.readonly,
  (value) => renderer.value?.setReadonly(value),
);

// ---------------------------------------------------------------------------
// defineExpose
// ---------------------------------------------------------------------------

/** 适应视图，缩放到全部内容可见 */
function fit(padding = 60): void {
  renderer.value?.fit(padding, true);
}

/** 把某个节点移到视口中心（会自动展开它被折叠的祖先） */
function centerNode(id: string): void {
  renderer.value?.centerNode(id, true);
}

function zoomIn(): void {
  renderer.value?.zoomBy(1.25);
}

function zoomOut(): void {
  renderer.value?.zoomBy(0.8);
}

function resetZoom(): void {
  renderer.value?.resetZoom(true);
}

function expandAll(): void {
  renderer.value?.expandAll();
}

/** 折叠到指定层级，depth >= level 的节点收起 */
function collapseAll(level = 1): void {
  renderer.value?.collapseAll(level);
}

/** 切换某个节点的折叠状态，返回切换后的状态 */
function toggleNode(id: string, folded?: boolean): boolean {
  return renderer.value?.toggle(id, folded) ?? false;
}

/** 命令式设置 Markdown，并同步 v-model */
function setData(markdown: string, animate = true): void {
  if (typeof markdown !== "string" || markdown === props.value) return;
  parseAndRender(markdown, animate);
  emit("update:value", markdown);
}

/** 导出当前内容的 SVG 字符串 */
function exportSvg(): string {
  const instance = renderer.value;
  if (!instance) return "";
  const box = instance.getSceneBox();
  if (!box) return "";
  return serializeSvg(instance.getSvgElement(), box, {
    padding: props.exportPadding,
    backgroundColor: instance.getOptions().backgroundColor,
    texts: instance.getTextLayouts(),
  });
}

/** 导出 PNG，返回 Blob */
async function exportPng(scale = props.exportScale): Promise<Blob> {
  const instance = renderer.value;
  if (!instance) {
    throw new Error("[vue-markmap-sketch] 组件尚未挂载，无法导出");
  }
  const box = instance.getSceneBox();
  if (!box) {
    throw new Error("[vue-markmap-sketch] 当前没有可导出的内容");
  }
  const background = instance.getOptions().backgroundColor;
  return svgToPng(instance.getSvgElement(), box, {
    padding: props.exportPadding,
    scale,
    texts: instance.getTextLayouts(),
    // 画布透明时不传背景色，交给 exportPng 用白底
    ...(background && background !== "transparent"
      ? { backgroundColor: background }
      : {}),
  });
}

/**
 * 导出**自包含**的 SVG：把图片抓成 data URL 内联进去。
 * `exportSvg()` 是同步的，保留图片原始 URL（导出物需要联网才能看到图）。
 */
async function exportSvgAsync(): Promise<string> {
  const instance = renderer.value;
  if (!instance) return "";
  const box = instance.getSceneBox();
  if (!box) return "";
  const texts = instance.getTextLayouts();
  const imageData = await inlineImages(
    [...texts.values()].flatMap((layout) => layout.images.map((img) => img.src)),
  );
  return serializeSvg(instance.getSvgElement(), box, {
    padding: props.exportPadding,
    backgroundColor: instance.getOptions().backgroundColor,
    texts,
    imageData,
  });
}

function getRenderer(): SketchRenderer | null {
  return renderer.value;
}

function getSvgElement(): SVGSVGElement | null {
  return svgRef.value;
}

function getTree(): TreeNode | null {
  return renderer.value?.getTree() ?? null;
}

defineExpose({
  fit,
  centerNode,
  zoomIn,
  zoomOut,
  resetZoom,
  expandAll,
  collapseAll,
  toggleNode,
  setData,
  exportSvg,
  exportSvgAsync,
  exportPng,
  getRenderer,
  getSvgElement,
  getTree,
});
</script>

<template>
  <div
    ref="containerRef"
    class="mvs-container"
    :class="{ 'mvs-image-viewer': resolved.imageViewer }"
    :style="containerStyle"
  >
    <svg
      ref="svgRef"
      class="mvs-svg"
      :class="{ 'mvs-readonly': readonly }"
      xmlns="http://www.w3.org/2000/svg"
    />
    <ImageLightbox
      v-if="activeImage"
      :src="activeImage.src"
      :alt="activeImage.alt"
      :download="resolved.imageViewerDownload"
      :scale-extent="resolved.imageViewerScaleExtent"
      @close="activeImage = null"
    />
  </div>
</template>
