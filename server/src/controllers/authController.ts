// src/controllers/authController.ts
import type { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { BadRequestError, ForbiddenError } from "../utils/errors.ts";
import * as authService from "../services/authService.ts";
import * as captchaService from "../services/captchaService.ts";
import { assertPasswordLength, MAX_PASSWORD_LENGTH } from "../services/userService.ts";
import { DEV_LOGIN_PASSWORD, DEV_LOGIN_PHONE, DEV_LOGIN_USERNAME } from "../config/env.ts";

/** 用户名：2-32 位，允许中英文、数字、下划线与连字符 */
const USERNAME_PATTERN = /^[\w一-龥-]{2,32}$/u;
/** 中国大陆手机号 */
const PHONE_PATTERN = /^1[3-9]\d{9}$/;

/** 读取必填字符串并 trim */
const parseRequiredString = (raw: unknown, field: string): string => {
  if (typeof raw !== "string") {
    throw new BadRequestError(`${field} 必须为字符串`);
  }
  const value = raw.trim();
  if (!value) {
    throw new BadRequestError(`${field} 不能为空`);
  }
  return value;
};

/**
 * 读取密码
 *
 * ⚠️ 不 trim：首尾空格也是密码的一部分。
 */
const parsePassword = (raw: unknown, field = "password"): string => {
  if (typeof raw !== "string") {
    throw new BadRequestError(`${field} 必须为字符串`);
  }
  if (!raw) {
    throw new BadRequestError(`${field} 不能为空`);
  }
  if (raw.length > MAX_PASSWORD_LENGTH) {
    throw new BadRequestError(`${field} 长度不能超过 ${MAX_PASSWORD_LENGTH} 个字符`);
  }
  assertPasswordLength(raw);
  return raw;
};

/** 校验手机号 */
const parsePhone = (raw: unknown): string => {
  const phone = parseRequiredString(raw, "phone");
  if (!PHONE_PATTERN.test(phone)) {
    throw new BadRequestError("手机号格式不正确");
  }
  return phone;
};

/** 从请求体校验图形验证码 */
const verifyCaptcha = (body: Record<string, unknown>): void => {
  captchaService.assertCaptcha(body.captchaId, body.captchaCode);
};

/** 解析注册请求体（client 端：用户名 + 手机号 + 密码 + 图形验证码） */
const parseRegisterPayload = (body: Record<string, unknown>): authService.RegisterPayload => {
  const username = parseRequiredString(body.username, "username");
  if (!USERNAME_PATTERN.test(username)) {
    throw new BadRequestError("用户名需为 2-32 位，仅支持中英文、数字、下划线与连字符");
  }

  verifyCaptcha(body);

  return {
    username,
    phone: parsePhone(body.phone),
    password: parsePassword(body.password),
  };
};

/**
 * GET /api/auth/captcha
 * 签发图形验证码（公开）
 */
export const getCaptcha = (_req: Request, res: Response, next: NextFunction): void => {
  try {
    const captcha = captchaService.createCaptcha();
    sendSuccessResponse(res, HttpStatusCode.OK, captcha, "验证码生成成功");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/register
 * 用户注册（公开，需图形验证码）
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = parseRegisterPayload(req.body as Record<string, unknown>);
    const result = await authService.register(payload);
    sendSuccessResponse(res, HttpStatusCode.CREATED, result, "用户注册成功");
  } catch (error) {
    next(error);
  }
};

/** 解析登录标识：phone 优先，其次 username；密码不 trim */
const parseLoginParams = (body: Record<string, unknown>): authService.LoginParams => {
  const password = parsePassword(body.password);
  if (body.phone !== undefined) {
    return { phone: parsePhone(body.phone), password };
  }
  if (body.username === undefined) {
    throw new BadRequestError("请提供手机号或用户名");
  }
  return { username: parseRequiredString(body.username, "username"), password };
};

/**
 * POST /api/auth/login
 * client 用户登录（公开）
 *
 * 支持两种标识：
 * - `phone`：**必须**携带图形验证码；
 * - `username`：client 用用户名登录时也会带图形验证码，传了就校验。
 *
 * ⚠️ admin 后台请使用 `POST /api/auth/admin/login`，不要复用本接口。
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;

    if (body.phone !== undefined) {
      verifyCaptcha(body);
    } else if (body.captchaId !== undefined || body.captchaCode !== undefined) {
      verifyCaptcha(body);
    }

    const result = await authService.login(parseLoginParams(body));
    sendSuccessResponse(res, HttpStatusCode.OK, result, "登录成功");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/admin/login
 * 后台管理端登录（公开，不需要图形验证码）
 *
 * 手机号或用户名 + 密码均可；登录成功后校验 `admin:access` 权限。
 */
export const adminLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.adminLogin(parseLoginParams(req.body as Record<string, unknown>));
    sendSuccessResponse(res, HttpStatusCode.OK, result, "登录成功");
  } catch (error) {
    next(error);
  }
};

