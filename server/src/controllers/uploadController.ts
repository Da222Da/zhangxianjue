// src/controllers/uploadController.ts
import type { NextFunction, Request, Response } from "express";
import { sendApiSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { BadRequestError } from "../utils/errors.ts";
import { UPLOAD_FIELD_NAME } from "../middlewares/uploadMiddleware.ts";

/** 上传文件的访问路径前缀，与 app.ts 中静态目录的挂载点保持一致 */
const UPLOAD_URL_PREFIX = "/uploads";

/**
 * POST /api/admin/upload
 * 接收单张图片，返回其访问地址（需登录）
 */
export const uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      throw new BadRequestError(`未接收到文件，请使用 multipart/form-data 并以 "${UPLOAD_FIELD_NAME}" 作为字段名`);
    }

    sendApiSuccessResponse(
      res,
      HttpStatusCode.CREATED,
      {
        // 返回相对路径：前端按接口 origin 拼接，避免把主机名写死进数据库
        url: `${UPLOAD_URL_PREFIX}/${file.filename}`,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
      },
      "图片上传成功",
    );
  } catch (error) {
    next(error);
  }
};
