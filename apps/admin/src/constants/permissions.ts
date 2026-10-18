/**
 * 权限编码
 *
 * ⚠️ 必须与 server 的 `src/utils/constants/permissions.ts` 保持一致。
 * 前端只用它控制菜单与路由入口；真正的拦截在服务端中间件。
 */
export const Permissions = {
  ADMIN_ACCESS: "admin:access",
  USER_MANAGE: "user:manage",
  ROLE_MANAGE: "role:manage",
  PERMISSION_MANAGE: "permission:manage",
  ARTICLE_MANAGE: "article:manage",
  NOTE_MANAGE: "note:manage",
  CATEGORY_MANAGE: "category:manage",
  TIMELINE_MANAGE: "timeline:manage",
  UPLOAD_MANAGE: "upload:manage",
  LIBRARY_VIEW: "library:view",
  BOOK_MANAGE: "book:manage",
} as const;

export type PermissionCode = (typeof Permissions)[keyof typeof Permissions];
