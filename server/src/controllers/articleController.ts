// src/controllers/articleController.ts
import type { NextFunction, Request, Response } from "express";
import { sendApiSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { BadRequestError } from "../utils/errors.ts";
import * as articleService from "../services/articleService.ts";
import type { ArticleListQuery, ArticleMetaPayload } from "../services/articleService.ts";
import { resolveViewerAccess } from "../services/accessService.ts";

/** 校验并转换正整数（用于路径参数与分页参数） */
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

/**
 * 校验按字符数限制的必填字符串（对应 VARCHAR 列）
 * 采用 trim 后非空判定，避免仅由空白字符构成的标题落库
 */
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

/**
 * 校验按 UTF-8 字节数限制的必填文本（对应 TEXT 列）
 * 不做 trim，原样保留正文内容
 */
const parseRequiredText = (raw: unknown, field: string): string => {
  if (typeof raw !== "string") {
    throw new BadRequestError(`${field} 必须为字符串`);
  }
  if (Buffer.byteLength(raw, "utf8") > articleService.MAX_TEXT_BYTES) {
    throw new BadRequestError(`${field} 超过 ${articleService.MAX_TEXT_BYTES} 字节上限`);
  }
  return raw;
};

/** 校验可选的文本字段：未传入 → undefined（表示不设置 / 保持不变） */
const parseOptionalText = (raw: unknown, field: string): string | null | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  return parseRequiredText(raw, field);
};

/**
 * 校验可选的外键 id（分类 / 关联笔记共用）
 * 未传入 → undefined（不设置 / 保持原值）；null、0 或空串 → null（解除关联）
 */
const parseOptionalRefId = (raw: unknown, field: string): number | null | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null || raw === 0 || raw === "") {
    return null;
  }
  return parsePositiveInt(raw, field);
};

/**
 * 校验可选的排序号：非负整数
 * 未传入 → undefined（创建时取默认值 0，更新时保持原值）
 */
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

/** 校验可选的布尔值：undefined 表示保持原值 */
const parseOptionalBoolean = (raw: unknown, field: string): boolean | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== "boolean") {
    throw new BadRequestError(`${field} 必须为布尔值`);
  }
  return raw;
};

/**
 * 解析可选的字符串查询参数
 * 形如 `?keyword=a&keyword=b` 会得到数组，此类非法输入一律拒绝
 */
const parseOptionalQueryString = (raw: unknown, field: string): string => {
  if (raw === undefined) {
    return "";
  }
  if (typeof raw !== "string") {
    throw new BadRequestError(`${field} 必须为字符串`);
  }
  return raw.trim();
};

/** 解析列表查询参数，补齐默认值并收敛取值范围 */
const parseListQuery = (query: Request["query"]): ArticleListQuery => {
  const keyword = parseOptionalQueryString(query.keyword, "keyword");
  // category_id 为空串视为不筛选（前端清空树形选择时可能传空）
  const categoryId = query.category_id === undefined || query.category_id === "" ? undefined : parsePositiveInt(query.category_id, "category_id");

  const page = query.page === undefined ? articleService.DEFAULT_PAGE : parsePositiveInt(query.page, "page");
  const pageSize = query.pageSize === undefined ? articleService.DEFAULT_PAGE_SIZE : parsePositiveInt(query.pageSize, "pageSize");
  if (pageSize > articleService.MAX_PAGE_SIZE) {
    throw new BadRequestError(`pageSize 不能超过 ${articleService.MAX_PAGE_SIZE}`);
  }

  return {
    keyword: keyword || undefined,
    categoryId,
    page,
    pageSize,
  };
};

/**
 * 解析元数据请求体（不含 content）
 * 逐个字段取值而非整体透传：authMiddleware 会向 req.body 注入 user 字段，
 * 显式取值可确保该字段不会流入 service 层。
 */
const parseArticleMetaPayload = (body: unknown): ArticleMetaPayload => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestError("请求体必须为 JSON 对象");
  }
  const { title, cover, description, category_id, note_id, guest_visible, sort } = body as Record<string, unknown>;

  return {
    title: parseRequiredString(title, "title", articleService.MAX_TITLE_LENGTH),
    cover: parseOptionalText(cover, "cover"),
    description: parseOptionalText(description, "description"),
    category_id: parseOptionalRefId(category_id, "category_id"),
    note_id: parseOptionalRefId(note_id, "note_id"),
    guest_visible: parseOptionalBoolean(guest_visible, "guest_visible"),
    sort: parseOptionalSort(sort),
  };
};

/**
 * 解析正文请求体
 *
 * ⚠️ 只取 content 一个字段：正文接口与元数据接口是两个独立入口，
 * 多余的字段一律忽略，避免调用方误传元数据却被静默丢弃而不自知。
 */
const parseArticleContentPayload = (body: unknown): string => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestError("请求体必须为 JSON 对象");
  }
  const { content } = body as Record<string, unknown>;

  return parseRequiredText(content, "content");
};

/**
 * GET /api/admin/article
 * 分页查询文章列表，支持按关键词模糊搜索 title 与 content
 */
export const getArticles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = parseListQuery(req.query);
    const access = await resolveViewerAccess(req.body?.user?.id);
    const { rows, total, currentPage, pageSize } = await articleService.listArticles(query, access.isAuthenticated);

    sendApiSuccessResponse(res, HttpStatusCode.OK, rows, "Articles fetched successfully", { total, currentPage, pageSize });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/article/:id
 * 查询文章详情
 */
export const getArticleDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const access = await resolveViewerAccess(req.body?.user?.id);
    const article = await articleService.getArticleById(id, access.isAuthenticated);

    sendApiSuccessResponse(res, HttpStatusCode.OK, article, "Article fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/article
 * 创建文章（需登录）。只创建元数据，content 落库为空串
 */
export const createArticle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = parseArticleMetaPayload(req.body);
    const article = await articleService.createArticle(payload);

    sendApiSuccessResponse(res, HttpStatusCode.CREATED, article, "Article created successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/article/:id
 * 更新文章元数据（需登录），不触碰 content。
 * cover / description / category_id / note_id / sort 未传入时保持原值不变
 */
export const updateArticleMeta = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const payload = parseArticleMetaPayload(req.body);
    const article = await articleService.updateArticleMeta(id, payload);

    sendApiSuccessResponse(res, HttpStatusCode.OK, article, "Article updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/article/:id/content
 * 只更新文章正文（需登录）。传空串表示清空正文
 */
export const updateArticleContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const content = parseArticleContentPayload(req.body);
    const article = await articleService.updateArticleContent(id, content);

    sendApiSuccessResponse(res, HttpStatusCode.OK, article, "Article content updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/article/:id
 * 删除文章（需登录）
 */
export const deleteArticle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    await articleService.deleteArticle(id);

    // 删除成功不返回 data 字段，与原接口契约保持一致
    sendApiSuccessResponse(res, HttpStatusCode.OK, undefined, "Article deleted successfully");
  } catch (error) {
    next(error);
  }
};
