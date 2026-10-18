// src/types/router.d.ts
import "vue-router";
import type { RouteLocationNormalizedLoaded } from "vue-router";
import type { PermissionCode } from "@/constants/permissions";

/**
 * 面包屑分区：渲染为 `EN / 中文` 的形式，例如 `NOTES / 攻略笔记`
 *
 * 由 `Breadcrumb.vue` 消费。放在路由 meta 上而不是组件里写死，
 * 是为了让「哪个路由属于哪个分区」和路由表住在一起，新增页面时一眼能看到。
 */
export interface RouteSection {
  /** 英文短名，渲染时统一转大写 */
  en: string;
  /** 中文名 */
  zh: string;
  /**
   * 分区落地页路径。省略表示该分区没有列表页（如文章详情），
   * 此时分区名不可点击，面包屑也会一并显示当前页标题。
   */
  to?: string;
  /**
   * 顶部导航中的顺序，从 1 开始。**省略即不进入顶部导航**
   * （详情页也带 section，但不会出现在导航里）。
   *
   * ⚠️ 必须显式给出：`router.getRoutes()` 的返回顺序由路由匹配器决定，
   * 并不等于路由表里的声明顺序（动态参数路由会排在静态路由前面）。
   */
  navOrder?: number;
}

declare module "vue-router" {
  interface RouteMeta {
    /** 页面标题；函数形式用于详情页这类标题随参数变化的场景 */
    title?: string | ((route: RouteLocationNormalizedLoaded) => string | undefined);
    /** 面包屑分区，格式为 `EN / 中文` */
    section?: RouteSection;
    /** 是否要求登录；未登录会被路由守卫送到登录页并带上 redirect */
    requiresAuth?: boolean;
    /** 访问该页面所需权限；登录但权限不足时会被送到个人中心的升级入口 */
    permission?: PermissionCode;
  }
}
