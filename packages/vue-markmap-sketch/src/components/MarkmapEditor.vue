<script setup lang="ts">
import { computed, ref, watch } from "vue";
import MarkmapSketch from "./MarkmapSketch.vue";
import { downloadBlob } from "../core/export";
import { parseMarkdown } from "../core/parser";
import { clamp } from "../core/utils";
import type { MarkmapOptions, NodeImage, TreeNode } from "../types";

const props = withDefaults(
  defineProps<{
    /** Markdown 文本，配合 v-model:value 使用 */
    value?: string;
    /** 思维导图配置 */
    options?: MarkmapOptions;
    /** 只读模式：编辑区不可改、导图不可折叠 */
    readonly?: boolean;
    /** 容器高度 */
    height?: string;
    /** 编辑区初始宽度占比 0~1 */
    split?: number;
    placeholder?: string;
    /** 是否显示工具栏 */
    toolbar?: boolean;
  }>(),
  {
    value: "",
    options: () => ({}),
    readonly: false,
    height: "100%",
    split: 0.42,
    placeholder: "# 在这里输入 Markdown\n- 使用标题和列表构建层级",
    toolbar: true,
  },
);

const emit = defineEmits<{
  "update:value": [value: string];
  "node-click": [node: TreeNode, event: MouseEvent];
  /** 点击节点内链接；调用 event.preventDefault() 可阻止默认跳转 */
  "link-click": [node: TreeNode | undefined, href: string, event: MouseEvent];
  /** 点击节点内图片；调用 event.preventDefault() 可阻止内置查看器 */
  "image-click": [node: TreeNode | undefined, image: NodeImage, event: MouseEvent];
}>();

const sketchRef = ref<InstanceType<typeof MarkmapSketch> | null>(null);
const bodyRef = ref<HTMLDivElement | null>(null);
const splitRatio = ref(clamp(props.split, 0.15, 0.85));
const dragging = ref(false);
const exportError = ref("");

/** 本地文本：父组件接不接 v-model 都能正常编辑 */
const text = ref(props.value ?? "");

watch(
  () => props.value,
  (value) => {
    if (value !== text.value) text.value = value ?? "";
  },
);

watch(text, (value) => {
  if (value !== props.value) emit("update:value", value);
});

const editorStyle = computed(() => ({
  flexBasis: `${splitRatio.value * 100}%`,
}));

/**
 * 从 Markdown 直接统计节点数。
 * 不用 `sketchRef.getTree()`：那是渲染器里的非响应式对象，
 * computed 追踪不到它，输入时计数不会刷新。
 */
const nodeCount = computed(() => {
  const root = parseMarkdown(text.value ?? "").root;
  let count = root.content ? 1 : 0;
  const walk = (node: TreeNode) => {
    for (const child of node.children) {
      if (child.content) count += 1;
      walk(child);
    }
  };
  walk(root);
  return count;
});

