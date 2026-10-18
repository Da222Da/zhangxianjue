/**
 * 权限编码表
 *
 * ⚠️ 与 `src/migrations/20261017000009-create-permissions.ts` 里的种子数据保持一致。
 * 迁移刻意不 import 本文件：迁移是历史快照，不能随业务代码演进而改变。
 * 新增权限点时必须同时补迁移（或新增一条迁移插入该权限）。
 */
export const Permissions = {
  /** 登录后台管理端 */
  ADMIN_ACCESS: "admin:access",
  /** 用户管理：增删改查、重置密码、启停 */
  USER_MANAGE: "user:manage",
  /** 角色管理：增删改查 */
  ROLE_MANAGE: "role:manage",
  /** 权限管理：给角色分配权限 */
  PERMISSION_MANAGE: "permission:manage",
  /** 文章管理 */
  ARTICLE_MANAGE: "article:manage",
  /** 笔记管理 */
  NOTE_MANAGE: "note:manage",
  /** 分类管理 */
  CATEGORY_MANAGE: "category:manage",
  /** 时间轴管理 */
  TIMELINE_MANAGE: "timeline:manage",
  /** 图片上传 */
  UPLOAD_MANAGE: "upload:manage",
  /** 书库阅读：仅朋友 / 会员 / 管理员拥有 */
  LIBRARY_VIEW: "library:view",
  /** 书库管理（后台书籍与章节 CRUD） */
  BOOK_MANAGE: "book:manage",
} as const;

export type PermissionCode = (typeof Permissions)[keyof typeof Permissions];

/** 系统内置角色编码 */
export const RoleCodes = {
  /** 管理员：内置角色，拥有全部权限 */
  ADMIN: "admin",
  /** 普通用户：注册后的默认角色 */
  USER: "user",
  /** 会员：可阅读书库，升级申请的目标角色 */
  MEMBER: "member",
  /** 朋友：可阅读书库（由管理员直接分配） */
  FRIEND: "friend",
} as const;

export type RoleCode = (typeof RoleCodes)[keyof typeof RoleCodes];
