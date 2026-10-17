import "./styles/index.css";
import type { App, Plugin } from "vue";
import MarkmapSketch from "./components/MarkmapSketch.vue";
import MarkmapEditor from "./components/MarkmapEditor.vue";

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------
export { MarkmapSketch, MarkmapEditor };

// ---------------------------------------------------------------------------
// 核心能力（可单独使用，不依赖 Vue）
// ---------------------------------------------------------------------------
export { parseMarkdown, flattenTree, findNode, findNodePath } from "./core/parser";
export { splitFrontmatter, parseYamlScalar } from "./core/frontmatter";
export {
  parseInlineContent,
  parseInlineRuns,
  runsToText,
  splitRunsByLines,
  wrapRuns,
} from "./core/richtext";
export {
  DEFAULT_LINK_ICONS,
  isExternalHref,
  renderInline,
} from "./core/markdown";
export {
  getNaturalSize,
  setNaturalSize,
  resolveImageLayout,
  guessImageFilename,
  IMAGE_PLACEHOLDER_RATIO,
  IMAGE_PLACEHOLDER_WIDTH,
} from "./core/images";
export {
  TOGGLE_FONT_RATIO,
  computeLayout,
  createLinkD,
  getToggleBadge,
  leftAnchor,
  rightAnchor,
} from "./core/layout";
export {
  CODE_FONT_RATIO,
  CODE_GAP,
  CODE_LINE_HEIGHT,
  CODE_PADDING,
  IMAGE_GAP,
  INLINE_CODE_FONT_RATIO,
  INLINE_CODE_PADDING,
  createNodeMeasurer,
  wrapText,
} from "./core/measure";
export {
  DEFAULT_COLORS,
  DEFAULT_OPTIONS,
  ROOT_COLOR,
  getLineColor,
  getNodeColor,
  getNodeFill,
  pickOptionsFromFrontmatter,
  resolveOptions,
  withAlpha,
} from "./core/options";
export { SketchRenderer } from "./core/renderer";
export { ZoomController } from "./core/zoom";
export { Animator } from "./core/animate";
export { downloadBlob, exportPng, inlineImages, serializeSvg } from "./core/export";
export {
  clamp,
  easeCubicInOut,
  escapeHtml,
  hashString,
  hashToSeed,
  isWideChar,
  lerp,
} from "./core/utils";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------
export type {
  LayoutLink,
  LayoutNode,
  LayoutResult,
  LinkIcons,
  MarkmapOptions,
  NodeImage,
  NodeImageLayout,
  NodeMeasurer,
  NodeMetrics,
  NodeTag,
  NodeTextLayout,
  ParseResult,
  ResolvedMarkmapOptions,
  SketchFillStyle,
  TextRun,
  TreeNode,
  TreeNodePayload,
} from "./types";
export type { ContentBox, ZoomControllerOptions } from "./core/zoom";
export type { ToggleBadge } from "./core/layout";
export type { SketchRendererEvents } from "./core/renderer";
export type { ExportPngOptions, ExportSvgOptions } from "./core/export";
export type { LayoutContext } from "./core/layout";

/** 供 `app.use()` 全局注册 */
const plugin: Plugin = {
  install(app: App) {
    app.component("MarkmapSketch", MarkmapSketch);
    app.component("MarkmapEditor", MarkmapEditor);
  },
};

export default plugin;
