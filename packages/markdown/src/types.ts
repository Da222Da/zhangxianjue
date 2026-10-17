/**
 * @zhangxianjue/markdown 的公开类型
 */

/** 编辑器模式，与旧版 markdown-editor-v3 保持一致 */
export type MarkdownMode = "previewOnly" | "edit&preview" | "editOnly";

/**
 * 由宿主注入的图片上传实现
 *
 * 收到待上传的文件，返回可直接写入 markdown 的图片 URL。
 * 抛错即视为上传失败，编辑器不会插入无效图片。
 */
export type FileUploadHandler = (file: File) => Promise<string>;

/** 工具栏按钮名；`|` 表示分隔线 */
export type ToolbarItem =
  | "|"
  | "undo"
  | "redo"
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "sub"
  | "sup"
  | "ruby"
  | "size"
  | "color"
  | "quote"
  | "detail"
  | "h1"
  | "h2"
  | "h3"
  | "header"
  | "ul"
  | "ol"
  | "checklist"
  | "list"
  | "justify"
  | "panel"
  | "image"
  | "link"
  | "hr"
  | "br"
  | "code"
  | "toc";

/** 信息面板类型 */
export type PanelType = "tips" | "info" | "warning" | "danger" | "success";

/** 对齐方式 */
export type AlignType = "left" | "center" | "right";

/** 工具栏发出的命令 */
export type ToolbarCommand =
  | { name: "undo" }
  | { name: "redo" }
  | { name: "bold" }
  | { name: "italic" }
  | { name: "underline" }
  | { name: "strikethrough" }
  | { name: "sub" }
  | { name: "sup" }
  | { name: "ruby" }
  | { name: "quote" }
  | { name: "detail" }
  | { name: "h1" }
  | { name: "h2" }
  | { name: "h3" }
  | { name: "ul" }
  | { name: "ol" }
  | { name: "checklist" }
  | { name: "image" }
  | { name: "link" }
  | { name: "hr" }
  | { name: "br" }
  | { name: "code" }
  | { name: "toc" }
  | { name: "size"; size: number }
  | { name: "color"; color: string; background: boolean }
  | { name: "header"; level: number }
  | { name: "list"; kind: "ul" | "ol" | "checklist" }
  | { name: "align"; align: AlignType }
  | { name: "panel"; type: PanelType };

/** 编辑器组件对外的入参 */
export interface MarkdownProps {
  /** markdown 全文 */
  modelValue?: string;
  /** 渲染模式，默认 previewOnly */
  mode?: MarkdownMode;
  /**
   * 图片上传实现
   *
   * ⚠️ 不传则回退为 base64 内联：正文体积会随图片数量快速膨胀。
   * 本项目 server 的 content 上限为 65535 字节，需要插图时宿主应注入本实现。
   */
  fileUpload?: FileUploadHandler;
  /** 纯编辑 / 分栏模式下 textarea 的占位文案 */
  placeholder?: string;
  /** 容器高度；不传时预览模式随内容撑开，编辑模式由父容器决定 */
  height?: string;
  /** 只读（仍可选择、复制） */
  readonly?: boolean;
  /** 单换行是否渲染为 <br>，默认 true */
  breaks?: boolean;
  /** 工具栏配置；传 false 关闭工具栏 */
  toolbar?: ToolbarItem[] | false;
  /** 目录是否吸顶悬浮，默认 true */
  tocSticky?: boolean;
  /** 目录是否可折叠，默认 true */
  tocCollapsible?: boolean;
  /** 目录初始是否折叠，默认 false */
  tocDefaultCollapsed?: boolean;
  /** 目录生成方式，默认 marker（只有 [TOC] 才生成） */
  tocMode?: "marker" | "auto" | "off";
}

/** 渲染器选项 */
export interface RenderOptions {
  /** 单换行是否渲染为 <br>，默认 true */
  breaks?: boolean;
  /** 自动识别裸链接，默认 true */
  linkify?: boolean;
  /** 排版替换（引号、破折号等），默认 false */
  typographer?: boolean;
  /** `[TOC]` 的标题文案，默认「目录」 */
  tocTitle?: string;
  /**
   * 目录生成方式
   * - `marker`：只有内容里写了 `[TOC]` 才生成（默认）
   * - `auto`：没有 `[TOC]` 时自动在顶部生成
   * - `off`：忽略 `[TOC]`
   */
  tocMode?: "marker" | "auto" | "off";
}

/** 文档中的标题信息，供 TOC 使用 */
export interface HeadingInfo {
  level: number;
  id: string;
  text: string;
}

/** 渲染环境（每次 render 独立） */
export interface MarkdownEnv {
  headings?: HeadingInfo[];
  [key: string]: unknown;
}

/** 文本编辑状态：命令函数的输入输出 */
export interface TextState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** 文本编辑结果 */
export type TextResult = TextState;
