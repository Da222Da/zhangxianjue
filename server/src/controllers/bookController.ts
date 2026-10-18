// src/controllers/bookController.ts
import type { NextFunction, Request, Response } from "express";
import { sendApiSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { BadRequestError } from "../utils/errors.ts";
import * as bookService from "../services/bookService.ts";
import type { BookPayload, ChapterPayload, VolumePayload } from "../services/bookService.ts";
import { resolveViewerAccess } from "../services/accessService.ts";

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

/** 校验 TEXT 列的字节上限（中文按 UTF-8 占 3 字节） */
const assertTextBytes = (value: string | null | undefined, field: string): void => {
  if (value === undefined || value === null) {
    return;
  }
  if (Buffer.byteLength(value, "utf8") > bookService.MAX_TEXT_BYTES) {
    throw new BadRequestError(`${field} 内容过长（上限 ${bookService.MAX_TEXT_BYTES} 字节）`);
  }
};

/** 校验可选的文本：undefined 保持原值，null 表示清空 */
const parseOptionalText = (raw: unknown, field: string, maxLength?: number): string | null | undefined => {
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
  if (maxLength !== undefined && value.length > maxLength) {
    throw new BadRequestError(`${field} 长度不能超过 ${maxLength} 个字符`);
  }
  assertTextBytes(value, field);
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
 * 校验可选的分类 id
 * 未传入 → undefined（不设置 / 保持原值）；null、0 或空串 → null（移到未分类）
 */
const parseOptionalCategoryId = (raw: unknown): number | null | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null || raw === 0 || raw === "") {
    return null;
  }
  return parsePositiveInt(raw, "category_id");
};

/**
 * 校验可选的标签 id 数组
 * 未传入 → undefined（不设置 / 保持原值）；空数组表示清空标签
 */
const parseOptionalTagIds = (raw: unknown): number[] | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    throw new BadRequestError("tag_ids 必须为数组");
  }
  return raw.map((item) => parsePositiveInt(item, "tag_ids"));
};

/** 解析书籍请求体 */
const parseBookPayload = (body: Record<string, unknown>): BookPayload => ({
  title: parseRequiredString(body.title, "title", bookService.MAX_TITLE_LENGTH),
  cover: parseOptionalText(body.cover, "cover"),
  description: parseOptionalText(body.description, "description"),
  category_id: parseOptionalCategoryId(body.category_id),
  tag_ids: parseOptionalTagIds(body.tag_ids),
  is_free: parseOptionalBoolean(body.is_free, "is_free"),
  guest_visible: parseOptionalBoolean(body.guest_visible, "guest_visible"),
  sort: parseOptionalSort(body.sort),
});

/** 解析分卷请求体 */
const parseVolumePayload = (body: Record<string, unknown>): VolumePayload => ({
  title: parseRequiredString(body.title, "title", bookService.MAX_TITLE_LENGTH),
  sort: parseOptionalSort(body.sort),
});

/** 解析章节请求体 */
const parseChapterPayload = (body: Record<string, unknown>): ChapterPayload => ({
  // 创建时必填；更新时传入表示移动到另一个分卷
  volume_id: body.volume_id === undefined ? undefined : parsePositiveInt(body.volume_id, "volume_id"),
  title: parseRequiredString(body.title, "title", bookService.MAX_TITLE_LENGTH),
  summary: parseOptionalText(body.summary, "summary"),
  // content 允许空串（章节可以先建后补正文），因此不走 trim 后的必填校验
  content: body.content === undefined ? undefined : parseChapterContent(body.content),
  sort: parseOptionalSort(body.sort),
});

/** 章节正文：允许空串，但仍受 TEXT 字节上限约束 */
const parseChapterContent = (raw: unknown): string => {
  if (typeof raw !== "string") {
    throw new BadRequestError("content 必须为字符串");
  }
  assertTextBytes(raw, "content");
  return raw;
};

/**
 * GET /api/library/book
 * 查询书库书籍列表（公开）
 *
 * 列表对所有访客返回全部书籍，VIP 专属书籍由前端按 is_free 打角标；
 * 真正的正文拦截发生在详情与章节接口。
 */
