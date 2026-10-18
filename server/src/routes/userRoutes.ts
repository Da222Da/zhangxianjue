import { Router } from "express";
import { createUser, deleteUser, getUser, listUsers, resetUserPassword, updateUser } from "../controllers/userController.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
import { requirePermission } from "../middlewares/permissionMiddleware.ts";
import { Permissions } from "../utils/constants/permissions.ts";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: User
 *   description: 用户管理接口。全部需要登录且具备 user:manage 权限
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       description: 用户公开信息（不含密码）
 *       properties:
 *         id:
 *           type: integer
 *           example: 2
 *         username:
 *           type: string
 *           example: zhangxianjue
 *         phone:
 *           type: string
 *           nullable: true
 *           description: 手机号；client 端登录标识，管理员历史账号可为 null
 *           example: "13800000001"
 *         avatar:
 *           type: string
 *           example: ""
 *         role_id:
 *           type: integer
 *           example: 1
 *         role_name:
 *           type: string
 *           description: 角色名（由关联查出）
 *           example: 管理员
 *         role_code:
 *           type: string
 *           description: 角色编码（由关联查出）
 *           example: admin
 *         membership_expires_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 会员到期时间；非会员为 null，到期后服务端自动降级为普通用户
 *         status:
 *           type: integer
 *           enum: [0, 1]
 *           description: 1 启用 / 0 禁用
 *           example: 1
 *         permissions:
 *           type: array
 *           description: 该角色拥有的权限编码
 *           items:
 *             type: string
 *           example: ["admin:access", "user:manage"]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateUserPayload:
 *       type: object
 *       required:
 *         - username
 *         - password
 *         - role_id
 *       properties:
 *         username:
 *           type: string
 *           example: newUser
 *         phone:
 *           type: string
 *           nullable: true
 *           description: 可选；建议填写，否则该账号无法在 client 用手机号登录
 *           example: "13800000009"
 *         password:
 *           type: string
 *           description: 6-72 个字符
 *           example: abc123456
 *         avatar:
 *           type: string
 *           example: ""
 *         role_id:
 *           type: integer
 *           minimum: 1
 *           example: 2
 *         membership_expires_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 仅会员角色有意义；不传默认当前时间 + 1 年，非会员忽略
 *         status:
 *           type: integer
 *           enum: [0, 1]
 *           description: 不传默认 1（启用）
 *           example: 1
 *     UpdateUserPayload:
 *       type: object
 *       description: 至少提交一个字段；未提交的字段保持原值
 *       properties:
 *         username:
 *           type: string
 *         phone:
 *           type: string
 *           nullable: true
 *           description: 传 null 或空串表示清空
 *         avatar:
 *           type: string
 *         role_id:
 *           type: integer
 *           minimum: 1
 *         membership_expires_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 仅会员角色有意义；不传时已是会员保持原值，新成为会员默认 1 年
 *         status:
 *           type: integer
 *           enum: [0, 1]
 *     ResetPasswordPayload:
 *       type: object
 *       required:
 *         - password
 *       properties:
 *         password:
 *           type: string
 *           description: 6-72 个字符
 *           example: abc123456
 *     UserEnvelope:
 *       type: object
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/UserProfile'
 *         message:
 *           type: string
 *           example: User fetched successfully
 *     UserListEnvelope:
 *       type: object
 *       properties:
 *         status:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UserProfile'
 *         total:
 *           type: integer
 *           example: 12
 *         currentPage:
 *           type: integer
 *           example: 1
 *         pageSize:
 *           type: integer
 *           example: 10
 *         message:
 *           type: string
 *           example: Users fetched successfully
 */

/**
 * @swagger
 * /api/admin/user:
 *   get:
 *     tags: [User]
 *     summary: 分页查询用户列表
 *     description: 需要登录且具备 `user:manage` 权限。关键词命中用户名或手机号。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 模糊搜索用户名 / 手机号
 *       - in: query
 *         name: role_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *           enum: [0, 1]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserListEnvelope'
 *       401:
 *         description: 未登录或令牌无效
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 无 user:manage 权限
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", authMiddleware, requirePermission(Permissions.USER_MANAGE), listUsers);

/**
 * @swagger
 * /api/admin/user/{id}:
 *   get:
 *     tags: [User]
 *     summary: 查询用户详情
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
 *               $ref: '#/components/schemas/UserEnvelope'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:id", authMiddleware, requirePermission(Permissions.USER_MANAGE), getUser);

/**
 * @swagger
 * /api/admin/user:
 *   post:
 *     tags: [User]
 *     summary: 创建用户
 *     description: 需要登录且具备 `user:manage` 权限。用户名与手机号不可重复。会员角色默认有效期 1 年。
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserPayload'
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserEnvelope'
 *       400:
 *         description: 参数不合法、用户名 / 手机号重复或角色不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", authMiddleware, requirePermission(Permissions.USER_MANAGE), createUser);

/**
 * @swagger
 * /api/admin/user/{id}:
 *   put:
 *     tags: [User]
 *     summary: 更新用户元数据
 *     description: |
 *       需要登录且具备 `user:manage` 权限。至少提交一个字段，未提交的保持原值。
 *       ⚠️ 不能禁用自己、不能修改自己的角色；最后一名启用状态的管理员不能被禁用或降级。
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
 *             $ref: '#/components/schemas/UpdateUserPayload'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserEnvelope'
 *       400:
 *         description: 参数不合法、用户名 / 手机号重复或角色不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 违反自我保护或最后一名管理员约束
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:id", authMiddleware, requirePermission(Permissions.USER_MANAGE), updateUser);

/**
 * @swagger
 * /api/admin/user/{id}/password:
 *   put:
 *     tags: [User]
 *     summary: 重置用户密码
 *     description: 需要登录且具备 `user:manage` 权限。不校验旧密码。
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
 *             $ref: '#/components/schemas/ResetPasswordPayload'
 *     responses:
 *       200:
 *         description: 重置成功，响应体不含 data
 *       400:
 *         description: 密码长度不合法
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/:id/password", authMiddleware, requirePermission(Permissions.USER_MANAGE), resetUserPassword);

/**
 * @swagger
 * /api/admin/user/{id}:
 *   delete:
 *     tags: [User]
 *     summary: 删除用户
 *     description: |
 *       需要登录且具备 `user:manage` 权限。
 *       ⚠️ 不能删除自己；最后一名启用状态的管理员不能被删除。
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
 *       403:
 *         description: 违反自我保护或最后一名管理员约束
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:id", authMiddleware, requirePermission(Permissions.USER_MANAGE), deleteUser);

export default router;
