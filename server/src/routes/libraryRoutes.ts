import { Router } from "express";
import { getLibraryBook, getLibraryChapter, listLibraryBooks } from "../controllers/bookController.ts";
import { optionalAuthMiddleware } from "../middlewares/optionalAuthMiddleware.ts";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Library
 *   description: |
 *     书库阅读接口，列表与限免内容对游客开放。
 *     VIP 专属（is_free=false）的内容需要登录且具备 library:view（会员 / 朋友 / 管理员）。
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     BookListItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: SDL 与太空战机
 *         cover:
 *           type: string
 *           nullable: true
 *           description: 封面相对路径或外链；null 表示无封面
 *         description:
 *           type: string
 *           nullable: true
 *         category_id:
 *           type: integer
 *           nullable: true
 *           description: 分类 id；null 表示未分类
 *           example: 1
 *         category:
 *           type: string
 *           nullable: true
 *           description: 分类名（由关联查出，只读）
 *           example: 教程
 *         tags:
 *           type: array
 *           description: 标签列表
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: 道藏
 *         is_free:
 *           type: boolean
 *           description: 是否限免；false 表示 VIP 专属，需要 library:view
 *           example: true
 *         guest_visible:
 *           type: boolean
 *           description: 是否对未登录游客可见；false 时游客在列表与详情中都看不到
 *           example: true
 *         sort:
 *           type: integer
 *           example: 1
 *         volume_count:
 *           type: integer
 *           example: 2
 *         chapter_count:
 *           type: integer
 *           example: 6
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     ChapterListItem:
 *       type: object
 *       description: 章节元数据（不含正文）
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         book_id:
 *           type: integer
 *           example: 1
 *         volume_id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: 课程简介
 *         summary:
 *           type: string
 *           nullable: true
 *           description: 导读，渲染在阅读页的「本节内容」面板
 *         sort:
 *           type: integer
 *           example: 0
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     VolumeWithChapters:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         book_id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: 基础篇
 *         sort:
 *           type: integer
 *           example: 0
 *         chapters:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChapterListItem'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     BookDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/BookListItem'
 *         - type: object
 *           properties:
 *             volumes:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VolumeWithChapters'
 *     ChapterDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/ChapterListItem'
 *         - type: object
 *           properties:
 *             content:
 *               type: string
 *               description: Markdown 正文
 *     BookListEnvelope:
 *       type: object
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BookListItem'
 *         message:
 *           type: string
 *     BookEnvelope:
 *       type: object
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/BookDetail'
 *         message:
 *           type: string
 *     ChapterEnvelope:
 *       type: object
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/ChapterDetail'
 *         message:
 *           type: string
 */

/**
 * @swagger
 * /api/library/book:
 *   get:
 *     tags: [Library]
 *     summary: 查询书库书籍列表
 *     description: |
 *       公开接口。未登录游客只返回 `guest_visible=true` 的书籍；
 *       携带有效 access token 的登录用户返回全部书籍（含 VIP 专属）。
 *       前端按 `is_free` 显示「限免 / VIP」角标。
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookListEnvelope'
 */
router.get("/book", optionalAuthMiddleware, listLibraryBooks);

/**
 * @swagger
 * /api/library/book/{id}:
 *   get:
 *     tags: [Library]
 *     summary: 查询书籍详情与章节列表
 *     description: |
 *       公开接口。游客不可见（guest_visible=false）的书籍对未登录请求返回 404；
 *       限免书籍（is_free=true）登录后谁都能读；
 *       VIP 专属书籍需要请求头携带有效 access token，且账号具备 library:view。
 *       返回按分卷组织的章节列表，不含正文。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookEnvelope'
 *       403:
 *         description: 书籍为 VIP 专属，当前访客不具备 library:view
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 书籍不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/book/:id", optionalAuthMiddleware, getLibraryBook);

/**
 * @swagger
 * /api/library/book/{bookId}/chapter/{chapterId}:
 *   get:
 *     tags: [Library]
 *     summary: 查询章节正文
 *     description: |
 *       公开接口。所属书籍对游客隐藏时返回 404；
 *       所属书籍为限免时登录后谁都能读；
 *       VIP 专属书籍需要有效 access token 且具备 library:view。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChapterEnvelope'
 *       403:
 *         description: 所属书籍为 VIP 专属，当前访客不具备 library:view
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 书籍或章节不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/book/:bookId/chapter/:chapterId", optionalAuthMiddleware, getLibraryChapter);

export default router;
