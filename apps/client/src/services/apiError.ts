// src/services/apiError.ts
import type { ApiErrorBody } from "@/types/api";

/**
 * 统一的接口异常
 *
 * 由请求层的响应拦截器构造，保证调用方拿到的 `error.message`
 * 始终是服务端返回的文案，而不是 axios 的 "Request failed with status code xxx"。
 */
export class ApiError extends Error {
  /** HTTP 状态码，网络异常等无响应场景为 0 */
  readonly statusCode: number;
  /** 业务错误码，服务端未返回时为 null */
  readonly errorCode: number | null;

  constructor(message: string, statusCode: number, errorCode: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/** 判断 unknown 值是否为服务端错误响应体 */
export const isApiErrorBody = (value: unknown): value is ApiErrorBody => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  return typeof body.message === "string" && typeof body.statusCode === "number";
};
