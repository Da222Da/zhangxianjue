// src/controllers/roleController.ts
import type { NextFunction, Request, Response } from "express";
import { sendApiSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { BadRequestError } from "../utils/errors.ts";
import * as roleService from "../services/roleService.ts";
import type { CreateRolePayload, UpdateRolePayload } from "../services/roleService.ts";

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

/** 校验必填字符串 */
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

/** 校验可选描述 */
const parseOptionalDescription = (raw: unknown): string | null | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new BadRequestError("description 必须为字符串");
  }
  return raw.trim();
};

/**
 * 解析权限 id 数组
 *
 * undefined → undefined（创建时不分配 / 更新时不改）
 * 空数组 → 清空权限
 */
const parsePermissionIds = (raw: unknown): number[] | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    throw new BadRequestError("permission_ids 必须为数组");
  }
  return raw.map((item) => parsePositiveInt(item, "permission_ids"));
};

/** 解析创建角色请求体 */
const parseCreatePayload = (body: Record<string, unknown>): CreateRolePayload => ({
  name: parseRequiredString(body.name, "name", roleService.MAX_ROLE_NAME_LENGTH),
  description: parseOptionalDescription(body.description),
  permission_ids: parsePermissionIds(body.permission_ids),
});

/** 解析更新角色请求体 */
const parseUpdatePayload = (body: Record<string, unknown>): UpdateRolePayload => ({
  name: parseRequiredString(body.name, "name", roleService.MAX_ROLE_NAME_LENGTH),
  description: parseOptionalDescription(body.description),
});

/**
 * GET /api/admin/role
 * 查询全部角色（需 role:manage 权限）
 */
export const listRoles = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roles = await roleService.listRoles();
    sendApiSuccessResponse(res, HttpStatusCode.OK, roles, "Roles fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/role
 * 创建角色（需 role:manage 权限）
 */
export const createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = parseCreatePayload(req.body as Record<string, unknown>);
    const role = await roleService.createRole(payload);
    sendApiSuccessResponse(res, HttpStatusCode.CREATED, role, "Role created successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/role/:id
 * 更新角色名与描述（需 role:manage 权限）
 */
export const updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const payload = parseUpdatePayload(req.body as Record<string, unknown>);
    const role = await roleService.updateRole(id, payload);
    sendApiSuccessResponse(res, HttpStatusCode.OK, role, "Role updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/role/:id
 * 删除角色（需 role:manage 权限）
 */
export const deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    await roleService.deleteRole(id);
    sendApiSuccessResponse(res, HttpStatusCode.OK, undefined, "Role deleted successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/role/:id/permissions
 * 重设角色权限（需 permission:manage 权限）
 */
export const setRolePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const permissionIds = parsePermissionIds((req.body as Record<string, unknown>).permission_ids);
    if (permissionIds === undefined) {
      throw new BadRequestError("缺少 permission_ids");
    }

    const role = await roleService.setRolePermissions(id, permissionIds);
    sendApiSuccessResponse(res, HttpStatusCode.OK, role, "Role permissions updated successfully");
  } catch (error) {
    next(error);
  }
};
