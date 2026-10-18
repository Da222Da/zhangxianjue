import { Router } from "express";
import {
  createBook,
  createChapter,
  createVolume,
  deleteBook,
  deleteChapter,
  deleteVolume,
  getBook,
  getChapter,
  listBooks,
  updateBook,
  updateChapter,
  updateVolume,
} from "../controllers/bookController.ts";
import {
  createBookCategory,
  createTag,
  deleteBookCategory,
  deleteTag,
  listBookCategories,
  listTags,
  updateBookCategory,
  updateTag,
} from "../controllers/bookTaxonomyController.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
import { requirePermission } from "../middlewares/permissionMiddleware.ts";
import { Permissions } from "../utils/constants/permissions.ts";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Book
 *   description: 后台书库管理（书籍与章节）。全部需要登录且具备 book:manage 权限
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     BookPayload:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         title:
 *           type: string
 *           example: SDL 与太空战机
 *         cover:
 *           type: string
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         category_id:
 *           type: integer
 *           nullable: true
 *           description: 分类 id；null 表示未分类
 *           example: 1
 *         tag_ids:
 *           type: array
 *           description: 标签 id 列表；整体替换语义，空数组表示清空
 *           items:
 *             type: integer
 *           example: [1, 3]
 *         is_free:
 *           type: boolean
 *           description: 是否限免；false 表示 VIP 专属
 *           example: true
 *         guest_visible:
 *           type: boolean
 *           description: 是否对未登录游客可见；false 时游客在列表与详情中都看不到
 *           example: true
 *         sort:
 *           type: integer
 *           minimum: 0
 *           example: 1
 *     VolumePayload:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         title:
 *           type: string
 *           example: 基础篇
 *         sort:
 *           type: integer
 *           minimum: 0
 *           example: 0
 *     BookTaxonomyPayload:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: 分类 / 标签名称，最长 100 字符，全局唯一
 *           example: 教程
 *         sort:
 *           type: integer
 *           minimum: 0
 *           description: 排序号，升序；不传则取 0
 *           example: 1
 *     ChapterPayload:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         volume_id:
 *           type: integer
 *           description: 所属分卷 id；创建时必填，更新时传入表示移动到另一个分卷
 *           example: 1
 *         title:
 *           type: string
 *           example: 课程简介
 *         summary:
 *           type: string
 *           nullable: true
 *           description: 导读，渲染在阅读页的「本节内容」面板
 *         content:
 *           type: string
 *           description: Markdown 正文；允许空串
 *         sort:
 *           type: integer
 *           minimum: 0
 *           example: 0
 */

/**
 * @swagger
 * /api/admin/book:
 *   get:
 *     tags: [Book]
 *     summary: 后台书籍列表
 *     description: 需要 `book:manage` 权限。可用 keyword 模糊匹配标题。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookListEnvelope'
 *       403:
 *         description: 无 book:manage 权限
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     tags: [Book]
 *     summary: 创建书籍
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookPayload'
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookEnvelope'
 *       400:
 *         description: 参数不合法
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), listBooks);
router.post("/", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), createBook);

/**
 * @swagger
 * /api/admin/book/category:
 *   get:
 *     tags: [Book]
 *     summary: 查询书籍分类列表
 *     description: 需要 `book:manage` 权限。按 sort 升序
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 查询成功
 *   post:
 *     tags: [Book]
 *     summary: 新增书籍分类
 *     description: 需要 `book:manage` 权限。名称全局唯一
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookTaxonomyPayload'
 *     responses:
 *       201:
 *         description: 创建成功
 *       400:
 *         description: 参数不合法或名称已存在
 *       403:
 *         description: 无 book:manage 权限
 */
router.get("/category", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), listBookCategories);
router.post("/category", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), createBookCategory);

/**
 * @swagger
 * /api/admin/book/category/{id}:
 *   put:
 *     tags: [Book]
 *     summary: 更新书籍分类
 *     description: 需要 `book:manage` 权限
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookTaxonomyPayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 分类不存在
 *   delete:
 *     tags: [Book]
 *     summary: 删除书籍分类
 *     description: 需要 `book:manage` 权限。相关书籍的 category_id 会置空
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 分类不存在
 */
