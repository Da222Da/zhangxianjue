// middlewares/errorHandler.js
const { AppError } = require("../utils/errors");

// ========== 404 处理中间件 ==========
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`接口不存在: ${req.method} ${req.originalUrl}`, 404, "NOT_FOUND");
  next(error);
};

// ========== 统一错误处理中间件 ==========
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    const response = {
      status: false,
      errorCode: err.errorCode || "APP_ERROR",
      message: err.message,
    };
    if (err.errors) {
      response.errors = err.errors;
    }
    return res.status(err.statusCode).json(response);
  } else {
    // 处理未知错误
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? "服务器内部错误，请稍后重试" : err.message || "未知错误";

    res.status(statusCode).json({
      status: false,
      errorCode: err.errorCode || "APP_ERROR",
      message: message,
    });
  }
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
