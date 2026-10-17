// src/controllers/timelineController.ts
import type { NextFunction, Request, Response } from "express";
import { sendApiSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { BadRequestError } from "../utils/errors.ts";
import * as timelineService from "../services/timelineService.ts";
import type { TimelineEventPayload } from "../services/timelineService.ts";
import type { TimelineButton } from "../models/index.ts";

/** 校验并转换正整数（用于路径参数） */
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

/** 校验年份：闭区间内的整数 */
const parseYear = (raw: unknown): number => {
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new BadRequestError("year 必须为整数");
  }
  if (value < timelineService.MIN_YEAR || value > timelineService.MAX_YEAR) {
    throw new BadRequestError(`year 必须在 ${timelineService.MIN_YEAR} - ${timelineService.MAX_YEAR} 之间`);
  }
  return value;
};

/** 校验按字符数限制的必填字符串（对应 VARCHAR 列） */
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

/** 校验可选的描述文本（TEXT 列，按 UTF-8 字节数限制，不做 trim） */
const parseOptionalText = (raw: unknown, field: string): string | null | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new BadRequestError(`${field} 必须为字符串`);
  }
  if (Buffer.byteLength(raw, "utf8") > timelineService.MAX_TEXT_BYTES) {
    throw new BadRequestError(`${field} 超过 ${timelineService.MAX_TEXT_BYTES} 字节上限`);
  }
  return raw;
};

/**
 * 校验必填的按钮链接
 *
 * ⚠️ 只放行「站内路径」与 http(s) 地址：
 * 链接会直接渲染成 `<a href>`，放行 `javascript:` 这类协议等于给后台留了一个存储型 XSS。
 */
const parseRequiredUrl = (raw: unknown, field: string): string => {
  if (typeof raw !== "string") {
    throw new BadRequestError(`${field} 必须为字符串`);
  }
  const value = raw.trim();
  if (!value) {
    throw new BadRequestError(`${field} 不能为空`);
  }
  if (value.length > timelineService.MAX_URL_LENGTH) {
    throw new BadRequestError(`${field} 长度不能超过 ${timelineService.MAX_URL_LENGTH} 个字符`);
  }
  // 站内路径：以单个 / 开头；// 开头的是协议相对外链，一并拒绝，避免绕过协议校验
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return value;
    }
  } catch {
    // 落到下面统一报错
  }
  throw new BadRequestError(`${field} 必须是站内路径（/notes/1）或以 http(s):// 开头的地址`);
};

/**
 * 校验按钮数组
 *
 * - 未传 → undefined（不设置 / 保持原值）
 * - null / 空数组 → null（清空）
 * - 非法结构、超过上限、单个按钮缺文案或链接 → 400
 */
const parseButtons = (raw: unknown): TimelineButton[] | null | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (!Array.isArray(raw)) {
    throw new BadRequestError("buttons 必须是数组");
  }
  if (raw.length === 0) {
    return null;
  }
  if (raw.length > timelineService.MAX_BUTTONS) {
    throw new BadRequestError(`buttons 最多 ${timelineService.MAX_BUTTONS} 个`);
  }

  return raw.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new BadRequestError(`buttons[${index}] 必须是对象`);
    }
    const { text, url } = item as Record<string, unknown>;
    return {
      text: parseRequiredString(text, `buttons[${index}].text`, timelineService.MAX_BUTTON_TEXT_LENGTH),
      url: parseRequiredUrl(url, `buttons[${index}].url`),
    };
  });
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
 * 解析请求体
 *
 * 逐个字段取值而非整体透传：authMiddleware 会向 req.body 注入 user 字段，
 * 显式取值可确保该字段不会流入 service 层。
 */
const parsePayload = (body: unknown): TimelineEventPayload => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestError("请求体必须为 JSON 对象");
  }
  const { year, title, description, buttons, sort } = body as Record<string, unknown>;

  return {
    year: parseYear(year),
    title: parseRequiredString(title, "title", timelineService.MAX_TITLE_LENGTH),
    description: parseOptionalText(description, "description"),
    buttons: parseButtons(buttons),
    sort: parseOptionalSort(sort),
  };
};

/**
 * GET /api/admin/timeline
 * 查询全部时间轴事件（按年份倒序、年内顺序升序）
 */
export const getTimelineEvents = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const events = await timelineService.listTimelineEvents();
    sendApiSuccessResponse(res, HttpStatusCode.OK, events, "Timeline events fetched successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/timeline
 * 创建事件（需登录）
 */
export const createTimelineEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = parsePayload(req.body);
    const event = await timelineService.createTimelineEvent(payload);

    sendApiSuccessResponse(res, HttpStatusCode.CREATED, event, "Timeline event created successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/timeline/:id
 * 更新事件（需登录）。description / buttons / sort 未传入时保持原值；buttons 为整体替换
 */
export const updateTimelineEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    const payload = parsePayload(req.body);
    const event = await timelineService.updateTimelineEvent(id, payload);

    sendApiSuccessResponse(res, HttpStatusCode.OK, event, "Timeline event updated successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/timeline/:id
 * 删除事件（需登录）
 */
export const deleteTimelineEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id, "id");
    await timelineService.deleteTimelineEvent(id);

    // 删除成功不返回 data 字段，与其它删除接口一致
    sendApiSuccessResponse(res, HttpStatusCode.OK, undefined, "Timeline event deleted successfully");
  } catch (error) {
    next(error);
  }
};
