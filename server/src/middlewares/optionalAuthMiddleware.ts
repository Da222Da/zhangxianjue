// src/middlewares/optionalAuthMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/token.ts";

/**
 * 可选鉴权中间件
 *
 * 用于对游客开放的读接口：带了有效 access token 就解析出用户，
 * 没带或令牌无效时按游客放行，不返回 401。
 *
 * 载荷与 authMiddleware 一样挂在 `req.body.user`，供 controller 调用
 * accessService 判定 VIP 权益。
 */
export const optionalAuthMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token, "access");
    if (!req.body) {
      req.body = {};
    }
    req.body.user = decoded;
  } catch {
    // 令牌无效 / 过期：公开接口不阻断，按游客处理
  }

  next();
};