function startDrag(event: PointerEvent): void {
  dragging.value = true;
  (event.currentTarget as Element).setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onDrag(event: PointerEvent): void {
  if (!dragging.value || !bodyRef.value) return;
  const rect = bodyRef.value.getBoundingClientRect();
  if (rect.width <= 0) return;
  splitRatio.value = clamp((event.clientX - rect.left) / rect.width, 0.15, 0.85);
}

function endDrag(event: PointerEvent): void {
  dragging.value = false;
  const target = event.currentTarget as Element;
  if (target.hasPointerCapture?.(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }
}

function fit(): void {
  sketchRef.value?.fit();
}

function zoomIn(): void {
  sketchRef.value?.zoomIn();
}

function zoomOut(): void {
  sketchRef.value?.zoomOut();
}

function resetZoom(): void {
  sketchRef.value?.resetZoom();
}

function expandAll(): void {
  sketchRef.value?.expandAll();
}

function collapseAll(level = 2): void {
  sketchRef.value?.collapseAll(level);
}

function exportSvg(): string {
  return sketchRef.value?.exportSvg() ?? "";
}

async function exportPng(): Promise<Blob> {
  if (!sketchRef.value) {
    throw new Error("[vue-markmap-sketch] 编辑器尚未挂载");
  }
  return sketchRef.value.exportPng();
}

async function onExportSvg(): Promise<void> {
  exportError.value = "";
  try {
    // 用异步版把图片内联进去，导出物才是自包含的
    const source = (await sketchRef.value?.exportSvgAsync()) ?? "";
    if (!source) return;
    downloadBlob(new Blob([source], { type: "image/svg+xml;charset=utf-8" }), "markmap.svg");
  } catch (error) {
    exportError.value = (error as Error).message;
  }
}

async function onExportPng(): Promise<void> {
  exportError.value = "";
  try {
    const blob = await exportPng();
    downloadBlob(blob, "markmap.png");
  } catch (error) {
    exportError.value = (error as Error).message;
  }
}

defineExpose({
  fit,
  zoomIn,
  zoomOut,
  resetZoom,
  expandAll,
  collapseAll,
  exportSvg,
  exportPng,
  getSketch: () => sketchRef.value,
  getTree: () => sketchRef.value?.getTree() ?? null,
});
</script>

<template>
  <div class="mve-root" :style="{ height }">
    <div v-if="toolbar" class="mve-toolbar">
      <button type="button" class="mve-btn" title="适应视图" @click="fit">适应视图</button>
      <button type="button" class="mve-btn" title="放大" @click="zoomIn">＋</button>
      <button type="button" class="mve-btn" title="缩小" @click="zoomOut">－</button>
      <button type="button" class="mve-btn" title="重置视图" @click="resetZoom">重置</button>
      <span class="mve-sep" />
      <button type="button" class="mve-btn" @click="expandAll">全部展开</button>
      <button type="button" class="mve-btn" @click="collapseAll()">折叠到 2 层</button>
      <span class="mve-sep" />
      <button type="button" class="mve-btn" @click="onExportSvg">导出 SVG</button>
      <button type="button" class="mve-btn" @click="onExportPng">导出 PNG</button>
      <span class="mve-spacer" />
      <span class="mve-stat">{{ nodeCount }} 个节点</span>
    </div>

    <div ref="bodyRef" class="mve-body" :class="{ 'mve-dragging': dragging }">
      <textarea
        v-model="text"
        class="mve-editor"
        :style="editorStyle"
        :readonly="readonly"
        :placeholder="placeholder"
        spellcheck="false"
      />
      <div
        class="mve-divider"
        role="separator"
        aria-orientation="vertical"
        @pointerdown="startDrag"
        @pointermove="onDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      />
      <div class="mve-preview">
        <MarkmapSketch
          ref="sketchRef"
          :value="text"
          :options="options"
          :readonly="readonly"
          @node-click="(node, event) => emit('node-click', node, event)"
          @link-click="(node, href, event) => emit('link-click', node, href, event)"
          @image-click="(node, image, event) => emit('image-click', node, image, event)"
        />
      </div>
    </div>

    <p v-if="exportError" class="mve-error">{{ exportError }}</p>
  </div>
</template>

<style scoped>
.mve-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
  border: 1px solid #e3e6ec;
  border-radius: 10px;
  background: #fff;
  font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

.mve-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid #e3e6ec;
  background: #fafbfc;
}

.mve-btn {
  padding: 4px 10px;
  border: 1px solid #d9dde5;
  border-radius: 6px;
  background: #fff;
  color: #3a4150;
  font-size: 12px;
  line-height: 1.6;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.mve-btn:hover {
  border-color: #b9c0cc;
  background: #f2f4f8;
}

.mve-sep {
  width: 1px;
  height: 16px;
  background: #e0e4ea;
}

.mve-spacer {
  flex: 1;
}

.mve-stat {
  color: #8a93a3;
  font-size: 12px;
}

.mve-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.mve-dragging {
  cursor: col-resize;
  user-select: none;
}

.mve-editor {
  flex-grow: 0;
  flex-shrink: 0;
  min-width: 120px;
  height: 100%;
  padding: 14px 16px;
  border: none;
  outline: none;
  resize: none;
  background: #fbfcfe;
  color: #2f3542;
  font-family: "JetBrains Mono", "Fira Code", ui-monospace, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.75;
  tab-size: 2;
}

.mve-editor::placeholder {
  color: #aab2c0;
}

.mve-divider {
  flex: 0 0 5px;
  cursor: col-resize;
  background: #eceff4;
  transition: background 0.15s ease;
}

.mve-divider:hover,
.mve-dragging .mve-divider {
  background: #c8d2e2;
}

.mve-preview {
  flex: 1;
  min-width: 0;
  position: relative;
}

.mve-preview :deep(.mvs-container) {
  height: 100%;
}

.mve-error {
  padding: 6px 12px;
  background: #fdecec;
  color: #c0392b;
  font-size: 12px;
}
</style>
