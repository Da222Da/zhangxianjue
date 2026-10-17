// src/utils/token.ts
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN } from "../config/env.ts";
import { UnauthorizedError } from "./errors.ts";

/** 令牌用途标记 */
export type TokenType = "access" | "refresh";

/** 令牌载荷 */
export interface AuthTokenPayload extends JwtPayload {
  /** 用户主键 */
  id: number;
  /** 角色 id，与 Users.role_id 对应 */
  role_id: number;
  /** 令牌用途 */
  type: TokenType;
}

/** 读取签名密钥；未配置时直接抛错，避免用 undefined 当密钥签发令牌 */
const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET 未配置，请检查 server/.env");
  }
  return secret;
};

/**
 * 签发令牌
 *
 * ⚠️ `type` 字段必不可少：access 与 refresh 用同一密钥签发，
 * 若不区分用途，访问令牌可以直接拿去换新令牌、刷新令牌也能当访问令牌用。
 */
export const signToken = (payload: { id: number; role_id: number }, type: TokenType): string =>
  jwt.sign({ id: payload.id, role_id: payload.role_id, type }, getSecret(), {
    expiresIn: type === "access" ? JWT_EXPIRES_IN : JWT_REFRESH_EXPIRES_IN,
  });

/**
 * 校验令牌并确认其用途
 * @throws {UnauthorizedError} 令牌无效、过期，或用途不符
 */
export const verifyToken = (token: string, expected: TokenType): AuthTokenPayload => {
  let decoded: AuthTokenPayload;
  try {
    decoded = jwt.verify(token, getSecret()) as AuthTokenPayload;
  } catch {
    throw new UnauthorizedError("令牌无效或已过期");
  }

  if (decoded.type !== expected) {
    throw new UnauthorizedError("令牌类型不正确");
  }

  return decoded;
};
