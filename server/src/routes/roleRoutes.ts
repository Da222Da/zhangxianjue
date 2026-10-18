import { Router } from "express";
import { createRole, deleteRole, listRoles, setRolePermissions, updateRole } from "../controllers/roleController.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
import { requirePermission } from "../middlewares/permissionMiddleware.ts";
import { Permissions } from "../utils/constants/permissions.ts";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Role
 *   description: 角色与权限分配接口。查询 / 增删改需 role:manage，重设权限需 permission:manage
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RoleItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: 管理员
 *         code:
 *           type: string
 *           description: 角色编码；系统内置 admin / user，自定义角色由服务端生成
 *           example: admin
 *         description:
 *           type: string
 *           nullable: true
 *           example: 拥有后台全部权限的内置角色
 *         is_system:
 *           type: boolean
 *           description: 系统内置角色不可删除
 *           example: true
 *         user_count:
 *           type: integer
 *           description: 该角色下的用户数
 *           example: 1
 *         permission_ids:
 *           type: array
 *           items:
 *             type: integer
 *           example: [1, 2, 3]
 *         permission_codes:
 *           type: array
 *           items:
 *             type: string
 *           example: ["admin:access", "user:manage"]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateRolePayload:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: 内容编辑
 *         description:
 *           type: string
 *           nullable: true
 *           example: 只能维护文章、笔记与分类
 *         permission_ids:
 *           type: array
 *           description: 不传表示不分配权限
 *           items:
 *             type: integer
 *           example: [5, 6, 7]
 *     UpdateRolePayload:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *     RolePermissionsPayload:
 *       type: object
 *       required:
 *         - permission_ids
 *       properties:
 *         permission_ids:
 *           type: array
 *           description: 整体替换语义；空数组表示清空权限
 *           items:
 *             type: integer
 *           example: [1, 2, 5]
 *     RoleEnvelope:
 *       type: object
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/RoleItem'
 *         message:
 *           type: string
 *           example: Role fetched successfully
 *     RoleListEnvelope:
 *       type: object
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RoleItem'
 *         message:
 *           type: string
 *           example: Roles fetched successfully
 */

/**
 * @swagger
 * /api/admin/role:
 *   get:
 *     tags: [Role]
 *     summary: 查询全部角色
 *     description: |
 *       需要登录，且具备 `role:manage` / `user:manage` / `permission:manage` 任一权限。
 *       返回角色、其权限与成员数。用户管理页与权限管理页也依赖这份角色列表作为参考数据。
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleListEnvelope'
 *       401:
 *         description: 未登录或令牌无效
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 无 role:manage 权限
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/",
  authMiddleware,
  requirePermission(Permissions.ROLE_MANAGE, Permissions.USER_MANAGE, Permissions.PERMISSION_MANAGE),
  listRoles,
);

/**
 * @swagger
 * /api/admin/role:
 *   post:
 *     tags: [Role]
 *     summary: 创建角色
 *     description: |
 *       需要登录且具备 `role:manage` 权限。
 *       ⚠️ 自定义角色的 code 由服务端生成，不开放填写。
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRolePayload'
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleEnvelope'
 *       400:
 *         description: 角色名重复或权限 id 不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", authMiddleware, requirePermission(Permissions.ROLE_MANAGE), createRole);

/**
 * @swagger
 * /api/admin/role/{id}:
 *   put:
 *     tags: [Role]
 *     summary: 更新角色名与描述
 *     description: 需要登录且具备 `role:manage` 权限。角色编码不可修改。
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
 *             $ref: '#/components/schemas/UpdateRolePayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleEnvelope'
 *       400:
 *         description: 角色名重复
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 角色不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:id", authMiddleware, requirePermission(Permissions.ROLE_MANAGE), updateRole);

/**
 * @swagger
 * /api/admin/role/{id}:
 *   delete:
 *     tags: [Role]
 *     summary: 删除角色
 *     description: |
 *       需要登录且具备 `role:manage` 权限。
 *       ⚠️ 系统内置角色不可删除；仍有用户引用时拒绝删除。
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
 *       400:
 *         description: 仍有用户引用该角色
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 系统内置角色不可删除
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 角色不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:id", authMiddleware, requirePermission(Permissions.ROLE_MANAGE), deleteRole);

/**
 * @swagger
 * /api/admin/role/{id}/permissions:
 *   put:
 *     tags: [Role]
 *     summary: 重设角色权限
 *     description: |
 *       需要登录且具备 `permission:manage` 权限。整体替换语义，空数组表示清空。
 *       ⚠️ 管理员角色必须保留 `admin:access`，否则后台会失去入口。
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
 *             $ref: '#/components/schemas/RolePermissionsPayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleEnvelope'
 *       400:
 *         description: 权限 id 不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 管理员角色缺少后台访问权限
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 角色不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:id/permissions", authMiddleware, requirePermission(Permissions.PERMISSION_MANAGE), setRolePermissions);

export default router;
