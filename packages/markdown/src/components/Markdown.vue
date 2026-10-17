<!-- src/components/Markdown.vue -->
<template>
  <div class="md-editor" :class="[`md-editor--${modeClass}`, { 'md-editor--readonly': readonly }]" :style="heightStyle">
    <MarkdownToolbar
      v-if="showToolbar"
      :items="toolbarItems"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :disabled="readonly"
      @command="handleCommand"
    />

    <div class="md-editor__body">
      <div v-if="mode !== 'previewOnly'" class="md-editor__pane md-editor__pane--source">
        <textarea
          ref="textareaRef"
          class="md-editor__textarea"
          :value="content"
          :placeholder="placeholder"
          :readonly="readonly"
          spellcheck="false"
          @input="handleInput"
          @keydown="handleKeydown"
        />
      </div>

      <div
        v-if="mode !== 'editOnly'"
        ref="previewPaneRef"
        class="md-editor__pane md-editor__pane--preview"
      >
        <MarkdownPreview
          :value="content"
          :breaks="breaks"
          :toc-sticky="tocSticky"
          :toc-collapsible="tocCollapsible"
          :toc-default-collapsed="tocDefaultCollapsed"
          :toc-mode="tocMode"
        />
      </div>
    </div>

    <input ref="fileInputRef" class="md-editor__file" type="file" accept="image/*" @change="handleFileChange" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import MarkdownPreview from "./MarkdownPreview.vue";
import MarkdownToolbar from "./MarkdownToolbar.vue";
import { useEditorHistory } from "../composables/useEditorHistory";
import {
  applyColor,
  applyFontSize,
  insertBr,
  insertCodeBlock,
  insertDetail,
  insertHr,
  insertImage,
  insertLink,
  insertPanel,
  insertRuby,
  insertToc,
  setAlign,
  setHeading,
  setList,
  setQuote,
  toggleWrapSelection,
} from "../core/commands";
import { DEFAULT_TOOLBAR } from "../core/toolbar";
import type { MarkdownMode, MarkdownProps, TextResult, TextState, ToolbarCommand, ToolbarItem } from "../types";

defineOptions({ name: "Markdown" });

const props = withDefaults(defineProps<MarkdownProps>(), {
  modelValue: "",
  mode: "previewOnly",
  placeholder: "请输入 Markdown 内容…",
  height: "",
  readonly: false,
  breaks: true,
  toolbar: () => DEFAULT_TOOLBAR,
  tocSticky: true,
  tocCollapsible: true,
  tocDefaultCollapsed: false,
  tocMode: "marker",
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  error: [error: Error];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const previewPaneRef = ref<HTMLDivElement | null>(null);
const content = ref(props.modelValue);

const modeClass = computed(() => props.mode.replace("&", "-"));

const toolbarItems = computed<ToolbarItem[]>(() => (props.toolbar === false ? [] : props.toolbar));

const showToolbar = computed(() => props.mode !== "previewOnly" && toolbarItems.value.length > 0);

const heightStyle = computed<Record<string, string> | undefined>(() =>
  props.height ? { height: props.height } : undefined,
);

const updateContent = (value: string): void => {
  if (value === content.value) {
    return;
  }
  content.value = value;
  emit("update:modelValue", value);
};

const getState = (): TextState => {
  const el = textareaRef.value;
  if (!el) {
    return {
      value: content.value,
      selectionStart: content.value.length,
      selectionEnd: content.value.length,
    };
  }
  return {
    value: content.value,
    selectionStart: el.selectionStart,
    selectionEnd: el.selectionEnd,
  };
};

const applyState = (state: TextResult): void => {
  content.value = state.value;
  emit("update:modelValue", state.value);
  void nextTick(() => {
    const el = textareaRef.value;
    if (!el) {
      return;
    }
    el.focus();
    el.setSelectionRange(state.selectionStart, state.selectionEnd);
  });
};

const { canUndo, canRedo, recordInput, snapshotBeforeEdit, undo, redo, reset, markBaseline } =
  useEditorHistory({
    getState,
    applyState,
  });

const handleInput = (event: Event): void => {
  const el = event.target as HTMLTextAreaElement;
  recordInput(el.selectionStart, el.selectionEnd);
  updateContent(el.value);
};

/**
 * 执行一次文本命令
 *
 * `selection` 用于图片这类「焦点已经离开 textarea」的场景：
 * 打开文件选择框前先记下选区，回来后再按记忆的选区插入。
 */
const applyEdit = (
  edit: (state: TextState) => TextResult,
  selection?: { start: number; end: number },
): void => {
  const el = textareaRef.value;
  if (!el || props.readonly) {
    return;
  }
  snapshotBeforeEdit();
  const state: TextState = selection
    ? { value: content.value, selectionStart: selection.start, selectionEnd: selection.end }
    : { value: content.value, selectionStart: el.selectionStart, selectionEnd: el.selectionEnd };
  const result = edit(state);
  applyState(result);
  // 命令执行前的历史已经压栈，输入基线要更新到命令后的文本，
  // 否则紧接着输入再撤销会跳过这次格式修改
  markBaseline(result.value);
};

const promptText = (message: string, defaultValue: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.prompt(message, defaultValue);
};

/** 打开图片选择框前记录选区（文件选择框会抢走焦点） */
let savedSelection: { start: number; end: number } | null = null;

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });

