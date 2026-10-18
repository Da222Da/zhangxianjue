// src/controllers/userController.ts
import type { NextFunction, Request, Response } from "express";
import { sendApiSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { BadRequestError } from "../utils/errors.ts";
import * as userService from "../services/userService.ts";
import type { CreateUserPayload, UpdateUserPayload, UserListQuery } from "../services/userService.ts";

/** 中国大陆手机号 */
const PHONE_PATTERN = /^1[3-9]\d{9}$/;
/** 用户名：与注册接口保持一致，2-32 位中英文 / 数字 / 下划线 / 连字符 */
const USERNAME_PATTERN = /^[\w一-龥-]{2,32}$/u;
/** avatar 列类型为 STRING，即 VARCHAR(255) */
const MAX_AVATAR_LENGTH = 255;

/** 校验并返回用户名 */
const parseUsername = (raw: unknown): string => {
  const username = parseRequiredString(raw, "username", userService.MAX_USERNAME_LENGTH);
  if (!USERNAME_PATTERN.test(username)) {
    throw new BadRequestError("用户名需为 2-32 位，仅支持中英文、数字、下划线与连字符");
  }
  return username;
};

/**
 * 校验密码
 *
 * ⚠️ 刻意不 trim：首尾空格也是密码的一部分，trim 会悄悄改掉用户设置的密码。
 */
const parsePassword = (raw: unknown): string => {
  if (typeof raw !== "string") {
    throw new BadRequestError("password 必须为字符串");
  }
  if (!raw) {
    throw new BadRequestError("password 不能为空");
  }
  if (raw.length > userService.MAX_PASSWORD_LENGTH) {
    throw new BadRequestError(`密码长度不能超过 ${userService.MAX_PASSWORD_LENGTH} 个字符`);
  }
  userService.assertPasswordLength(raw);
  return raw;
};

/** 校验并转换正整数 */
const parsePositiveInt = (raw: unknown, field: string): number => {
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw new BadRequestError(`${field} 必须为正整数`);
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new BadRequestError(`${field} 必须为正整数`);
  }
  return value;
};

/** 校验必填字符串：trim 后非空，且不超过列宽 */
const parseRequiredString = (raw: unknown, field: string, maxLength: number): string => {
  if (typeof raw !== "string") {
    throw new BadRequestError(`${field} 必须为字符串`);
  }
  const value = raw.trim();
  if (!value) {
    throw new BadRequestError(`${field} 不能为空`);
  }
  if (value.length > maxLength) {
    throw new BadRequestError(`${field} 长度不能超过 ${maxLength} 个字符`);
  }
  return value;
};

/** 校验可选的字符串：undefined 表示不改；null / 空串归一化为空串 */
const parseOptionalString = (raw: unknown, field: string, maxLength: number): string | null | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new BadRequestError(`${field} 必须为字符串`);
  }
  const value = raw.trim();
  if (value.length > maxLength) {
    throw new BadRequestError(`${field} 长度不能超过 ${maxLength} 个字符`);
  }
  return value;
};

/**
 * 校验可选的手机号
 *
 * undefined → 保持原值（更新）/ 不设置（创建）
 * null / 空串 → 清空
 */
const parseOptionalPhone = (raw: unknown): string | null | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new BadRequestError("phone 必须为字符串");
  }
  const value = raw.trim();
  if (value === "") {
    return null;
  }
  if (!PHONE_PATTERN.test(value)) {
    throw new BadRequestError("手机号格式不正确");
  }
  return value;
};

/**
 * 校验可选的日期时间
 *
 * undefined → 保持原值（更新）/ 使用默认值（创建）
 * null / 空串 → null
 * 字符串 / 时间戳 → Date
 */
const parseOptionalDate = (raw: unknown, field: string): Date | null | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null || raw === "") {
    return null;
  }
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw new BadRequestError(`${field} 必须为合法日期`);
  }
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    throw new BadRequestError(`${field} 必须为合法日期`);
  }
  return value;
};

/** 校验状态：0 禁用 / 1 启用 */
const parseOptionalStatus = (raw: unknown): number | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (value !== userService.UserStatus.DISABLED && value !== userService.UserStatus.ENABLED) {
    throw new BadRequestError("status 只能为 0（禁用）或 1（启用）");
  }
  return value;
};

/** 校验并转换可选的页码 / 每页条数 */
const parsePage = (raw: unknown): number => {
  if (raw === undefined || raw === "") {
    return userService.DEFAULT_PAGE;
  }
  return parsePositiveInt(raw, "page");
};

