/// <reference types="vite/client" />

/** 环境变量类型声明，未配置时由代码内的默认值兜底 */
interface ImportMetaEnv {
  /** 后端接口地址，缺省回退到 http://localhost:3000/api */
  readonly VITE_API_BASE_URL?: string;
  /** 本地开发自动登录开关 */
  readonly VITE_DEV_AUTO_LOGIN?: string;
  /** 本地开发自动登录：手机号（与 USERNAME 二选一，优先手机号） */
  readonly VITE_DEV_AUTO_LOGIN_PHONE?: string;
  /** 本地开发自动登录：用户名（与 PHONE 二选一） */
  readonly VITE_DEV_AUTO_LOGIN_USERNAME?: string;
  /** 本地开发自动登录：密码；留空则回退到 server/.env 的 DEV_LOGIN_* */
  readonly VITE_DEV_AUTO_LOGIN_PASSWORD?: string;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// @zhangxianjue/markdown 与 @zhangxianjue/markmap 的类型
// 均由各自包内的 types/index.d.ts 提供，无需在此声明
