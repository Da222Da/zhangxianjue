// src/middlewares/permissionMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import { sendErrorResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { Users } from "../models/index.ts";
import type { PermissionCode } from "../utils/constants/permissions.ts";
import { getPermissionCodesByRoleId } from "../services/permissionService.ts";
import { downgradeExpiredMembership, UserStatus } from "../services/userService.ts";

/**
 * 权限校验中间件
 *
 * 必须挂在 authMiddleware **之后** —— 它依赖 authMiddleware 写入的 `req.body.user`。
 * 每次请求都重新读取用户的当前角色与状态：
 * - 角色权限调整后立即生效，不必等 accessToken 过期；
 * - 被禁用的账号可立即失去写操作权限。
 *
 * @param allowedCodes 允许通过任一权限编码即可（OR 语义）
 */
export const requirePermission = (...allowedCodes: PermissionCode[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.body?.user?.id;
      if (typeof userId !== "number") {
        sendErrorResponse(res, HttpStatusCode.UNAUTHORIZED, "未获取到用户信息，请先登录");
        return;
      }

      const user = await Users.findByPk(userId, {
        attributes: ["id", "role_id", "membership_expires_at", "status"],
      });
      if (!user) {
        sendErrorResponse(res, HttpStatusCode.UNAUTHORIZED, "用户不存在，请重新登录");
        return;
      }
      if (user.status !== UserStatus.ENABLED) {
        sendErrorResponse(res, HttpStatusCode.FORBIDDEN, "账号已被禁用，请联系管理员");
        return;
      }

      // 会员到期后立即降级，随后按新角色权限判定
      await downgradeExpiredMembership(user);

      const ownedCodes = new Set(await getPermissionCodesByRoleId(user.role_id));
      if (!allowedCodes.some((code) => ownedCodes.has(code))) {
        sendErrorResponse(res, HttpStatusCode.FORBIDDEN, "当前账号无权执行此操作");
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
