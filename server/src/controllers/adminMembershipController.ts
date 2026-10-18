// src/controllers/adminMembershipController.ts
import type { NextFunction, Request, Response } from "express";
import { sendApiSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { BadRequestError } from "../utils/errors.ts";
import * as membershipService from "../services/membershipService.ts";
import type { MembershipApplicationStatus, MembershipListQuery } from "../services/membershipService.ts";

const VALID_STATUSES: MembershipApplicationStatus[] = ["pending", "approved", "rejected"];

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

/** 解析列表查询参数 */
const parseListQuery = (query: Request["query"]): MembershipListQuery => {
  const rawStatus = typeof query.status === "string" && query.status !== "" ? query.status : undefined;
  if (rawStatus !== undefined && !VALID_STATUSES.includes(rawStatus as MembershipApplicationStatus)) {
    throw new BadRequestError("status 只能为 pending / approved / rejected");
  }

  const page = query.page === undefined || query.page === "" ? membershipService.DEFAULT_PAGE : parsePositiveInt(query.page, "page");
  const pageSizeRaw =
    query.pageSize === undefined || query.pageSize === ""
      ? membershipService.DEFAULT_PAGE_SIZE
      : parsePositiveInt(query.pageSize, "pageSize");

  return {
    status: rawStatus as MembershipApplicationStatus | undefined,
    page,
    pageSize: Math.min(pageSizeRaw, membershipService.MAX_PAGE_SIZE),
  };
};

/**
 * GET /api/admin/membership
 * 分页查询会员申请（需 user:manage）
 */
export const listApplications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = parseListQuery(req.query);
    const result = await membershipService.listApplications(query);
    sendApiSuccessResponse(res, HttpStatusCode.OK, result.rows, "Applications fetched successfully", {
      total: result.total,
      currentPage: result.currentPage,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/membership/:id
 * 审核会员申请（需 user:manage）
 *
 * 请求体 `{ approve: true | false }`；通过后自动把用户角色改为会员。
 */
export const reviewApplication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const { approve } = req.body as { approve?: unknown };
    if (typeof approve !== "boolean") {
      throw new BadRequestError("approve 必须为布尔值");
    }

    const reviewerId = (req.body as { user?: { id?: number } }).user?.id;
    if (typeof reviewerId !== "number") {
      throw new BadRequestError("未获取到审核人信息，请先登录");
    }

    const application = await membershipService.reviewApplication(id, approve, reviewerId);
    sendApiSuccessResponse(
      res,
      HttpStatusCode.OK,
      application,
      approve ? "Application approved" : "Application rejected",
    );
  } catch (error) {
    next(error);
  }
};