router.put("/category/:id", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), updateBookCategory);
router.delete("/category/:id", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), deleteBookCategory);

/**
 * @swagger
 * /api/admin/book/tag:
 *   get:
 *     tags: [Book]
 *     summary: 查询书籍标签列表
 *     description: 需要 `book:manage` 权限。按 sort 升序
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 查询成功
 *   post:
 *     tags: [Book]
 *     summary: 新增书籍标签
 *     description: 需要 `book:manage` 权限。名称全局唯一
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookTaxonomyPayload'
 *     responses:
 *       201:
 *         description: 创建成功
 *       400:
 *         description: 参数不合法或名称已存在
 *       403:
 *         description: 无 book:manage 权限
 */
router.get("/tag", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), listTags);
router.post("/tag", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), createTag);

/**
 * @swagger
 * /api/admin/book/tag/{id}:
 *   put:
 *     tags: [Book]
 *     summary: 更新书籍标签
 *     description: 需要 `book:manage` 权限
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookTaxonomyPayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 标签不存在
 *   delete:
 *     tags: [Book]
 *     summary: 删除书籍标签
 *     description: 需要 `book:manage` 权限。书籍与标签的关联会一并删除
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 标签不存在
 */
router.put("/tag/:id", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), updateTag);
router.delete("/tag/:id", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), deleteTag);

/**
 * @swagger
 * /api/admin/book/{id}:
 *   get:
 *     tags: [Book]
 *     summary: 书籍详情与分卷/章节列表
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookEnvelope'
 *       404:
 *         description: 书籍不存在
 *   put:
 *     tags: [Book]
 *     summary: 更新书籍元数据
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookPayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookEnvelope'
 *       404:
 *         description: 书籍不存在
 *   delete:
 *     tags: [Book]
 *     summary: 删除书籍
 *     description: ⚠️ 章节会随外键级联删除
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功，响应体不含 data
 *       404:
 *         description: 书籍不存在
 */
router.get("/:id", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), getBook);
router.put("/:id", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), updateBook);
router.delete("/:id", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), deleteBook);

/**
 * @swagger
 * /api/admin/book/{id}/volume:
 *   post:
 *     tags: [Book]
 *     summary: 新增分卷
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VolumePayload'
 *     responses:
 *       201:
 *         description: 创建成功
 *       404:
 *         description: 书籍不存在
 */
router.post("/:id/volume", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), createVolume);

/**
 * @swagger
 * /api/admin/book/{id}/volume/{volumeId}:
 *   put:
 *     tags: [Book]
 *     summary: 更新分卷
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: volumeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VolumePayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 分卷不存在
 *   delete:
 *     tags: [Book]
 *     summary: 删除分卷
 *     description: ⚠️ 该分卷下的全部章节会一并删除，不可恢复
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: volumeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功，响应体不含 data
 *       404:
 *         description: 分卷不存在
 */
router.put("/:id/volume/:volumeId", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), updateVolume);
router.delete("/:id/volume/:volumeId", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), deleteVolume);

/**
 * @swagger
 * /api/admin/book/{id}/chapter:
 *   post:
 *     tags: [Book]
 *     summary: 新增章节
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChapterPayload'
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChapterEnvelope'
 *       404:
 *         description: 书籍不存在
 */
router.post("/:id/chapter", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), createChapter);

/**
 * @swagger
 * /api/admin/book/{id}/chapter/{chapterId}:
 *   get:
 *     tags: [Book]
 *     summary: 后台查询章节正文
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChapterEnvelope'
 *       404:
 *         description: 章节不存在
 *   put:
 *     tags: [Book]
 *     summary: 更新章节
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChapterPayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChapterEnvelope'
 *       404:
 *         description: 章节不存在
 *   delete:
 *     tags: [Book]
 *     summary: 删除章节
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功，响应体不含 data
 *       404:
 *         description: 章节不存在
 */
router.get("/:id/chapter/:chapterId", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), getChapter);
router.put("/:id/chapter/:chapterId", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), updateChapter);
router.delete("/:id/chapter/:chapterId", authMiddleware, requirePermission(Permissions.BOOK_MANAGE), deleteChapter);

export default router;
