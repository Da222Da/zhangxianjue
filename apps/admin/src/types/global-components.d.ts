// src/types/global-components.d.ts

/**
 * 全局组件类型声明
 *
 * ⚠️ 本文件必须保持「模块」身份（因此有顶层 import），否则
 * `declare module "vue"` 会从模块增强退化为环境模块声明，把 vue 整个替换掉。
 *
 * 运行期由 main.ts 里的 `app.use(Markdown)` 注册（包的默认导出是插件），
 * 这里只补类型，让模板中的 <Markdown> 参与类型检查。
 */
import type { Markdown } from "@zhangxianjue/markdown-editor-v3";

declare module "vue" {
  export interface GlobalComponents {
    Markdown: typeof Markdown;
  }
}
