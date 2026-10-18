// src/controllers/permissionController.ts
import type { NextFunction, Request, Response } from "express";
import { sendApiSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import * as permissionService from "../services/permissionService.ts";

/**
 * GET /api/admin/permission
 * 查询全部权限点（需 role:manage 或 permission:manage 权限）
 */
export const listPermissions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const permissions = await permissionService.listPermissions();
    sendApiSuccessResponse(res, HttpStatusCode.OK, permissions, "Permissions fetched successfully");
  } catch (error) {
    next(error);
  }
};
