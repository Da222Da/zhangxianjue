// src/controllers/membershipController.ts
import type { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { BadRequestError } from "../utils/errors.ts";
import * as membershipService from "../services/membershipService.ts";

/** 从 authMiddleware 注入的载荷里取当前用户 id */
const getUserId = (req: Request): number => {
  const userId = (req.body as { user?: { id?: number } }).user?.id;
  if (typeof userId !== "number") {
    throw new BadRequestError("未获取到用户信息，请先登录");
  }
  return userId;
};

/**
 * POST /api/membership/apply
 * 提交会员升级申请（需登录）
 */
export const applyMembership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const application = await membershipService.applyMembership(getUserId(req));
    sendSuccessResponse(res, HttpStatusCode.CREATED, application, "会员申请已提交");
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/membership/status
 * 查询当前用户的会员申请状态（需登录）
 */
export const getMembershipStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = await membershipService.getMembershipStatus(getUserId(req));
    sendSuccessResponse(res, HttpStatusCode.OK, status, "获取申请状态成功");
  } catch (error) {
    next(error);
  }
};
