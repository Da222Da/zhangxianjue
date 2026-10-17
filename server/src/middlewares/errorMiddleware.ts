// src/middlewares/errorMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import { sendErrorResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { AppError } from "../utils/errors.ts";

// 错误处理中间件
export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  // 1. 业务异常：按异常自带的状态码与错误码返回
  if (err instanceof AppError) {
    return sendErrorResponse(res, err.httpStatus, err.message, err.errorCode ?? undefined);
  }

  // 2. 未知异常：打印堆栈并保持原有的兜底行为（520）
  if (err instanceof Error) {
    console.error(err.stack);
  } else {
    console.error(err);
  }
  const message = err instanceof Error ? err.message : "Internal Server Error";
  return sendErrorResponse(res, HttpStatusCode.OTHER_ERROR, message);
};
