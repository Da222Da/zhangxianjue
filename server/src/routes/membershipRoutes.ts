import { Router } from "express";
import { applyMembership, getMembershipStatus } from "../controllers/membershipController.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Membership
 *   description: 会员升级申请（client）。需登录，通过后由管理员在后台审核
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     MembershipStatus:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [none, pending, approved, rejected]
 *           description: none 表示从未申请过
 *           example: pending
 *         appliedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         reviewedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

/**
 * @swagger
 * /api/membership/apply:
 *   post:
 *     tags: [Membership]
 *     summary: 提交会员升级申请
 *     description: |
 *       需登录。管理员无需申请、未到期的会员无需重复申请；会员到期会自动降级，可重新申请。
 *       同一用户同时只能有一条 pending 申请。
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: 提交成功
 *       400:
 *         description: 管理员 / 已是会员 / 已有待审核申请
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 未登录或令牌无效
 */
router.post("/apply", authMiddleware, applyMembership);

/**
 * @swagger
 * /api/membership/status:
 *   get:
 *     tags: [Membership]
 *     summary: 查询当前用户的会员申请状态
 *     description: 从未申请过时 status 为 none（不是 404）
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/MembershipStatus'
 *                 message:
 *                   type: string
 *       401:
 *         description: 未登录或令牌无效
 */
router.get("/status", authMiddleware, getMembershipStatus);

export default router;