const parsePageSize = (raw: unknown): number => {
  if (raw === undefined || raw === "") {
    return userService.DEFAULT_PAGE_SIZE;
  }
  const value = parsePositiveInt(raw, "pageSize");
  return Math.min(value, userService.MAX_PAGE_SIZE);
};

/** 解析列表查询参数 */
const parseListQuery = (query: Request["query"]): UserListQuery => {
  const keyword = typeof query.keyword === "string" ? query.keyword.trim() : "";
  const roleId = query.role_id === undefined || query.role_id === "" ? undefined : parsePositiveInt(query.role_id, "role_id");
  const status =
    query.status === undefined || query.status === "" ? undefined : parseOptionalStatus(typeof query.status === "string" ? query.status : undefined);

  return {
    keyword: keyword || undefined,
    roleId,
    status,
    page: parsePage(query.page),
    pageSize: parsePageSize(query.pageSize),
  };
};

/** 解析创建用户请求体 */
const parseCreatePayload = (body: Record<string, unknown>): CreateUserPayload => {
  return {
    username: parseUsername(body.username),
    phone: parseOptionalPhone(body.phone) ?? null,
    password: parsePassword(body.password),
    avatar: parseOptionalString(body.avatar, "avatar", MAX_AVATAR_LENGTH) ?? "",
    role_id: parsePositiveInt(body.role_id, "role_id"),
    membership_expires_at: parseOptionalDate(body.membership_expires_at, "membership_expires_at"),
    status: parseOptionalStatus(body.status) ?? userService.UserStatus.ENABLED,
  };
};

/** 解析更新用户请求体 */
const parseUpdatePayload = (body: Record<string, unknown>): UpdateUserPayload => {
  const payload: UpdateUserPayload = {
    username: body.username === undefined ? undefined : parseUsername(body.username),
    phone: parseOptionalPhone(body.phone),
    avatar: parseOptionalString(body.avatar, "avatar", MAX_AVATAR_LENGTH),
    role_id: body.role_id === undefined ? undefined : parsePositiveInt(body.role_id, "role_id"),
    membership_expires_at: parseOptionalDate(body.membership_expires_at, "membership_expires_at"),
    status: parseOptionalStatus(body.status),
  };

  if (
    payload.username === undefined &&
    payload.phone === undefined &&
    payload.avatar === undefined &&
    payload.role_id === undefined &&
    payload.membership_expires_at === undefined &&
    payload.status === undefined
  ) {
    throw new BadRequestError("至少需要提交一个可更新字段");
  }

  return payload;
};

/** 读取当前操作者 id（authMiddleware 注入） */
const getOperatorId = (req: Request): number => {
  const userId = (req.body as { user?: { id?: number } }).user?.id;
  if (typeof userId !== "number") {
    throw new BadRequestError("未获取到当前登录用户");
  }
  return userId;
};

/**
 * GET /api/admin/user
 * 分页查询用户列表（需 user:manage 权限）
 */
export const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = parseListQuery(req.query);
    const result = await userService.listUsers(query);
    sendApiSuccessResponse(res, HttpStatusCode.OK, result.rows, "Users fetched successfully", {
      total: result.total,
      currentPage: result.currentPage,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/user/:id
 * 查询用户详情（需 user:manage 权限）
 */
export const getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const user = await userService.getUserProfile(id);
    sendApiSuccessResponse(res, HttpStatusCode.OK, user, "User fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/user
 * 创建用户（需 user:manage 权限）
 */
export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = parseCreatePayload(req.body as Record<string, unknown>);
    const user = await userService.createUser(payload);
    sendApiSuccessResponse(res, HttpStatusCode.CREATED, user, "User created successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/user/:id
 * 更新用户元数据（需 user:manage 权限）
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const payload = parseUpdatePayload(req.body as Record<string, unknown>);
    const user = await userService.updateUser(id, payload, getOperatorId(req));
    sendApiSuccessResponse(res, HttpStatusCode.OK, user, "User updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/user/:id/password
 * 重置用户密码（需 user:manage 权限）
 */
export const resetUserPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const password = parsePassword((req.body as Record<string, unknown>).password);

    await userService.resetPassword(id, password);
    sendApiSuccessResponse(res, HttpStatusCode.OK, undefined, "Password reset successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/user/:id
 * 删除用户（需 user:manage 权限）
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    await userService.deleteUser(id, getOperatorId(req));
    sendApiSuccessResponse(res, HttpStatusCode.OK, undefined, "User deleted successfully");
  } catch (error) {
    next(error);
  }
};
