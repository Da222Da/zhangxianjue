// src/controllers/bookTaxonomyController.ts
import type { NextFunction, Request, Response } from "express";
import { sendApiSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { BadRequestError } from "../utils/errors.ts";
import * as bookCategoryService from "../services/bookCategoryService.ts";
import * as tagService from "../services/tagService.ts";
import type { BookCategoryPayload } from "../services/bookCategoryService.ts";
import type { TagPayload } from "../services/tagService.ts";

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

/** 校验必填名称（trim 后非空、不超过上限） */
const parseRequiredName = (raw: unknown, field: string, maxLength: number): string => {
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
  if (typeof raw !== "string" && typeof raw !== "number") {
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

/** 解析分类请求体 */
const parseCategoryPayload = (body: Record<string, unknown>): BookCategoryPayload => ({
  name: parseRequiredName(body.name, "name", bookCategoryService.MAX_CATEGORY_NAME_LENGTH),
  sort: parseOptionalSort(body.sort),
});

/** 解析标签请求体 */
const parseTagPayload = (body: Record<string, unknown>): TagPayload => ({
  name: parseRequiredName(body.name, "name", tagService.MAX_TAG_NAME_LENGTH),
  sort: parseOptionalSort(body.sort),
});

// ===== 分类 =====

/** GET /api/admin/book/category（需 book:manage） */
export const listBookCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await bookCategoryService.listBookCategories();
    sendApiSuccessResponse(res, HttpStatusCode.OK, categories, "Book categories fetched successfully");
  } catch (error) {
    next(error);
  }
};

/** POST /api/admin/book/category（需 book:manage） */
export const createBookCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = parseCategoryPayload(req.body as Record<string, unknown>);
    const category = await bookCategoryService.createBookCategory(payload);
    sendApiSuccessResponse(res, HttpStatusCode.CREATED, category, "Book category created successfully");
  } catch (error) {
    next(error);
  }
};

/** PUT /api/admin/book/category/:id（需 book:manage） */
export const updateBookCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const payload = parseCategoryPayload(req.body as Record<string, unknown>);
    const category = await bookCategoryService.updateBookCategory(id, payload);
    sendApiSuccessResponse(res, HttpStatusCode.OK, category, "Book category updated successfully");
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/admin/book/category/:id（需 book:manage） */
export const deleteBookCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    await bookCategoryService.deleteBookCategory(id);
    sendApiSuccessResponse(res, HttpStatusCode.OK, undefined, "Book category deleted successfully");
  } catch (error) {
    next(error);
  }
};

// ===== 标签 =====

/** GET /api/admin/book/tag（需 book:manage） */
export const listTags = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tags = await tagService.listTags();
    sendApiSuccessResponse(res, HttpStatusCode.OK, tags, "Tags fetched successfully");
  } catch (error) {
    next(error);
  }
};

/** POST /api/admin/book/tag（需 book:manage） */
export const createTag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = parseTagPayload(req.body as Record<string, unknown>);
    const tag = await tagService.createTag(payload);
    sendApiSuccessResponse(res, HttpStatusCode.CREATED, tag, "Tag created successfully");
  } catch (error) {
    next(error);
  }
};

/** PUT /api/admin/book/tag/:id（需 book:manage） */
export const updateTag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const payload = parseTagPayload(req.body as Record<string, unknown>);
    const tag = await tagService.updateTag(id, payload);
    sendApiSuccessResponse(res, HttpStatusCode.OK, tag, "Tag updated successfully");
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/admin/book/tag/:id（需 book:manage） */
export const deleteTag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    await tagService.deleteTag(id);
    sendApiSuccessResponse(res, HttpStatusCode.OK, undefined, "Tag deleted successfully");
  } catch (error) {
    next(error);
  }
};
