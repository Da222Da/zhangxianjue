// src/routes/articleRoutes.ts
import { Router } from "express";
import {
  createArticle,
  deleteArticle,
  getArticleDetail,
  getArticles,
  updateArticleContent,
  updateArticleMeta,
} from "../controllers/articleController.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
import { adminOnly } from "../middlewares/roleMiddleware.ts";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Article
 *   description: 文章管理接口。列表与详情公开访问，创建 / 更新 / 删除需登录
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Article:
 *       type: object
 *       description: 文章实体
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: 如何搭建个人博客
 *         content:
 *           type: string
 *           example: "# 标题 正文内容"
 *         cover:
 *           type: string
 *           nullable: true
 *           description: 封面地址
 *           example: https://example.com/cover.png
 *         description:
 *           type: string
 *           nullable: true
 *           description: 文章摘要
 *           example: 一篇关于博客搭建的文章
 *         category_id:
 *           type: integer
 *           nullable: true
 *           description: 分类 id（关联 Categories）；null 表示未分类
 *           example: 2
 *         category:
 *           type: string
 *           nullable: true
 *           description: 分类名（由关联查出，只读）；未分类为 null
 *           example: UE5
 *         note_id:
 *           type: integer
 *           nullable: true
 *           description: 关联笔记 id（关联 Notes）；null 表示未关联。client 据此显示「前往笔记」入口
 *           example: 2
 *         note_title:
 *           type: string
 *           nullable: true
 *           description: 关联笔记标题（由关联查出，只读）；未关联为 null
 *           example: Unreal Engine 5 移动端优化清单
 *         sort:
 *           type: integer
 *           description: 排序号，升序；0 表示未排版
 *           example: 0
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00.000Z"
 *     ArticleMetaPayload:
 *       type: object
 *       required:
 *         - title
 *       description: 元数据载荷。⚠️ 不含 content —— 正文走 PUT /{id}/content 单独更新
 *       properties:
 *         title:
 *           type: string
 *           description: 标题，最长 255 字符，首尾空白会被去除
 *           example: 如何搭建个人博客
 *         cover:
 *           type: string
 *           nullable: true
 *           description: 封面地址。创建时不传则存为 null，更新时不传则保持原值
 *           example: https://example.com/cover.png
 *         description:
 *           type: string
 *           nullable: true
 *           description: 文章摘要。创建时不传则存为 null，更新时不传则保持原值
 *           example: 一篇关于博客搭建的文章
 *         category_id:
 *           type: integer
 *           nullable: true
 *           description: 分类 id。创建时不传则为未分类；更新时不传则保持原值，传 null 表示移到未分类
 *           example: 2
 *         note_id:
 *           type: integer
 *           nullable: true
 *           description: 关联笔记 id。创建时不传则为未关联；更新时不传则保持原值，传 null 表示解除关联
 *           example: 2
 *         sort:
 *           type: integer
 *           minimum: 0
 *           description: 排序号，升序，非负整数。创建时不传则取默认值 0；更新时不传则保持原值
 *           example: 10
 *     ArticleContentPayload:
 *       type: object
 *       required:
 *         - content
 *       properties:
 *         content:
 *           type: string
 *           description: markdown 正文。最长 65535 字节（UTF-8），传空串表示清空正文。多余字段会被忽略
 *           example: "# 标题 正文内容"
 *     ErrorResponse:
 *       type: object
 *       description: 错误响应，由 errorMiddleware 统一输出
 *       properties:
 *         statusCode:
 *           type: integer
 *           example: 404
 *         message:
 *           type: string
 *           example: 文章不存在
 *         errorCode:
 *           type: integer
 *           nullable: true
 *           example: null
 *     ArticleEnvelope:
 *       type: object
 *       description: 单篇文章响应
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/Article'
 *         message:
 *           type: string
 *           example: Article fetched successfully
 *     ArticleListEnvelope:
 *       type: object
 *       description: 文章列表响应，分页字段与 data 同级
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Article'
 *         total:
 *           type: integer
 *           description: 符合条件的总记录数
 *           example: 42
 *         currentPage:
 *           type: integer
 *           example: 1
 *         pageSize:
 *           type: integer
 *           example: 10
 *         message:
 *           type: string
 *           example: Articles fetched successfully
 */

