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
   * ⚠️ 不传则沿用 cherry-markdown 的默认行为：图片会被转成 base64
   * 内联进正文。正文体积将随图片数量快速增长，若后端对正文长度有限制
   * （本项目 server 的 content 上限为 65535 字节），会直接保存失败。
   * 需要正文插图时，宿主应注入本实现。
   */
  fileUpload?: FileUploadHandler;
}
