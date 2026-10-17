/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "*.css";

/**
 * markdown-it 插件没有自带类型声明时，在这里补一个最小声明。
 * 两个插件都只是「接收 md 实例」的简单插件。
 */
declare module "markdown-it-emoji" {
  import type { MarkdownIt } from "markdown-it";
  type Plugin = (md: MarkdownIt) => void;
  /** 仅短代码 → Unicode，不做额外替换 */
  export const bare: Plugin;
  /** 精简表情集 */
  export const light: Plugin;
  /** 完整 GFM 表情集 */
  export const full: Plugin;
}

declare module "markdown-it-footnote" {
  import type { MarkdownIt } from "markdown-it";
  const plugin: (md: MarkdownIt) => void;
  export default plugin;
}
