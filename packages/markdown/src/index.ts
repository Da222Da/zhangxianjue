import "./styles/index.css";
import type { App, Plugin } from "vue";
import Markdown from "./components/Markdown.vue";
import MarkdownRenderer from "./components/MarkdownPreview.vue";

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------
export { Markdown, MarkdownRenderer };

// ---------------------------------------------------------------------------
// 渲染器 / 工具栏（可单独使用，不依赖 Vue 组件）
// ---------------------------------------------------------------------------
export { createMarkdownRenderer, renderMarkdown } from "./core/renderer";
export {
  ALIGN_OPTIONS,
  COLOR_PRESETS,
  DEFAULT_TOOLBAR,
  HEADER_OPTIONS,
  LIST_OPTIONS,
  PANEL_OPTIONS,
  SIZE_OPTIONS,
  SUBMENU_ITEMS,
  TOOLBAR_META,
} from "./core/toolbar";

// ---------------------------------------------------------------------------
// 文本命令（宿主可以拿去做自定义工具栏）
// ---------------------------------------------------------------------------
export {
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
  insertText,
  insertToc,
  setAlign,
  setHeading,
  setList,
  setQuote,
  toggleLinePrefix,
  toggleWrapSelection,
  wrapSelection,
} from "./core/commands";
export { slugify } from "./core/slug";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------
export type {
  AlignType,
  FileUploadHandler,
  HeadingInfo,
  MarkdownEnv,
  MarkdownMode,
  MarkdownProps,
  PanelType,
  RenderOptions,
  TextResult,
  TextState,
  ToolbarCommand,
  ToolbarItem,
} from "./types";

/** 供 `app.use()` 全局注册（注册名 `<Markdown>`） */
const plugin: Plugin = {
  install(app: App) {
    app.component("Markdown", Markdown);
  },
};

export default plugin;
