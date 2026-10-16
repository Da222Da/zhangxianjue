<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { MarkmapEditor, MarkmapSketch } from "../src/index";
import type {
  MarkmapOptions,
  NodeImage,
  SketchFillStyle,
  TreeNode,
} from "../src/index";
import { sampleMarkdown } from "./sample";

const tab = ref<"editor" | "viewer" | "preview">("editor");
const markdown = ref(sampleMarkdown);
const log = ref("点击任意节点，事件会显示在这里");

const options = reactive<MarkmapOptions>({
  roughness: 1.6,
  bowing: 1.4,
  seed: 42,
  fillStyle: "hachure",
  hachureGap: 8,
  strokeWidth: 1.5,
  nodeFill: "auto",
  nodeFillOpacity: 0.12,
  colorFreezeLevel: 2,
  maxWidth: 260,
  fontSize: 14,
  nodePadding: 8,
  spacingVertical: 12,
  spacingHorizontal: 80,
  duration: 500,
  imageViewer: true,
});

const fillStyles: SketchFillStyle[] = [
  "hachure",
  "solid",
  "zigzag",
  "cross-hatch",
  "dots",
  "dashed",
  "zigzag-line",
];

const viewerRef = ref<InstanceType<typeof MarkmapSketch> | null>(null);

const nodeCount = computed(() => {
  const tree: TreeNode | null = viewerRef.value?.getTree() ?? null;
  if (!tree) return 0;
  let count = 0;
  const walk = (node: TreeNode) => {
    if (node.content) count += 1;
    node.children.forEach(walk);
  };
  walk(tree);
  return count;
});

function onNodeClick(node: TreeNode, event: MouseEvent) {
  log.value = `点击节点：${node.content || "(根)"}（depth ${node.depth}，坐标 x=${node.x?.toFixed(1)}, y=${node.y?.toFixed(1)}，modifier=${event.altKey ? "Alt" : event.ctrlKey ? "Ctrl" : "无"}）`;
}

function onImageClick(node: TreeNode | undefined, image: NodeImage) {
  // src 可能是很长的 data URL，日志里只留个开头
  const source = image.src.startsWith("data:") ? "data URL" : image.src.slice(0, 40);
  log.value = `点击图片：${image.alt || "(无 alt)"} · 属于节点「${(node?.content ?? "(根)").slice(0, 20)}」 · src=${source}`;
}

function resetOptions() {
  Object.assign(options, {
    roughness: 1.6,
    bowing: 1.4,
    seed: 42,
    fillStyle: "hachure",
    hachureGap: 8,
    strokeWidth: 1.5,
    nodeFill: "auto",
    nodeFillOpacity: 0.12,
    colorFreezeLevel: 2,
    maxWidth: 260,
    fontSize: 14,
    nodePadding: 8,
    spacingVertical: 12,
    spacingHorizontal: 80,
    duration: 500,
    imageViewer: true,
  });
}

function randomSeed() {
  options.seed = Math.floor(Math.random() * 100000);
}
</script>