/** 判断请求是否来自本机（开发自动登录只允许回环地址） */
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const isLoopback = (ip: string | undefined): boolean => ip !== undefined && LOOPBACK_ADDRESSES.has(ip);

/**
 * POST /api/auth/dev/login
 * 本地开发自动登录（仅 DEVELOPMENT + DEV_LOGIN_ENABLED=true 时挂载）
 *
 * 跳过图形验证码，供两个前端的 `.env` 开关使用。
 * 请求体可以省略账号密码，此时读取 server/.env 的 DEV_LOGIN_*；
 * 这样密码不会进入 Vite 的前端产物。账号密码仍会被完整校验。
 */
export const devLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!isLoopback(req.ip) && !isLoopback(req.socket.remoteAddress)) {
      throw new ForbiddenError("开发自动登录仅允许本机访问");
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const hasRequestCredentials = typeof body.password === "string" && body.password.length > 0;

    let params: authService.LoginParams;
    if (hasRequestCredentials) {
      params = parseLoginParams(body);
    } else {
      if ((!DEV_LOGIN_PHONE && !DEV_LOGIN_USERNAME) || !DEV_LOGIN_PASSWORD) {
        throw new BadRequestError("未配置开发自动登录账号，请检查 server/.env 的 DEV_LOGIN_*");
      }
      params = DEV_LOGIN_PHONE
        ? { phone: DEV_LOGIN_PHONE, password: DEV_LOGIN_PASSWORD }
        : { username: DEV_LOGIN_USERNAME, password: DEV_LOGIN_PASSWORD };
    }

    const result = await authService.login(params);
    sendSuccessResponse(res, HttpStatusCode.OK, result, "开发自动登录成功");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/password/forgot
 * 忘记密码：手机号 + 图形验证码 + 新密码（公开）
 *
 * ⚠️ 需求确认的方案只靠图形验证码校验身份；生产环境应追加短信验证码。
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const phone = parsePhone(body.phone);
    const password = parsePassword(body.password);
    verifyCaptcha(body);

    await authService.resetPasswordByPhone(phone, password);
    sendSuccessResponse(res, HttpStatusCode.OK, undefined, "密码重置成功，请使用新密码登录");
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/password
 * 已登录用户修改密码（需登录，校验旧密码）
 */
export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.body as { user?: { id?: number } }).user?.id;
    if (typeof userId !== "number") {
      throw new BadRequestError("未获取到用户信息，请先登录");
    }

    const body = req.body as Record<string, unknown>;
    const oldPassword = parsePassword(body.oldPassword, "oldPassword");
    const newPassword = parsePassword(body.newPassword, "newPassword");

    if (oldPassword === newPassword) {
      throw new BadRequestError("新密码不能与旧密码相同");
    }

    await authService.changePassword(userId, oldPassword, newPassword);
    sendSuccessResponse(res, HttpStatusCode.OK, undefined, "密码修改成功");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 * 用 refreshToken 换取新的 accessToken（公开）
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken: token } = req.body as Record<string, unknown>;
    if (!token || typeof token !== "string") {
      throw new BadRequestError("缺少 refreshToken");
    }

    const accessToken = await authService.refreshAccessToken(token);
    sendSuccessResponse(res, HttpStatusCode.OK, { token: accessToken }, "令牌刷新成功");
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/getUserInfo
 * 获取当前登录用户信息（需登录）
 */
export const getUserInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.body as { user?: { id?: number } }).user?.id;
    if (typeof userId !== "number") {
      throw new BadRequestError("未获取到用户信息，请先登录");
    }

    const user = await authService.getCurrentUser(userId);
    sendSuccessResponse(res, HttpStatusCode.OK, user, "获取用户信息成功");
  } catch (error) {
    next(error);
  }
};
