import type { AlignType, PanelType, ToolbarItem } from "../types";

/** 默认工具栏：按「功能类 → 字体样式 → 段落属性 → 插入类」分组 */
export const DEFAULT_TOOLBAR: ToolbarItem[] = [
  "undo",
  "redo",
  "|",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "sub",
  "sup",
  "ruby",
  "size",
  "color",
  "|",
  "quote",
  "detail",
  "h1",
  "h2",
  "h3",
  "header",
  "ul",
  "ol",
  "checklist",
  "list",
  "justify",
  "panel",
  "|",
  "image",
  "link",
  "hr",
  "br",
  "code",
  "toc",
];

/** 按钮文案与 tooltip */
export const TOOLBAR_META: Record<Exclude<ToolbarItem, "|">, { label: string; title: string }> = {
  undo: { label: "↶", title: "撤销" },
  redo: { label: "↷", title: "重做" },
  bold: { label: "B", title: "加粗" },
  italic: { label: "I", title: "斜体" },
  underline: { label: "U", title: "下划线" },
  strikethrough: { label: "S", title: "删除线" },
  sub: { label: "X₂", title: "下标" },
  sup: { label: "X²", title: "上标" },
  ruby: { label: "注", title: "注音（文字 + 拼音）" },
  size: { label: "A↕", title: "字号" },
  color: { label: "A", title: "文字颜色 / 背景色" },
  quote: { label: "❝", title: "引用" },
  detail: { label: "⌄", title: "手风琴（可展开收起）" },
  h1: { label: "H1", title: "一级标题" },
  h2: { label: "H2", title: "二级标题" },
  h3: { label: "H3", title: "三级标题" },
  header: { label: "H", title: "标题级别" },
  ul: { label: "•", title: "无序列表" },
  ol: { label: "1.", title: "有序列表" },
  checklist: { label: "☑", title: "任务清单" },
  list: { label: "≡", title: "列表类型" },
  justify: { label: "↔", title: "对齐方式" },
  panel: { label: "▤", title: "信息面板" },
  image: { label: "图", title: "插入图片" },
  link: { label: "链", title: "插入链接（B 站视频会渲染为播放器）" },
  hr: { label: "—", title: "水平分割线" },
  br: { label: "⏎", title: "插入换行" },
  code: { label: "</>", title: "代码块" },
  toc: { label: "☰", title: "插入目录" },
};

/** 带二级菜单的按钮 */
export const SUBMENU_ITEMS: ReadonlySet<ToolbarItem> = new Set([
  "size",
  "color",
  "header",
  "list",
  "justify",
  "panel",
]);

/** 字号子菜单：小 / 中 / 大 / 特大 */
export const SIZE_OPTIONS: ReadonlyArray<{ label: string; value: number }> = [
  { label: "小", value: 14 },
  { label: "中", value: 16 },
  { label: "大", value: 20 },
  { label: "特大", value: 24 },
];

/** 标题子菜单：1–5 级 */
export const HEADER_OPTIONS: ReadonlyArray<{ label: string; value: number }> = [
  { label: "一级标题", value: 1 },
  { label: "二级标题", value: 2 },
  { label: "三级标题", value: 3 },
  { label: "四级标题", value: 4 },
  { label: "五级标题", value: 5 },
];

/** 列表子菜单 */
export const LIST_OPTIONS: ReadonlyArray<{ label: string; value: "ul" | "ol" | "checklist" }> = [
  { label: "无序列表", value: "ul" },
  { label: "有序列表", value: "ol" },
  { label: "任务清单", value: "checklist" },
];

/** 对齐子菜单 */
export const ALIGN_OPTIONS: ReadonlyArray<{ label: string; value: AlignType }> = [
  { label: "左对齐", value: "left" },
  { label: "居中", value: "center" },
  { label: "右对齐", value: "right" },
];

/** 信息面板子菜单 */
export const PANEL_OPTIONS: ReadonlyArray<{ label: string; value: PanelType }> = [
  { label: "提示 tips", value: "tips" },
  { label: "信息 info", value: "info" },
  { label: "警告 warning", value: "warning" },
  { label: "危险 danger", value: "danger" },
  { label: "成功 success", value: "success" },
];

/** 颜色快捷色板 */
export const COLOR_PRESETS: ReadonlyArray<string> = [
  "#e74c3c",
  "#e67e22",
  "#f1c40f",
  "#2ecc71",
  "#3498db",
  "#9b59b6",
  "#34495e",
  "#2f3542",
];
