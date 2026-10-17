// src/controllers/categoryController.ts
import type { NextFunction, Request, Response } from "express";
import { sendApiSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { BadRequestError } from "../utils/errors.ts";
import * as categoryService from "../services/categoryService.ts";
import type { CategoryPayload } from "../services/categoryService.ts";

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

/** 校验名称：trim 后非空，且不超过 VARCHAR(255) */
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

/** 校验可选的排序号：非负整数 */
const parseOptionalSort = (raw: unknown): number | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== "number" && typeof raw !== "string") {
    throw new BadRequestError("sort 必须为非负整数");
  }
  if (typeof raw === "string" && raw.trim() === "") {
    throw new BadRequestError("sort 必须为非负整数");
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new BadRequestError("sort 必须为非负整数");
  }
  return value;
};

/**
 * 解析父分类 id
 *
 * 未传 → undefined（创建为根分类 / 更新时保持原值）
 * null 或 0 → null（明确移到根级；前端清空树形选择时传的就是 null）
 * 其余 → 正整数
 */
const parseOptionalParentId = (raw: unknown): number | null | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null || raw === 0 || raw === "") {
    return null;
  }
  return parsePositiveInt(raw, "parent_id");
};

/** 解析请求体，逐个字段取值避免 authMiddleware 注入的 user 流入 service */
const parseCategoryPayload = (body: unknown): CategoryPayload => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestError("请求体必须为 JSON 对象");
  }
  const { name, parent_id, sort } = body as Record<string, unknown>;

  return {
    name: parseRequiredString(name, "name", categoryService.MAX_NAME_LENGTH),
    parent_id: parseOptionalParentId(parent_id),
    sort: parseOptionalSort(sort),
  };
};

/**
 * GET /api/admin/category
 * 查询完整分类树（公开）
 */
export const getCategoryTree = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tree = await categoryService.listCategoryTree();
    sendApiSuccessResponse(res, HttpStatusCode.OK, tree, "Categories fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/category
 * 创建分类（需登录，仅管理员）
 */
export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = parseCategoryPayload(req.body);
    const category = await categoryService.createCategory(payload);
    sendApiSuccessResponse(res, HttpStatusCode.CREATED, category, "Category created successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/category/:id
 * 更新分类（需登录，仅管理员）。parent_id 传 null 表示移到根级
 */
export const updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const payload = parseCategoryPayload(req.body);
    const category = await categoryService.updateCategory(id, payload);
    sendApiSuccessResponse(res, HttpStatusCode.OK, category, "Category updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/category/:id
 * 删除分类（需登录，仅管理员）。存在子分类或仍被引用时拒绝
 */
export const deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    await categoryService.deleteCategory(id);
    sendApiSuccessResponse(res, HttpStatusCode.OK, undefined, "Category deleted successfully");
  } catch (error) {
    next(error);
  }
};
