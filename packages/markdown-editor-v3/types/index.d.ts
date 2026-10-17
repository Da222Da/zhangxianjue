/**
 * @zhangxianjue/markdown-editor-v3 的公开类型
 *
 * ⚠️ 本文件是**手写**的：package.json 的 `types` 指向这里，但构建（vite build）
 * 并未通过 vite-plugin-dts 生成该目录，所以类型需要人工维护。
 * **改动 src/ 下的 props / emits / defineExpose 时，必须同步本文件。**
 * （更彻底的做法是在 vite.config.ts 中启用 vite-plugin-dts 自动生成。）
 */
import type { DefineComponent, Plugin } from "vue";

/** 编辑器模式，与 UseOptions 的 switch 分支一一对应 */
export type MarkdownMode = "previewOnly" | "edit&preview" | "editOnly";

/**
 * 由宿主注入的图片上传实现
 *
 * 收到待上传的文件，返回可直接写入 markdown 的图片 URL。
 * 抛错即视为上传失败，编辑器不会插入无效图片。
 */
export type FileUploadHandler = (file: File) => Promise<string>;

/** 编辑器组件对外的入参 */
export interface MarkdownEditorProps {
  /** 渲染模式，默认 previewOnly */
  mode?: MarkdownMode;
  /** markdown 全文 */
  modelValue?: string;
  /**
   * 图片上传实现
   *
   * ⚠️ 不传则沿用 cherry-markdown 的默认行为：图片会被转成 base64 内联进正文，
   * 正文体积将随图片数量快速增长。若后端对正文长度有限制，可能直接保存失败。
   */
  fileUpload?: FileUploadHandler;
}

/** 通过模板 ref 拿到的实例成员，对应 src/App.vue 的 defineExpose */
export interface MarkdownEditorExpose {
  /** 取当前编辑器中的 markdown 全文（优先走 Cherry 实例的 getValue） */
  getMarkdownContent(): string;
  /** 底层 Cherry 实例 */
  editor: unknown;
}

/**
 * 编辑器组件本体
 *
 * 第二个泛型槽（RawBindings）承载 defineExpose 暴露的成员，
 * 因此 `ref<InstanceType<typeof Markdown>>` 上能直接点到 getMarkdownContent。
 */
export const Markdown: DefineComponent<
  MarkdownEditorProps,
  MarkdownEditorExpose,
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  { "update:modelValue": (value: string) => void }
>;

/** 默认导出是插件：install 时把 Markdown 注册为全局组件（见 src/index.ts） */
declare const plugin: Plugin;
export default plugin;
