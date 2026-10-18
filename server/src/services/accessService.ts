// src/services/accessService.ts
import { Users } from "../models/index.ts";
import { Permissions } from "../utils/constants/permissions.ts";
import { getPermissionCodesByRoleId } from "./permissionService.ts";
import { downgradeExpiredMembership, UserStatus } from "./userService.ts";

/**
 * 当前请求者的阅读 / 管理能力
 *
 * 公开读接口（书库、笔记）没有 authMiddleware 强制登录，
 * controller 用 optionalAuthMiddleware 解出 userId 后交给本服务统一判定。
 */
export interface ViewerAccess {
  /** 是否携带了有效且启用的账号令牌 */
  isAuthenticated: boolean;
  /** 是否具备 VIP 阅读权益（library:view：会员 / 朋友 / 管理员） */
  canViewVip: boolean;
  /** 是否可管理笔记（note:manage） */
  canManageNotes: boolean;
  /** 是否可读取非限免笔记：VIP 或笔记管理员 */
  canSeeRestrictedNotes: boolean;
}

const GUEST_ACCESS: ViewerAccess = {
  isAuthenticated: false,
  canViewVip: false,
  canManageNotes: false,
  canSeeRestrictedNotes: false,
};

/**
 * 解析访客权益
 *
 * ⚠️ 每次请求都重新读用户状态与角色权限，保证后台调整角色后立即生效；
 * 令牌无效 / 用户被禁用时按游客处理，不阻断公开内容的访问。
 */
export const resolveViewerAccess = async (userId?: number): Promise<ViewerAccess> => {
  if (typeof userId !== "number") {
    return GUEST_ACCESS;
  }

  const user = await Users.findByPk(userId, {
    attributes: ["id", "role_id", "membership_expires_at", "status"],
  });
  if (!user || user.status !== UserStatus.ENABLED) {
    return GUEST_ACCESS;
  }

  // 会员到期立即降级，随后按新角色计算权益
  await downgradeExpiredMembership(user);

  const codes = new Set(await getPermissionCodesByRoleId(user.role_id));
  const canViewVip = codes.has(Permissions.LIBRARY_VIEW);
  const canManageNotes = codes.has(Permissions.NOTE_MANAGE);

  return {
    isAuthenticated: true,
    canViewVip,
    canManageNotes,
    canSeeRestrictedNotes: canViewVip || canManageNotes,
  };
};
