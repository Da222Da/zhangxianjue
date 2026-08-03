// ========== 基础错误类 ==========
class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;

    // 在自定义错误类时，清理掉无用的底层调用堆栈，让报错信息更干净、更精准地指向你写的业务代码。
    Error.captureStackTrace(this, this.constructor);
  }
}

// ========== 具体的错误类 ==========

// 404 未找到
class NotFoundError extends AppError {
  constructor(message = "资源不存在") {
    super(message, 404, "NOT_FOUND");
  }
}

// 400 参数验证错误
class ValidationError extends AppError {
  constructor(message = "参数验证失败", errors = null) {
    super(message, 400, "VALIDATION_ERROR");
    this.errors = errors; // 可以附带详细字段错误
  }
}

// 401 未授权
class UnauthorizedError extends AppError {
  constructor(message = "未授权，请登录") {
    super(message, 401, "UNAUTHORIZED");
  }
}

// 403 禁止访问
class ForbiddenError extends AppError {
  constructor(message = "无权访问") {
    super(message, 403, "FORBIDDEN");
  }
}

// 500 服务器内部错误（不对用户暴露详情）
class InternalError extends AppError {
  constructor(message = "服务器内部错误") {
    super(message, 500, "INTERNAL_ERROR");
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  InternalError,
};
