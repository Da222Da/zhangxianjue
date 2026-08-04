/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "@zhangxianjue/markdown" {
  const Markdown: any;
  export { Markdown };
}