/**
 * @swagger
 * /api/admin/article:
 *   get:
 *     tags: [Article]
 *     summary: 分页查询文章列表
 *     description: 支持按关键词模糊匹配标题与正文、按分类筛选（含子分类）。结果按 sort 升序排列，同序号按创建时间倒序。无需登录
 *     parameters:
 *       - in: query
 *         name: keyword
 *         required: false
 *         description: 搜索关键词，命中 title 或 content；输入中的 % 与 _ 会按字面量匹配
 *         schema:
 *           type: string
 *           example: 博客
 *       - in: query
 *         name: category_id
 *         required: false
 *         description: 按分类筛选，命中该分类及其全部子分类
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *       - in: query
 *         name: page
 *         required: false
 *         description: 页码，从 1 开始，默认 1
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *       - in: query
 *         name: pageSize
 *         required: false
 *         description: 每页条数，默认 10，最大 100
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *           example: 10
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArticleListEnvelope'
 *       400:
 *         description: 查询参数不合法（如 page/pageSize 非正整数或超出上限）
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
router.get("/", getArticles);

/**
 * @swagger
 * /api/admin/article/{id}:
 *   get:
 *     tags: [Article]
 *     summary: 查询文章详情
 *     description: 无需登录
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 文章主键
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArticleEnvelope'
 *       400:
 *         description: 文章 ID 不合法
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 文章不存在
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
router.get("/:id", getArticleDetail);

/**
 * @swagger
 * /api/admin/article:
 *   post:
 *     tags: [Article]
 *     summary: 创建文章
 *     description: 需要登录，仅管理员。只创建元数据，content 落库为空串，正文随后通过 PUT /{id}/content 补录
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ArticleMetaPayload'
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArticleEnvelope'
 *       400:
 *         description: 参数不合法（标题为空、超出长度上限、正文超过 65535 字节等）
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
router.post("/", authMiddleware, adminOnly, createArticle);

/**
 * @swagger
 * /api/admin/article/{id}:
 *   put:
 *     tags: [Article]
 *     summary: 更新文章元数据
 *     description: 需要登录，仅管理员。**不触碰 content**。cover / description / category_id / note_id / sort 未传入时保持原值不变
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 文章主键
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ArticleMetaPayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArticleEnvelope'
 *       400:
 *         description: 参数不合法
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
 *       404:
 *         description: 文章不存在
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
router.put("/:id", authMiddleware, adminOnly, updateArticleMeta);

/**
 * @swagger
 * /api/admin/article/{id}/content:
 *   put:
 *     tags: [Article]
 *     summary: 更新文章正文
 *     description: 需要登录，仅管理员。只更新 content，请求体中的其它字段一律忽略。传空串表示清空正文
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 文章主键
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ArticleContentPayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArticleEnvelope'
 *       400:
 *         description: 参数不合法（content 非字符串或超过 65535 字节）
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
 *       404:
 *         description: 文章不存在
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
// ⚠️ 与 /:id 是两条不同的路径模板（多一段 content），不存在匹配冲突，顺序无关
router.put("/:id/content", authMiddleware, adminOnly, updateArticleContent);

/**
 * @swagger
 * /api/admin/article/{id}:
 *   delete:
 *     tags: [Article]
 *     summary: 删除文章
 *     description: 需要登录。删除成功时响应体不含 data 字段
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 文章主键
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Article deleted successfully
 *       400:
 *         description: 文章 ID 不合法
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
 *       404:
 *         description: 文章不存在
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
router.delete("/:id", authMiddleware, adminOnly, deleteArticle);

export default router;
