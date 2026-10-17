/// <reference types="vite/client" />

/** 环境变量类型声明，未配置时由代码内的默认值兜底 */
interface ImportMetaEnv {
  /** 后端接口地址，缺省回退到 http://localhost:3000/api */
  readonly VITE_API_BASE_URL?: string;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// @zhangxianjue/markdown 的类型声明由包内 types/index.d.ts 提供，无需在此声明
