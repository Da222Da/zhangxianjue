// src/types/router.d.ts
import "vue-router";
import type { PermissionCode } from "@/constants/permissions";

declare module "vue-router" {
  interface RouteMeta {
    /**
     * 标记公开页面（无需登录）
     *
     * ⚠️ 采用「默认受保护」策略：未显式标记 public 的路由一律要求登录，
     * 避免新增页面时忘记加限制而出现越权入口。
     */
    public?: boolean;
    /** 页面标题，供侧边栏或文档引用 */
    title?: string;
    /**
     * 访问该页面所需的权限编码
     *
     * 由路由守卫校验；侧边栏也据此隐藏菜单项。
     * 未声明表示只要求登录，不额外校验权限。
     */
    permission?: PermissionCode;
  }
}
