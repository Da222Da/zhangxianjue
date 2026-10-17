// src/routes/timelineRoutes.ts
import { Router } from "express";
import { createTimelineEvent, deleteTimelineEvent, getTimelineEvents, updateTimelineEvent } from "../controllers/timelineController.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
import { adminOnly } from "../middlewares/roleMiddleware.ts";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Timeline
 *   description: 时间轴事件。列表公开访问，创建 / 更新 / 删除需登录且仅管理员
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     TimelineButton:
 *       type: object
 *       required:
 *         - text
 *         - url
 *       description: 事件卡片上的一个自定义按钮
 *       properties:
 *         text:
 *           type: string
 *           description: 按钮文案，最长 50 字符
 *           example: 查看笔记
 *         url:
 *           type: string
 *           description: 站内路径或 http(s) 地址
 *           example: /notes/1
 *     TimelineEvent:
 *       type: object
 *       description: 时间轴上的一个事件
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         year:
 *           type: integer
 *           description: 所属年份，时间轴按年份分组
 *           example: 2026
 *         title:
 *           type: string
 *           example: 完成个人站点重构
 *         description:
 *           type: string
 *           nullable: true
 *           description: 事件描述
 *           example: 手绘风视觉、时间轴与文章库一起上线
 *         buttons:
 *           type: array
 *           description: 自定义按钮列表，顺序即展示顺序；没有按钮时返回空数组
 *           items:
 *             $ref: '#/components/schemas/TimelineButton'
 *         sort:
 *           type: integer
 *           description: 同一年内的排序号，升序
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00.000Z"
 *     TimelineEventPayload:
 *       type: object
 *       required:
 *         - year
 *         - title
 *       properties:
 *         year:
 *           type: integer
 *           minimum: 1900
 *           maximum: 2100
 *           example: 2026
 *         title:
 *           type: string
 *           description: 标题，最长 255 字符，首尾空白会被去除
 *           example: 完成个人站点重构
 *         description:
 *           type: string
 *           nullable: true
 *           description: 描述，最长 65535 字节。更新时不传则保持原值
 *           example: 手绘风视觉、时间轴与文章库一起上线
 *         buttons:
 *           type: array
 *           nullable: true
 *           description: 自定义按钮列表，**整体替换**语义。不传则保持原值；传空数组或 null 表示清空。最多 5 个
 *           items:
 *             $ref: '#/components/schemas/TimelineButton'
 *         sort:
 *           type: integer
 *           minimum: 0
 *           description: 同一年内的排序号。创建时不传取默认值 0；更新时不传则保持原值
 *           example: 1
 *     TimelineEventEnvelope:
 *       type: object
 *       description: 单条时间轴事件响应
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/TimelineEvent'
 *         message:
 *           type: string
 *           example: Timeline events fetched successfully
 *     TimelineEventListEnvelope:
 *       type: object
 *       description: 时间轴事件列表响应。不分页，按年份倒序、同一年内 sort 升序返回
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TimelineEvent'
 *         message:
 *           type: string
 *           example: Timeline events fetched successfully
 */

/**
 * @swagger
 * /api/admin/timeline:
 *   get:
 *     tags: [Timeline]
 *     summary: 查询全部时间轴事件
 *     description: 无需登录。**不分页** —— 时间轴规模天然很小，一次返回全部，按年份倒序、同一年内 sort 升序
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TimelineEventListEnvelope'
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", getTimelineEvents);

/**
 * @swagger
 * /api/admin/timeline:
 *   post:
 *     tags: [Timeline]
 *     summary: 创建时间轴事件
 *     description: 需要登录，仅管理员。buttons 是数组，每个按钮的 text 与 url 都必须填写，最多 5 个
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TimelineEventPayload'
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TimelineEventEnvelope'
 *       400:
 *         description: 参数不合法（年份越界、标题为空、按钮文案与链接不成对等）
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
router.post("/", authMiddleware, adminOnly, createTimelineEvent);

/**
 * @swagger
 * /api/admin/timeline/{id}:
 *   put:
 *     tags: [Timeline]
 *     summary: 更新时间轴事件
 *     description: 需要登录，仅管理员。description / buttons / sort 未传入时保持原值；buttons 为**整体替换**，传空数组或 null 表示清空
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 事件主键
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TimelineEventPayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TimelineEventEnvelope'
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
 *         description: 事件不存在
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
router.put("/:id", authMiddleware, adminOnly, updateTimelineEvent);

/**
 * @swagger
 * /api/admin/timeline/{id}:
 *   delete:
 *     tags: [Timeline]
 *     summary: 删除时间轴事件
 *     description: 需要登录，仅管理员。删除成功时响应体不含 data 字段
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 事件主键
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
 *                   example: Timeline event deleted successfully
 *       400:
 *         description: 事件 ID 不合法
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
 *         description: 事件不存在
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
router.delete("/:id", authMiddleware, adminOnly, deleteTimelineEvent);

export default router;
