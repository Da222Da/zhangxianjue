// src/utils/response.ts
import { HttpStatusCode, HttpStatusMessage } from "./constants/HttpStatus.ts";
import { ErrorCode } from "./constants/ErrorInfo.ts";
import type { Response } from "express";

/** 分页元信息，与 data 同级展开 */
export interface PaginationMeta {
  /** 符合条件的总记录数 */
  total: number;
  /** 当前页码 */
  currentPage: number;
  /** 每页条数 */
  pageSize: number;
}

/** 由状态码解析默认英文描述，未收录时返回 undefined */
export const resolveHttpStatusMessage = (statusCode: HttpStatusCode): string | undefined =>
  HttpStatusMessage[HttpStatusCode[statusCode] as keyof typeof HttpStatusMessage];

/**
 * 发送成功响应
 *
 * 响应体带 `status: true`：全站统一以 status 布尔值标记成败，供前端请求封装判定，
 * statusCode / message / data 为兼容既有消费端保留。
 * @param res Express 响应对象
 * @param statusCode 状态码
 * @param data 响应数据
 * @param message 可选的自定义消息
 */
export const sendSuccessResponse = <T>(res: Response, statusCode: HttpStatusCode, data: T, message?: string) => {
  res.status(statusCode).json({
    status: true,
    statusCode,
    message: message || resolveHttpStatusMessage(statusCode),
    data,
  });
};

/**
 * 发送业务成功响应
 *
 * 与 sendSuccessResponse 的区别：不返回 statusCode，分页字段与 data 同级展开。
 * 两者共同遵循 `status: true` 的成败标记约定。
 * @param res Express 响应对象
 * @param statusCode 状态码
 * @param data 响应数据，省略时响应体中不含 data 字段（如删除接口）
 * @param message 可选的自定义消息
 * @param pagination 可选的分页元信息，传入后展开为 total / currentPage / pageSize
 */
export const sendApiSuccessResponse = <T>(res: Response, statusCode: HttpStatusCode, data?: T, message?: string, pagination?: PaginationMeta) => {
  res.status(statusCode).json({
    status: true,
    data,
    ...(pagination ?? {}),
    message: message || resolveHttpStatusMessage(statusCode),
  });
};

/**
 * 发送错误响应
 *
 * 响应体带 `status: false`，与成功响应的 `status: true` 成对，供前端请求封装统一判定。
 * @param res Express 响应对象
 * @param statusCode 状态码
 * @param message 可选的自定义消息
 * @param errorCode 可选的自定义错误码
 */
export const sendErrorResponse = (res: Response, statusCode: HttpStatusCode, message?: string, errorCode?: ErrorCode) => {
  res.status(statusCode).json({
    status: false,
    statusCode,
    message: message || resolveHttpStatusMessage(statusCode),
    errorCode: errorCode || null,
  });
};