const handleFileChange = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    savedSelection = null;
    return;
  }

  try {
    const url = props.fileUpload ? await props.fileUpload(file) : await readAsDataUrl(file);
    const alt = file.name.replace(/\.[^.]+$/, "") || "图片";
    applyEdit((state) => insertImage(state, url, alt), savedSelection ?? undefined);
  } catch (error) {
    emit("error", error instanceof Error ? error : new Error("图片上传失败"));
  } finally {
    savedSelection = null;
  }
};

const handleCommand = (command: ToolbarCommand): void => {
  if (props.readonly) {
    return;
  }

  switch (command.name) {
    case "undo":
      undo();
      return;
    case "redo":
      redo();
      return;
    case "bold":
      applyEdit((state) => toggleWrapSelection(state, "**", "**", "加粗文字"));
      return;
    case "italic":
      applyEdit((state) => toggleWrapSelection(state, "*", "*", "斜体文字"));
      return;
    case "underline":
      applyEdit((state) => toggleWrapSelection(state, "++", "++", "下划线文字"));
      return;
    case "strikethrough":
      applyEdit((state) => toggleWrapSelection(state, "~~", "~~", "删除线文字"));
      return;
    case "sub":
      applyEdit((state) => toggleWrapSelection(state, "^^", "^^", "下标"));
      return;
    case "sup":
      applyEdit((state) => toggleWrapSelection(state, "^", "^", "上标"));
      return;
    case "ruby": {
      const pinyin = promptText("请输入拼音 / 注音", "");
      if (pinyin === null) {
        return;
      }
      applyEdit((state) => insertRuby(state, pinyin));
      return;
    }
    case "size":
      applyEdit((state) => applyFontSize(state, command.size));
      return;
    case "color":
      applyEdit((state) => applyColor(state, command.color, command.background));
      return;
    case "quote":
      applyEdit(setQuote);
      return;
    case "detail":
      applyEdit(insertDetail);
      return;
    case "h1":
      applyEdit((state) => setHeading(state, 1));
      return;
    case "h2":
      applyEdit((state) => setHeading(state, 2));
      return;
    case "h3":
      applyEdit((state) => setHeading(state, 3));
      return;
    case "header":
      applyEdit((state) => setHeading(state, command.level));
      return;
    case "ul":
      applyEdit((state) => setList(state, "ul"));
      return;
    case "ol":
      applyEdit((state) => setList(state, "ol"));
      return;
    case "checklist":
      applyEdit((state) => setList(state, "checklist"));
      return;
    case "list":
      applyEdit((state) => setList(state, command.kind));
      return;
    case "align":
      applyEdit((state) => setAlign(state, command.align));
      return;
    case "panel":
      applyEdit((state) => insertPanel(state, command.type));
      return;
    case "image": {
      const el = textareaRef.value;
      savedSelection = el ? { start: el.selectionStart, end: el.selectionEnd } : null;
      fileInputRef.value?.click();
      return;
    }
    case "link": {
      const url = promptText("请输入链接地址", "https://");
      if (!url || !url.trim()) {
        return;
      }
      applyEdit((state) => insertLink(state, url.trim()));
      return;
    }
    case "hr":
      applyEdit(insertHr);
      return;
    case "br":
      applyEdit(insertBr);
      return;
    case "code":
      applyEdit((state) => insertCodeBlock(state));
      return;
    case "toc":
      applyEdit(insertToc);
      return;
  }
};