export const listLibraryBooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const access = await resolveViewerAccess(req.body?.user?.id);
    const books = await bookService.listBooks(undefined, access.isAuthenticated);
    sendApiSuccessResponse(res, HttpStatusCode.OK, books, "Books fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/library/book/:id
 * 查询书籍详情与章节列表（公开；VIP 专属需 library:view）
 */
export const getLibraryBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const access = await resolveViewerAccess(req.body?.user?.id);
    const book = await bookService.getReadableBookDetail(id, access.canViewVip, access.isAuthenticated);
    sendApiSuccessResponse(res, HttpStatusCode.OK, book, "Book fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/library/book/:bookId/chapter/:chapterId
 * 查询章节正文（公开；VIP 专属需 library:view）
 */
export const getLibraryChapter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookId = parsePositiveInt(req.params.bookId, "bookId");
    const chapterId = parsePositiveInt(req.params.chapterId, "chapterId");
    const access = await resolveViewerAccess(req.body?.user?.id);
    const chapter = await bookService.getReadableChapterDetail(bookId, chapterId, access.canViewVip, access.isAuthenticated);
    sendApiSuccessResponse(res, HttpStatusCode.OK, chapter, "Chapter fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/book
 * 后台书籍列表（需 book:manage），支持 keyword 命中标题
 */
export const listBooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
    const books = await bookService.listBooks(keyword || undefined);
    sendApiSuccessResponse(res, HttpStatusCode.OK, books, "Books fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/book/:id
 * 后台书籍详情与章节列表（需 book:manage）
 */
export const getBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const book = await bookService.getBookDetail(id);
    sendApiSuccessResponse(res, HttpStatusCode.OK, book, "Book fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/book
 * 创建书籍（需 book:manage）
 */
export const createBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = parseBookPayload(req.body as Record<string, unknown>);
    const book = await bookService.createBook(payload);
    sendApiSuccessResponse(res, HttpStatusCode.CREATED, book, "Book created successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/book/:id
 * 更新书籍元数据（需 book:manage）
 */
export const updateBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const payload = parseBookPayload(req.body as Record<string, unknown>);
    const book = await bookService.updateBook(id, payload);
    sendApiSuccessResponse(res, HttpStatusCode.OK, book, "Book updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/book/:id
 * 删除书籍（需 book:manage），章节级联删除
 */
export const deleteBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    await bookService.deleteBook(id);
    sendApiSuccessResponse(res, HttpStatusCode.OK, undefined, "Book deleted successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/book/:id/volume
 * 新增分卷（需 book:manage）
 */
export const createVolume = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookId = parsePositiveInt(req.params.id, "id");
    const payload = parseVolumePayload(req.body as Record<string, unknown>);
    const volume = await bookService.createVolume(bookId, payload);
    sendApiSuccessResponse(res, HttpStatusCode.CREATED, volume, "Volume created successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/book/:id/volume/:volumeId
 * 更新分卷（需 book:manage）
 */
export const updateVolume = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookId = parsePositiveInt(req.params.id, "id");
    const volumeId = parsePositiveInt(req.params.volumeId, "volumeId");
    const payload = parseVolumePayload(req.body as Record<string, unknown>);
    const volume = await bookService.updateVolume(bookId, volumeId, payload);
    sendApiSuccessResponse(res, HttpStatusCode.OK, volume, "Volume updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/book/:id/volume/:volumeId
 * 删除分卷及其全部章节（需 book:manage）
 */
export const deleteVolume = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookId = parsePositiveInt(req.params.id, "id");
    const volumeId = parsePositiveInt(req.params.volumeId, "volumeId");
    await bookService.deleteVolume(bookId, volumeId);
    sendApiSuccessResponse(res, HttpStatusCode.OK, undefined, "Volume deleted successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/book/:id/chapter/:chapterId
 * 后台查询章节正文（需 book:manage）
 */
export const getChapter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookId = parsePositiveInt(req.params.id, "id");
    const chapterId = parsePositiveInt(req.params.chapterId, "chapterId");
    const chapter = await bookService.getChapterDetail(bookId, chapterId);
    sendApiSuccessResponse(res, HttpStatusCode.OK, chapter, "Chapter fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/book/:id/chapter
 * 新增章节（需 book:manage）
 */
export const createChapter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookId = parsePositiveInt(req.params.id, "id");
    const payload = parseChapterPayload(req.body as Record<string, unknown>);
    const chapter = await bookService.createChapter(bookId, payload);
    sendApiSuccessResponse(res, HttpStatusCode.CREATED, chapter, "Chapter created successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/book/:id/chapter/:chapterId
 * 更新章节（需 book:manage）
 */
export const updateChapter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookId = parsePositiveInt(req.params.id, "id");
    const chapterId = parsePositiveInt(req.params.chapterId, "chapterId");
    const payload = parseChapterPayload(req.body as Record<string, unknown>);
    const chapter = await bookService.updateChapter(bookId, chapterId, payload);
    sendApiSuccessResponse(res, HttpStatusCode.OK, chapter, "Chapter updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/book/:id/chapter/:chapterId
 * 删除章节（需 book:manage）
 */
export const deleteChapter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookId = parsePositiveInt(req.params.id, "id");
    const chapterId = parsePositiveInt(req.params.chapterId, "chapterId");
    await bookService.deleteChapter(bookId, chapterId);
    sendApiSuccessResponse(res, HttpStatusCode.OK, undefined, "Chapter deleted successfully");
  } catch (error) {
    next(error);
  }
};
