<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { downloadBlob, inlineImages } from "../core/export";
import { guessImageFilename } from "../core/images";
import { clamp } from "../core/utils";

const props = withDefaults(
  defineProps<{
    /** 原图地址 */
    src: string;
    alt?: string;
    /** 是否显示下载按钮 */
    download?: boolean;
    /** 缩放范围 `[最小, 最大]`，1 为原始大小 */
    scaleExtent?: [number, number];
  }>(),
  {
    alt: "",
    download: true,
    scaleExtent: () => [0.25, 8] as [number, number],
  },
);

const emit = defineEmits<{
  close: [];
}>();

/** 按钮 / 键盘一次缩放的倍率 */
const ZOOM_STEP = 1.25;
/** 滚轮 deltaY → 倍率的换算系数 */
const WHEEL_FACTOR = 0.0015;
/** 双击时的目标倍率 */
const DOUBLE_CLICK_SCALE = 2;
/** 超过这个位移就当成拖拽，抬起时不再关闭查看器 */
const DRAG_THRESHOLD = 4;

const rootRef = ref<HTMLDivElement | null>(null);
const stageRef = ref<HTMLDivElement | null>(null);
const scale = ref(1);
const offset = ref({ x: 0, y: 0 });
const dragging = ref(false);
const busy = ref(false);
/** 下载失败：跨域图片取不到内容，退化成新标签页打开 */
const failed = ref(false);

const limits = computed<[number, number]>(() => {
  const [min, max] = props.scaleExtent;
  return [Math.min(min, max), Math.max(min, max)];
});
const percent = computed(() => `${Math.round(scale.value * 100)}%`);
const transform = computed(
  () => `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value})`,
);

function close(): void {
  emit("close");
}

/**
 * 缩放到指定倍率。
 *
 * 传了锚点就以锚点为不动点：锚点下的那个像素缩放前后停在原地。
 * 不传锚点（键盘 / 按钮）时只改倍率，画面绕中心缩放。
 */
function zoomTo(next: number, clientX?: number, clientY?: number): void {
  const [min, max] = limits.value;
  const to = clamp(next, min, max);
  const from = scale.value;
  if (Math.abs(to - from) < 1e-4) return;

  const rect = stageRef.value?.getBoundingClientRect();
  if (rect && clientX !== undefined && clientY !== undefined) {
    // 锚点相对图片中心（transform-origin）的坐标：
    // 变换是 translate(t) scale(k)，即 p → t + k·p，要让锚点不动就解 t' = a - (k'/k)·(a - t)
    const ax = clientX - (rect.left + rect.width / 2);
    const ay = clientY - (rect.top + rect.height / 2);
    const ratio = to / from;
    offset.value = {
      x: ax - ratio * (ax - offset.value.x),
      y: ay - ratio * (ay - offset.value.y),
    };
  }
  scale.value = to;
}

function reset(): void {
  scale.value = 1;
  offset.value = { x: 0, y: 0 };
}

function onWheel(event: WheelEvent): void {
  event.preventDefault();
  // deltaMode：0 = 像素，1 = 行，2 = 页，后两种要先换算成像素量级
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
  // 指数映射：每一格滚动的视觉变化量恒定，不会在高倍率下变得过于灵敏
  const factor = Math.exp(-event.deltaY * unit * WHEEL_FACTOR);
  zoomTo(scale.value * factor, event.clientX, event.clientY);
}

function onDoubleClick(event: MouseEvent): void {
  if (scale.value > 1.001) reset();
  else zoomTo(DOUBLE_CLICK_SCALE, event.clientX, event.clientY);
}

// ---------------------------------------------------------------------------
// 拖拽平移
// ---------------------------------------------------------------------------

let dragStart: { x: number; y: number; ox: number; oy: number } | null = null;
/** 本次按下是否发生过位移，用来区分「拖动」和「点空白关闭」 */
let moved = false;

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  moved = false;
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    ox: offset.value.x,
    oy: offset.value.y,
  };
  // 指针捕获：拖到窗口外再移回来也能继续跟手。
  // 指针已经失效时浏览器会抛 NotFoundError，捕获不到不影响平移本身，忽略即可
  try {
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  } catch {
    /* 忽略 */
  }
}

