// src/routes/uploadRoutes.ts
import { Router } from "express";
import { uploadImage } from "../controllers/uploadController.ts";
import { UPLOAD_FIELD_NAME, uploadSingleImage } from "../middlewares/uploadMiddleware.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
import { adminOnly } from "../middlewares/roleMiddleware.ts";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: 文件上传接口，需登录
 */

/**
 * @swagger
 * /api/admin/upload:
 *   post:
 *     tags: [Upload]
 *     summary: 上传单张图片
 *     description: |
 *       需要登录。接收 multipart/form-data 的单张图片，返回可直接访问的相对路径，
 *       既可用于 article 的 cover 字段，也可用于 markdown 正文插图。
 *
 *       仅支持 jpeg / png / gif / webp，单张不超过 5 MB（可用环境变量调整）。
 *       服务端使用随机文件名落盘，不采信客户端文件名。
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: 图片文件，字段名必须为 file
 *     responses:
 *       201:
 *         description: 上传成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       description: 相对访问路径，前端按接口 origin 拼接
 *                       example: /uploads/3f2a1c9e-8b7d-4e5f-9a0b-1c2d3e4f5a6b.png
 *                     filename:
 *                       type: string
 *                       example: 3f2a1c9e-8b7d-4e5f-9a0b-1c2d3e4f5a6b.png
 *                     size:
 *                       type: integer
 *                       description: 文件字节数
 *                       example: 204800
 *                     mimetype:
 *                       type: string
 *                       example: image/png
 *                 message:
 *                   type: string
 *                   example: 图片上传成功
 *       400:
 *         description: 未接收到文件、格式不在白名单、或超出大小上限
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 未登录或令牌无效
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 已登录但角色不足（这些接口仅管理员可调用）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", authMiddleware, adminOnly, uploadSingleImage, uploadImage);

export default router;