<template>
  <div class="pg">
    <header class="pg-header">
      <h1>vue-markmap-sketch</h1>
      <p>手绘风格的 Markdown 思维导图 · rough.js + d3</p>
    </header>

    <div class="pg-tabs">
      <button
        type="button"
        :class="['pg-tab', { active: tab === 'editor' }]"
        @click="tab = 'editor'"
      >
        编辑器模式
      </button>
      <button
        type="button"
        :class="['pg-tab', { active: tab === 'viewer' }]"
        @click="tab = 'viewer'"
      >
        只读视图 + 参数调节
      </button>
      <button
        type="button"
        :class="['pg-tab', { active: tab === 'preview' }]"
        @click="tab = 'preview'"
      >
        纯预览
      </button>
    </div>

    <main class="pg-main" :class="{ 'pg-bare': tab === 'preview' }">
      <div class="pg-stage">
        <MarkmapEditor
          v-if="tab === 'editor'"
          v-model:value="markdown"
          :options="options"
          height="100%"
          @node-click="onNodeClick"
          @image-click="onImageClick"
        />
        <MarkmapSketch
          v-else
          ref="viewerRef"
          v-model:value="markdown"
          :options="options"
          @node-click="onNodeClick"
          @image-click="onImageClick"
        />
      </div>

      <aside v-if="tab === 'viewer'" class="pg-panel">
        <h2>手绘参数</h2>

        <label class="pg-field">
          <span>roughness {{ options.roughness?.toFixed(2) }}</span>
          <input v-model.number="options.roughness" type="range" min="0" max="5" step="0.1" />
        </label>

        <label class="pg-field">
          <span>bowing {{ options.bowing?.toFixed(2) }}</span>
          <input v-model.number="options.bowing" type="range" min="0" max="5" step="0.1" />
        </label>

        <label class="pg-field">
          <span>strokeWidth {{ options.strokeWidth?.toFixed(2) }}</span>
          <input v-model.number="options.strokeWidth" type="range" min="0.5" max="4" step="0.1" />
        </label>

        <label class="pg-field">
          <span>fillStyle</span>
          <select v-model="options.fillStyle">
            <option v-for="style in fillStyles" :key="style" :value="style">{{ style }}</option>
          </select>
        </label>

        <label class="pg-field">
          <span>hachureGap {{ options.hachureGap }}</span>
          <input v-model.number="options.hachureGap" type="range" min="2" max="20" step="1" />
        </label>

        <label class="pg-field">
          <span>seed {{ options.seed }}</span>
          <input v-model.number="options.seed" type="range" min="0" max="999" step="1" />
        </label>

        <h2>布局与文本</h2>

        <label class="pg-field">
          <span>colorFreezeLevel {{ options.colorFreezeLevel }}</span>
          <input v-model.number="options.colorFreezeLevel" type="range" min="0" max="5" step="1" />
        </label>

        <label class="pg-field">
          <span>maxWidth {{ options.maxWidth }}</span>
          <input v-model.number="options.maxWidth" type="range" min="80" max="500" step="10" />
        </label>

        <label class="pg-field">
          <span>fontSize {{ options.fontSize }}</span>
          <input v-model.number="options.fontSize" type="range" min="10" max="24" step="1" />
        </label>

        <label class="pg-field">
          <span>nodePadding {{ options.nodePadding }}</span>
          <input v-model.number="options.nodePadding" type="range" min="0" max="24" step="1" />
        </label>

        <label class="pg-field">
          <span>spacingVertical {{ options.spacingVertical }}</span>
          <input v-model.number="options.spacingVertical" type="range" min="0" max="60" step="2" />
        </label>

        <label class="pg-field">
          <span>spacingHorizontal {{ options.spacingHorizontal }}</span>
          <input v-model.number="options.spacingHorizontal" type="range" min="20" max="200" step="5" />
        </label>

        <label class="pg-field">
          <span>duration {{ options.duration }} ms</span>
          <input v-model.number="options.duration" type="range" min="0" max="1500" step="50" />
        </label>

        <h2>图片与配色</h2>

        <label class="pg-field">
          <span>nodeFillOpacity {{ options.nodeFillOpacity?.toFixed(2) }}</span>
          <input v-model.number="options.nodeFillOpacity" type="range" min="0" max="1" step="0.02" />
        </label>

        <label class="pg-check">
          <input v-model="options.imageViewer" type="checkbox" />
          <span>imageViewer：点击图片打开查看器</span>
        </label>

        <div class="pg-actions">
          <button type="button" @click="resetOptions">恢复默认</button>
          <button type="button" @click="randomSeed">随机 seed</button>
        </div>

        <p class="pg-log">节点数：{{ nodeCount }}</p>
        <p class="pg-log">{{ log }}</p>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.pg {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #eef1f6;
}

.pg-header {
  padding: 14px 20px 10px;
}

.pg-header h1 {
  font-size: 18px;
  color: #232a36;
}

.pg-header p {
  margin-top: 2px;
  color: #7b8598;
  font-size: 12px;
}

.pg-tabs {
  display: flex;
  gap: 8px;
  padding: 0 20px 10px;
}

.pg-tab {
  padding: 6px 14px;
  border: 1px solid #d7dce5;
  border-radius: 999px;
  background: #fff;
  color: #4a5468;
  font-size: 13px;
  cursor: pointer;
}

.pg-tab.active {
  border-color: #4c72b0;
  background: #4c72b0;
  color: #fff;
}

.pg-main {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 14px;
  padding: 0 20px 20px;
}

.pg-stage {
  flex: 1;
  min-width: 0;
}

/* 纯预览：整屏只有导图，去掉参数面板与多余留白 */
.pg-bare .pg-stage {
  overflow: hidden;
  border: 1px solid #e3e6ec;
  border-radius: 10px;
  background: #fff;
}

.pg-panel {
  flex: 0 0 260px;
  padding: 12px 14px;
  overflow-y: auto;
  border: 1px solid #e3e6ec;
  border-radius: 10px;
  background: #fff;
}

.pg-panel h2 {
  margin: 10px 0 8px;
  color: #6b7488;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.pg-panel h2:first-child {
  margin-top: 0;
}

.pg-field {
  display: block;
  margin-bottom: 10px;
}

.pg-field span {
  display: block;
  margin-bottom: 3px;
  color: #4a5468;
  font-size: 12px;
}

.pg-field input[type="range"] {
  width: 100%;
}

.pg-field select {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid #d7dce5;
  border-radius: 6px;
  font-size: 12px;
}

.pg-check {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: #4a5468;
  font-size: 12px;
  cursor: pointer;
}

.pg-actions {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}

.pg-actions button {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid #d7dce5;
  border-radius: 6px;
  background: #fff;
  color: #4a5468;
  font-size: 12px;
  cursor: pointer;
}

.pg-actions button:hover {
  background: #f2f4f8;
}

.pg-log {
  margin-top: 8px;
  padding: 8px;
  border-radius: 6px;
  background: #f5f7fb;
  color: #66707f;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
}
</style>
