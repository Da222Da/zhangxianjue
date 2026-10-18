import { Router } from "express";
import { listPermissions } from "../controllers/permissionController.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
import { requirePermission } from "../middlewares/permissionMiddleware.ts";
import { Permissions } from "../utils/constants/permissions.ts";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Permission
 *   description: 权限点目录。权限点由代码与迁移定义，后台只负责把它们分配给角色
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PermissionItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         code:
 *           type: string
 *           description: 权限编码，后端按它校验
 *           example: admin:access
 *         name:
 *           type: string
 *           example: 后台访问
 *         group_name:
 *           type: string
 *           description: 分组名，后台按组渲染
 *           example: 系统
 *         description:
 *           type: string
 *           nullable: true
 *           example: 允许登录后台管理端
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     PermissionListEnvelope:
 *       type: object
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PermissionItem'
 *         message:
 *           type: string
 *           example: Permissions fetched successfully
 */

/**
 * @swagger
 * /api/admin/permission:
 *   get:
 *     tags: [Permission]
 *     summary: 查询全部权限点
 *     description: 需要登录，且具备 `role:manage` 或 `permission:manage` 任一权限
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PermissionListEnvelope'
 *       401:
 *         description: 未登录或令牌无效
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 无相关权限
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/",
  authMiddleware,
  requirePermission(Permissions.ROLE_MANAGE, Permissions.PERMISSION_MANAGE),
  listPermissions,
);

export default router;
