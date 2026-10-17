// src/routes/categoryRoutes.ts
import { Router } from "express";
import { createCategory, deleteCategory, getCategoryTree, updateCategory } from "../controllers/categoryController.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
import { adminOnly } from "../middlewares/roleMiddleware.ts";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Category
 *   description: 分类管理接口（树形）。查询公开，创建 / 更新 / 删除需登录且仅管理员
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       description: 分类实体
 *       properties:
 *         id:
 *           type: integer
 *           example: 2
 *         name:
 *           type: string
 *           description: 分类名，同级唯一
 *           example: UE5
 *         parent_id:
 *           type: integer
 *           nullable: true
 *           description: 父分类 id；null 表示根分类
 *           example: 1
 *         sort:
 *           type: integer
 *           description: 同级排序号，升序；0 表示未排版
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CategoryTreeNode:
 *       type: object
 *       description: 分类树节点，children 递归嵌套
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: 引擎
 *         parent_id:
 *           type: integer
 *           nullable: true
 *           example: null
 *         sort:
 *           type: integer
 *           example: 1
 *         children:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CategoryTreeNode'
 *     CategoryPayload:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: 分类名，最长 255 字符，首尾空白会被去除；同级下不可重名
 *           example: UE5
 *         parent_id:
 *           type: integer
 *           nullable: true
 *           description: 父分类 id。创建时不传为根分类；更新时不传保持原值，传 null 表示移到根级
 *           example: 1
 *         sort:
 *           type: integer
 *           minimum: 0
 *           description: 同级排序号。创建时不传取 0；更新时不传保持原值
 *           example: 1
 *     CategoryEnvelope:
 *       type: object
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/Category'
 *         message:
 *           type: string
 *           example: Category created successfully
 *     CategoryTreeEnvelope:
 *       type: object
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CategoryTreeNode'
 *         message:
 *           type: string
 *           example: Categories fetched successfully
 */

/**
 * @swagger
 * /api/admin/category:
 *   get:
 *     tags: [Category]
 *     summary: 查询完整分类树
 *     description: 返回根分类数组，children 递归嵌套；同级按 sort 升序、再按名称升序。无需登录
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryTreeEnvelope'
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", getCategoryTree);

/**
 * @swagger
 * /api/admin/category:
 *   post:
 *     tags: [Category]
 *     summary: 创建分类
 *     description: 需要登录，仅管理员。同级下名称不可重复
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryPayload'
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryEnvelope'
 *       400:
 *         description: 参数不合法、同级重名或父分类不存在
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
 *         description: 已登录但角色不足
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
router.post("/", authMiddleware, adminOnly, createCategory);

/**
 * @swagger
 * /api/admin/category/{id}:
 *   put:
 *     tags: [Category]
 *     summary: 更新分类
 *     description: |
 *       需要登录，仅管理员。可修改名称、父分类与排序。
 *       ⚠️ 移动父分类时不允许成环：不能挂到自己或自己的子孙下面。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryPayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryEnvelope'
 *       400:
 *         description: 参数不合法、同级重名、父分类不存在或成环
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
 *         description: 已登录但角色不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 分类不存在
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
router.put("/:id", authMiddleware, adminOnly, updateCategory);

/**
 * @swagger
 * /api/admin/category/{id}:
 *   delete:
 *     tags: [Category]
 *     summary: 删除分类
 *     description: |
 *       需要登录，仅管理员。
 *       ⚠️ 存在子分类或仍被文章 / 笔记引用时**拒绝删除**（400），需先移动或清空引用。
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
 *         description: 删除成功，响应体不含 data
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
 *                   example: Category deleted successfully
 *       400:
 *         description: 存在子分类或仍被引用
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
 *         description: 已登录但角色不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 分类不存在
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
router.delete("/:id", authMiddleware, adminOnly, deleteCategory);

export default router;