function onPointerMove(event: PointerEvent): void {
  if (!dragStart) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    moved = true;
    dragging.value = true;
  }
  if (!moved) return;
  offset.value = { x: dragStart.ox + dx, y: dragStart.oy + dy };
}

function onPointerUp(event: PointerEvent): void {
  if (!dragStart) return;
  dragStart = null;
  dragging.value = false;
  try {
    (event.currentTarget as Element).releasePointerCapture(event.pointerId);
  } catch {
    /* 没捕获成功就无从释放 */
  }
}

/**
 * 点空白处关闭。
 *
 * 只在背景（`self`）上触发，并且拖拽过就不关 ——
 * 平移完抬手时会补一个 click，不加判断就会「拖了一下图，查看器没了」。
 */
function onStageClick(): void {
  if (moved) return;
  close();
}

// ---------------------------------------------------------------------------
// 键盘
// ---------------------------------------------------------------------------

function onKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case "Escape":
      event.preventDefault();
      close();
      break;
    case "+":
    case "=":
      event.preventDefault();
      zoomTo(scale.value * ZOOM_STEP);
      break;
    case "-":
    case "_":
      event.preventDefault();
      zoomTo(scale.value / ZOOM_STEP);
      break;
    case "0":
      event.preventDefault();
      reset();
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// 下载
// ---------------------------------------------------------------------------

/**
 * 下载原图。
 *
 * 跨域图片只要服务端没给 CORS 头就抓不到内容，此时不再自动开新窗口：
 * 下载是异步过程，等结果回来时用户手势已经失效，`window.open` 多半被拦。
 * 改成把选择权交给用户 —— 提示里给一个真链接，点它才是有效手势。
 */
async function onDownload(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  failed.value = false;
  try {
    const inlined = await inlineImages([props.src]);
    const dataUrl =
      inlined.get(props.src) ?? (props.src.startsWith("data:") ? props.src : "");
    if (!dataUrl) throw new Error("图片内容不可读");

    const blob = await (await fetch(dataUrl)).blob();
    downloadBlob(blob, guessImageFilename(props.src, blob.type));
  } catch {
    failed.value = true;
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  // 键盘要能用，焦点得落在查看器内部
  rootRef.value?.focus();
});
</script>

<template>
  <div
    ref="rootRef"
    class="mvs-lightbox"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    :aria-label="alt || '图片预览'"
    @keydown="onKeydown"
  >
    <div
      ref="stageRef"
      class="mvs-lightbox-stage"
      :class="{ 'mvs-dragging': dragging }"
      @click.self="onStageClick"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="onDoubleClick"
    >
      <img
        class="mvs-lightbox-image"
        :src="src"
        :alt="alt"
        :style="{ transform }"
        draggable="false"
      />
    </div>

    <p v-if="failed" class="mvs-lightbox-hint">
      跨域图片无法直接下载，
      <a :href="src" target="_blank" rel="noopener noreferrer">在新标签页打开</a>
      后可右键另存
    </p>

    <div class="mvs-lightbox-bar">
      <button
        type="button"
        class="mvs-lightbox-btn"
        title="缩小（-）"
        :disabled="scale <= limits[0]"
        @click="zoomTo(scale / ZOOM_STEP)"
      >
        －
      </button>
      <span class="mvs-lightbox-scale">{{ percent }}</span>
      <button
        type="button"
        class="mvs-lightbox-btn"
        title="放大（+）"
        :disabled="scale >= limits[1]"
        @click="zoomTo(scale * ZOOM_STEP)"
      >
        ＋
      </button>
      <button
        type="button"
        class="mvs-lightbox-btn mvs-lightbox-reset"
        title="恢复原始大小（0）"
        @click="reset"
      >
        1:1
      </button>
      <button
        v-if="download"
        type="button"
        class="mvs-lightbox-btn"
        title="下载原图"
        :disabled="busy"
        @click="onDownload"
      >
        {{ busy ? "下载中…" : "下载" }}
      </button>
      <button
        type="button"
        class="mvs-lightbox-btn"
        title="关闭（Esc）"
        @click="close"
      >
        关闭
      </button>
    </div>
  </div>
</template>
