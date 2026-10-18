import { Router } from "express";
import { listApplications, reviewApplication } from "../controllers/adminMembershipController.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
import { requirePermission } from "../middlewares/permissionMiddleware.ts";
import { Permissions } from "../utils/constants/permissions.ts";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: MembershipAdmin
 *   description: 会员申请审核（后台）。需要登录且具备 user:manage 权限
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     MembershipApplicationItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: integer
 *           example: 5
 *         username:
 *           type: string
 *           example: 普通小林
 *         phone:
 *           type: string
 *           nullable: true
 *           example: "13800000003"
 *         role_id:
 *           type: integer
 *           example: 2
 *         role_name:
 *           type: string
 *           example: 普通用户
 *         role_code:
 *           type: string
 *           example: user
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         reviewed_by:
 *           type: integer
 *           nullable: true
 *         reviewed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     MembershipListEnvelope:
 *       type: object
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MembershipApplicationItem'
 *         total:
 *           type: integer
 *         currentPage:
 *           type: integer
 *         pageSize:
 *           type: integer
 *         message:
 *           type: string
 */

/**
 * @swagger
 * /api/admin/membership:
 *   get:
 *     tags: [MembershipAdmin]
 *     summary: 分页查询会员申请
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MembershipListEnvelope'
 *       403:
 *         description: 无 user:manage 权限
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", authMiddleware, requirePermission(Permissions.USER_MANAGE), listApplications);

/**
 * @swagger
 * /api/admin/membership/{id}:
 *   put:
 *     tags: [MembershipAdmin]
 *     summary: 审核会员申请
 *     description: |
 *       请求体 `{ approve: true }` 通过并把用户角色改为「会员」，默认有效期 1 年；
 *       `{ approve: false }` 拒绝。已处理的申请不能重复审核。
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
 *             type: object
 *             required: [approve]
 *             properties:
 *               approve:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 审核成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/MembershipApplicationItem'
 *       400:
 *         description: 申请已处理或申请人已是管理员
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 申请不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:id", authMiddleware, requirePermission(Permissions.USER_MANAGE), reviewApplication);

export default router;
