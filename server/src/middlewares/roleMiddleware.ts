// src/middlewares/roleMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import { sendErrorResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";

/**
 * 角色 id 约定，与 Users.role_id 对应
 *
 * ⚠️ 当前没有独立的角色表，role_id 是裸整数：1 由种子/手工指定，
 * 2 是注册接口对所有新用户写死的默认值。
 */
export const RoleId = {
  /** 管理员：可维护文章与上传图片 */
  ADMIN: 1,
  /** 普通用户：注册后的默认角色，只读 */
  USER: 2,
} as const;

/**
 * 授权中间件：要求当前用户属于指定角色之一
 *
 * ⚠️ 必须挂在 authMiddleware **之后** —— 它依赖 authMiddleware 写入的 `req.body.user`。
 * 前置中间件缺失时返回 401 而非 403，以免把「未登录」误报成「已登录但无权限」。
 *
 * @param allowedRoleIds 允许通过的角色 id
 */
export const roleMiddleware = (...allowedRoleIds: number[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const roleId = req.body?.user?.role_id;

    if (typeof roleId !== "number") {
      return sendErrorResponse(res, HttpStatusCode.UNAUTHORIZED, "未获取到用户角色，请先登录");
    }

    if (!allowedRoleIds.includes(roleId)) {
      return sendErrorResponse(res, HttpStatusCode.FORBIDDEN, "当前账号无权执行此操作");
    }

    next();
  };
};

/** 仅管理员可执行 */
export const adminOnly = roleMiddleware(RoleId.ADMIN);
