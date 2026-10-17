// src/utils/errors.ts
import { HttpStatusCode } from "./constants/HttpStatus.ts";
import type { ErrorCode } from "./constants/ErrorInfo.ts";

/**
 * 业务异常基类
 *
 * service 层抛出本类及其子类，由 errorMiddleware 统一转换为 HTTP 响应，
 * 从而避免在 service / controller 中直接感知 res。
 */
export class AppError extends Error {
  /** 对应的 HTTP 状态码 */
  readonly httpStatus: HttpStatusCode;
  /** 业务错误码，未指定时响应体中为 null */
  readonly errorCode: ErrorCode | null;

  constructor(message: string, httpStatus: HttpStatusCode = HttpStatusCode.INTERNAL_SERVER_ERROR, errorCode: ErrorCode | null = null) {
    super(message);
    this.name = new.target.name;
    this.httpStatus = httpStatus;
    this.errorCode = errorCode;
    // 剔除构造函数帧，让堆栈指向真正的抛出位置
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 请求参数不合法 → 400 */
export class BadRequestError extends AppError {
  constructor(message: string, errorCode: ErrorCode | null = null) {
    super(message, HttpStatusCode.BAD_REQUEST, errorCode);
  }
}

/** 未登录或凭证失效 → 401 */
export class UnauthorizedError extends AppError {
  constructor(message: string, errorCode: ErrorCode | null = null) {
    super(message, HttpStatusCode.UNAUTHORIZED, errorCode);
  }
}

/** 已登录但无权限 → 403 */
export class ForbiddenError extends AppError {
  constructor(message: string, errorCode: ErrorCode | null = null) {
    super(message, HttpStatusCode.FORBIDDEN, errorCode);
  }
}

/** 资源不存在 → 404 */
export class NotFoundError extends AppError {
  constructor(message: string, errorCode: ErrorCode | null = null) {
    super(message, HttpStatusCode.NOT_FOUND, errorCode);
  }
}