const handleKeydown = (event: KeyboardEvent): void => {
  // 输入法组合期间不要抢 Ctrl+Z / Ctrl+B
  if (event.isComposing) {
    return;
  }
  const modifier = event.ctrlKey || event.metaKey;
  if (!modifier) {
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
    return;
  }
  if (key === "y") {
    event.preventDefault();
    redo();
    return;
  }
  if (key === "b") {
    event.preventDefault();
    handleCommand({ name: "bold" });
    return;
  }
  if (key === "i") {
    event.preventDefault();
    handleCommand({ name: "italic" });
    return;
  }
  if (key === "u") {
    event.preventDefault();
    handleCommand({ name: "underline" });
  }
};

watch(
  () => props.modelValue,
  (value) => {
    if (value === content.value) {
      return;
    }
    content.value = value;
    reset(value);
  },
);

// ---------------------------------------------------------------------------
// 目录定位
//
// 目录用 position: fixed：left 始终对准预览区的左边缘（而不是浏览器视口），
// previewOnly 垂直居中于视口；分栏编辑时垂直居中于右侧预览面板。
// 坐标写进 CSS 变量，目录保持 fixed —— 面板内部滚动时不会跟着内容跑。
// ---------------------------------------------------------------------------
let paneResizeObserver: ResizeObserver | null = null;

const syncTocPanePosition = (): void => {
  const pane = previewPaneRef.value;
  if (!pane) {
    return;
  }
  const rect = pane.getBoundingClientRect();
  // 目录的 left: 0 始终相对预览区左边缘
  pane.style.setProperty("--md-toc-pane-left", `${rect.left}px`);
  if (props.mode === "edit&preview") {
    // 分栏时垂直中心也对准预览面板；previewOnly 用视口 50%
    pane.style.setProperty("--md-toc-pane-center-y", `${rect.top + rect.height / 2}px`);
  } else {
    pane.style.removeProperty("--md-toc-pane-center-y");
  }
};

const setupTocPaneObserver = (): void => {
  paneResizeObserver?.disconnect();
  paneResizeObserver = null;
  const pane = previewPaneRef.value;
  if (!pane) {
    return;
  }
  if (typeof ResizeObserver !== "undefined") {
    paneResizeObserver = new ResizeObserver(syncTocPanePosition);
    paneResizeObserver.observe(pane);
  }
  syncTocPanePosition();
};

watch(
  () => props.mode,
  () => {
    void nextTick(setupTocPaneObserver);
  },
);

onMounted(() => {
  void nextTick(setupTocPaneObserver);
  window.addEventListener("resize", syncTocPanePosition);
  // capture 能同时收到页面滚动与预览面板内部滚动
  window.addEventListener("scroll", syncTocPanePosition, true);
});

onBeforeUnmount(() => {
  paneResizeObserver?.disconnect();
  paneResizeObserver = null;
  window.removeEventListener("resize", syncTocPanePosition);
  window.removeEventListener("scroll", syncTocPanePosition, true);
});

defineExpose({
  /** 主动取回当前 markdown（与旧组件保持同名 API） */
  getMarkdownContent: (): string => content.value,
  focus: (): void => textareaRef.value?.focus(),
});
</script>
