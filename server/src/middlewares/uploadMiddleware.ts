// src/middlewares/uploadMiddleware.ts
import { randomUUID } from "crypto";
import { existsSync, mkdirSync } from "fs";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { UPLOAD_DIR, UPLOAD_MAX_SIZE_BYTES, UPLOAD_MAX_SIZE_MB } from "../config/env.ts";
import { BadRequestError } from "../utils/errors.ts";

/** 表单字段名，前端必须以该名称上传文件 */
export const UPLOAD_FIELD_NAME = "file";

/**
 * 允许的图片类型白名单：MIME 类型 → 落盘扩展名
 *
 * ⚠️ 刻意不收录 image/svg+xml：SVG 是允许内嵌脚本的 XML，
 * 从同源 /uploads 直接访问会构成存储型 XSS。
 * 扩展名只从这个表推导，绝不采信客户端提交的文件名。
 */
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

/** 白名单的展示文案，用于错误提示 */
const ALLOWED_TYPES_HINT = Object.keys(ALLOWED_IMAGE_TYPES)
  .map((mime) => mime.replace("image/", ""))
  .join(" / ");

// 目录不存在时先建出来，否则 multer 落盘会失败
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  // 随机文件名 + MIME 推导的扩展名：不采信客户端文件名，杜绝路径穿越与同名覆盖
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_IMAGE_TYPES[file.mimetype] ?? ""}`),
});

const singleImageUpload = multer({
  storage,
  limits: {
    fileSize: UPLOAD_MAX_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      cb(new BadRequestError(`仅支持 ${ALLOWED_TYPES_HINT} 格式的图片`));
      return;
    }
    cb(null, true);
  },
}).single(UPLOAD_FIELD_NAME);

/**
 * 单张图片上传中间件
 *
 * 把 multer 自身的错误统一转成 400：MulterError 不是 AppError，
 * 若直接交给 errorMiddleware 会被兜底成 520，让调用方误以为是服务端故障。
 */
export const uploadSingleImage = (req: Request, res: Response, next: NextFunction): void => {
  singleImageUpload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(new BadRequestError(`图片大小不能超过 ${UPLOAD_MAX_SIZE_MB} MB`));
        return;
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        next(new BadRequestError(`仅支持单张图片，且表单字段名必须为 "${UPLOAD_FIELD_NAME}"`));
        return;
      }
      next(new BadRequestError(`图片上传失败：${err.message}`));
      return;
    }

    // 类型不符等业务异常原样透传
    next(err);
  });
};
