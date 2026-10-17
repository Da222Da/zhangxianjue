// src/routes/noteRoutes.ts
import { Router } from "express";
import { createNote, deleteNote, getNoteDetail, getNotes, updateNoteContent, updateNoteMeta } from "../controllers/noteController.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
import { adminOnly } from "../middlewares/roleMiddleware.ts";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Note
 *   description: 笔记管理接口。正文为思维导图（markmap 的 Markdown 文本）。列表与详情公开访问，创建 / 更新 / 删除需登录
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Note:
 *       type: object
 *       description: 笔记实体。⚠️ 仅**列表**接口排除 content 字段，详情 / 创建 / 更新接口都返回正文
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: Unreal Engine 5 移动端优化清单
 *         content:
 *           type: string
 *           description: 思维导图正文，markmap 直接消费的 Markdown 文本。仅详情接口返回
 *           example: "# UE5 移动端优化\n\n- **渲染管线**\n  - 关闭 Lumen"
 *         cover:
 *           type: string
 *           nullable: true
 *           description: 封面地址，存相对路径
 *           example: /uploads/3f2a1c9e-8b7d-4e5f-9a0b-1c2d3e4f5a6b.png
 *         description:
 *           type: string
 *           nullable: true
 *           description: 描述摘要
 *           example: 从渲染管线到 Draw Call 的移动端优化顺序
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
 *         sort:
 *           type: integer
 *           description: 排序号，升序；0 表示未排版
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00.000Z"
 *     NoteMetaPayload:
 *       type: object
 *       required:
 *         - title
 *       description: 元数据载荷。⚠️ 不含 content —— 正文走 PUT /{id}/content 单独更新
 *       properties:
 *         title:
 *           type: string
 *           description: 标题，最长 255 字符，首尾空白会被去除
 *           example: Unreal Engine 5 移动端优化清单
 *         cover:
 *           type: string
 *           nullable: true
 *           description: 封面地址。创建时不传则存为 null，更新时不传则保持原值
 *           example: /uploads/3f2a1c9e-8b7d-4e5f-9a0b-1c2d3e4f5a6b.png
 *         description:
 *           type: string
 *           nullable: true
 *           description: 描述摘要。创建时不传则存为 null，更新时不传则保持原值
 *           example: 从渲染管线到 Draw Call 的移动端优化顺序
 *         category_id:
 *           type: integer
 *           nullable: true
 *           description: 分类 id。创建时不传则为未分类；更新时不传则保持原值，传 null 表示移到未分类
 *           example: 2
 *         sort:
 *           type: integer
 *           minimum: 0
 *           description: 排序号，升序，非负整数。创建时不传则取默认值 0；更新时不传则保持原值
 *           example: 1
 *     NoteContentPayload:
 *       type: object
 *       required:
 *         - content
 *       properties:
 *         content:
 *           type: string
 *           description: 思维导图正文。最长 65535 字节（UTF-8），传空串表示清空正文。多余字段会被忽略
 *           example: "# UE5 移动端优化\n\n- **渲染管线**\n  - 关闭 Lumen"
 *     NoteEnvelope:
 *       type: object
 *       description: 单条笔记响应
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/Note'
 *         message:
 *           type: string
 *           example: Note fetched successfully
 *     NoteListEnvelope:
 *       type: object
 *       description: 笔记列表响应，分页字段与 data 同级。⚠️ data 中的元素不含 content
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Note'
 *         total:
 *           type: integer
 *           description: 符合条件的总记录数
 *           example: 3
 *         currentPage:
 *           type: integer
 *           example: 1
 *         pageSize:
 *           type: integer
 *           example: 10
 *         message:
 *           type: string
 *           example: Notes fetched successfully
 */

/**
 * @swagger
 * /api/admin/note:
 *   get:
 *     tags: [Note]
 *     summary: 分页查询笔记列表
 *     description: |
 *       支持按关键词模糊匹配标题、描述与正文、按分类筛选（含子分类）。结果按 sort 升序排列，同序号按创建时间倒序。
 *       ⚠️ 列表**不返回 content 字段**（思维导图正文体积较大，卡片页与表格页均不需要），需要正文请调用详情接口。无需登录
 *     parameters:
 *       - in: query
 *         name: keyword
 *         required: false
 *         description: 搜索关键词，命中 title、description 或 content；输入中的 % 与 _ 会按字面量匹配
 *         schema:
 *           type: string
 *           example: Nanite
 *       - in: query
 *         name: category_id
 *         required: false
 *         description: 按分类筛选，命中该分类及其全部子分类
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 2
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
 *               $ref: '#/components/schemas/NoteListEnvelope'
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
router.get("/", getNotes);

/**
 * @swagger
 * /api/admin/note/{id}:
 *   get:
 *     tags: [Note]
 *     summary: 查询笔记详情
 *     description: 返回含 content 的完整实体，供思维导图渲染与内容编辑器读取。无需登录
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 笔记主键
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
 *               $ref: '#/components/schemas/NoteEnvelope'
 *       400:
 *         description: 笔记 ID 不合法
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 笔记不存在
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
router.get("/:id", getNoteDetail);

/**
 * @swagger
 * /api/admin/note:
 *   post:
 *     tags: [Note]
 *     summary: 创建笔记
 *     description: 需要登录，仅管理员。只创建元数据，content 落库为空串，正文随后通过 PUT /{id}/content 补录
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NoteMetaPayload'
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NoteEnvelope'
 *       400:
 *         description: 参数不合法（标题为空或超出长度上限等）
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
router.post("/", authMiddleware, adminOnly, createNote);

/**
 * @swagger
 * /api/admin/note/{id}:
 *   put:
 *     tags: [Note]
 *     summary: 更新笔记元数据
 *     description: 需要登录，仅管理员。**不触碰 content**。cover / description / category / sort 未传入时保持原值不变
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 笔记主键
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NoteMetaPayload'
 *     responses:
 *       200:
 *         description: 更新成功，返回更新后的完整实体（**含 content**，仅列表接口才排除正文）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NoteEnvelope'
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
 *         description: 笔记不存在
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
router.put("/:id", authMiddleware, adminOnly, updateNoteMeta);

/**
 * @swagger
 * /api/admin/note/{id}/content:
 *   put:
 *     tags: [Note]
 *     summary: 更新笔记正文
 *     description: 需要登录，仅管理员。只更新 content，请求体中的其它字段一律忽略。传空串表示清空正文
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 笔记主键
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NoteContentPayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NoteEnvelope'
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
 *         description: 笔记不存在
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
router.put("/:id/content", authMiddleware, adminOnly, updateNoteContent);

/**
 * @swagger
 * /api/admin/note/{id}:
 *   delete:
 *     tags: [Note]
 *     summary: 删除笔记
 *     description: 需要登录，仅管理员。删除成功时响应体不含 data 字段
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 笔记主键
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
 *                   example: Note deleted successfully
 *       400:
 *         description: 笔记 ID 不合法
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
 *         description: 笔记不存在
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
router.delete("/:id", authMiddleware, adminOnly, deleteNote);

export default router;
