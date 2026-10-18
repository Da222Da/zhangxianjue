// src/middlewares/authMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import { sendErrorResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { verifyToken } from "../utils/token.ts";

/**
 * 鉴权中间件
 *
 * 校验 `Authorization: Bearer <token>`，通过后把令牌载荷挂到 `req.body.user`，
 * 供后续的 permissionMiddleware 与 controller 使用。
 *
 * ⚠️ 只接受用途为 access 的令牌：刷新令牌不能直接访问业务接口。
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // 1. 从请求头中获取 token
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendErrorResponse(res, HttpStatusCode.UNAUTHORIZED, "未提供令牌，请先登录");
  }

  // 2. 提取 token 字符串（去掉 'Bearer ' 前缀）
  const token = authHeader.split(" ")[1];

  try {
    // 3. 验证并解码 token（内含用途校验）
    const decoded = verifyToken(token, "access");

    // 4. 将用户信息挂载到 req.body.user 上，供后续中间件与 controller 使用
    if (!req.body) req.body = {}; // 如果没有 req.body，则初始化为空对象
    req.body.user = decoded; // 包含 id, role_id

    next(); // 验证通过，放行
  } catch {
    return sendErrorResponse(res, HttpStatusCode.UNAUTHORIZED, "无效的 token");
  }
};
