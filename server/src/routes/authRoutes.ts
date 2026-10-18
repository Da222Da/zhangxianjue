import express from "express";
import {
  adminLogin,
  changePassword,
  devLogin,
  forgotPassword,
  getCaptcha,
  getUserInfo,
  login,
  refreshToken,
  register,
} from "../controllers/authController.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";
import { DEV_LOGIN_ENABLED, NODE_ENV } from "../config/env.ts";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: 注册、登录、图形验证码、密码管理与令牌刷新
 */

/**
 * @swagger
 * /api/auth/captcha:
 *   get:
 *     summary: 获取图形验证码
 *     tags: [Auth]
 *     description: |
 *       返回一个一次性图形验证码。`image` 为 SVG data URI，可直接放进 `<img src>`。
 *       登录（手机号方式）、注册、忘记密码都必须携带 `captchaId` 与用户输入的 `captchaCode`。
 *       ⚠️ 验证码一次性：无论校验成功还是失败，同一个 captchaId 都会失效。
 *     responses:
 *       200:
 *         description: 生成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     captchaId:
 *                       type: string
 *                       example: 7e6d2c3a-...
 *                     image:
 *                       type: string
 *                       description: data:image/svg+xml;base64,...
 *                     expiresIn:
 *                       type: integer
 *                       description: 有效期（秒）
 *                       example: 300
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/captcha", getCaptcha);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 用户注册（手机号）
 *     tags: [Auth]
 *     description: |
 *       注册成功后自动分配内置的「普通用户」角色。
 *       用户名 2-32 位（中英文 / 数字 / 下划线 / 连字符），手机号为 11 位大陆号码，
 *       密码 6-72 个字符。必须携带图形验证码。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - phone
 *               - password
 *               - captchaId
 *               - captchaCode
 *             properties:
 *               username:
 *                 type: string
 *                 example: 新用户
 *               phone:
 *                 type: string
 *                 example: "13800000000"
 *               password:
 *                 type: string
 *                 description: 6-72 个字符
 *                 example: abc123456
 *               captchaId:
 *                 type: string
 *               captchaCode:
 *                 type: string
 *                 example: A3K9
 *     responses:
 *       201:
 *         description: 注册成功，同时签发双令牌（等同于登录）
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/UserProfile'
 *                 message:
 *                   type: string
 *                   example: 用户注册成功
 *       400:
 *         description: 参数不合法、验证码错误、用户名 / 手机号已存在
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
router.post("/register", register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: client 用户登录
 *     description: |
 *       支持两种登录标识（`phone` / `username` 二选一）：
 *       - **手机号**：必须携带 `captchaId` + `captchaCode`；
 *       - **用户名**：若带了 `captchaId` / `captchaCode` 也会校验（client 会带）。
 *
 *       ⚠️ admin 后台请使用 `POST /api/auth/admin/login`。
 *       成功后返回 accessToken、refreshToken 与用户信息（含角色、权限）。
 *       账号被禁用时返回 403。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *                 description: 手机号登录时必填；与 username 二选一
 *                 example: "13800000000"
 *               username:
 *                 type: string
 *                 description: 用户名登录时必填；与 phone 二选一
 *                 example: zhangxianjue
 *               password:
 *                 type: string
 *                 example: abc123456
 *               captchaId:
 *                 type: string
 *                 description: 手机号登录必填；用户名登录传了才会校验（client 会传）
 *               captchaCode:
 *                 type: string
 *                 description: 同上
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/UserProfile'
 *                 message:
 *                   type: string
 *                   example: 登录成功
 *       401:
 *         description: 手机号 / 用户名或密码错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 账号已被禁用
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/admin/login:
 *   post:
 *     tags: [Auth]
 *     summary: 后台管理端登录
 *     description: |
 *       手机号或用户名 + 密码，**不要求图形验证码**。
 *       登录成功后校验账号角色是否具备 `admin:access`；没有后台权限返回 403。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *                 description: 手机号登录时必填；与 username 二选一
 *                 example: "15826653490"
 *               username:
 *                 type: string
 *                 description: 用户名登录时必填；与 phone 二选一
 *                 example: zhangxianjue
 *               password:
 *                 type: string
 *                 example: abc123456
 *     responses:
 *       200:
 *         description: 登录成功
 *       401:
 *         description: 手机号 / 用户名或密码错误
 *       403:
 *         description: 账号被禁用或没有后台访问权限
 */
router.post("/admin/login", adminLogin);

/**
 * @swagger
 * /api/auth/dev/login:
 *   post:
 *     tags: [Auth]
 *     summary: 本地开发自动登录（仅开发环境）
 *     description: |
 *       ⚠️ 默认不挂载。只有 `NODE_ENV !== production` 且 `DEV_LOGIN_ENABLED=true`
 *       时才存在，并且只接受回环地址的请求。跳过图形验证码，账号密码仍完整校验。
 *       供 client 的 `VITE_DEV_AUTO_LOGIN_*` 使用，不要用于生产。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 开发自动登录成功
 *       403:
 *         description: 非本机请求或账号被禁用
 *       404:
 *         description: 未开启开发自动登录
 */
if (NODE_ENV !== "production" && DEV_LOGIN_ENABLED) {
  router.post("/dev/login", devLogin);
}

/**
 * @swagger
 * /api/auth/password/forgot:
 *   post:
 *     tags: [Auth]
 *     summary: 忘记密码（手机号 + 图形验证码）
 *     description: |
 *       按手机号重置密码。⚠️ 当前方案只校验图形验证码（项目未接短信服务商），
 *       生产环境应追加短信验证码后再重置。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *               - captchaId
 *               - captchaCode
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "13800000000"
 *               password:
 *                 type: string
 *                 description: 新密码，6-72 个字符
 *                 example: newpass123
 *               captchaId:
 *                 type: string
 *               captchaCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: 重置成功
 *       400:
 *         description: 参数不合法或验证码错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 该手机号未注册
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/password/forgot", forgotPassword);

/**
 * @swagger
 * /api/auth/password:
 *   put:
 *     tags: [Auth]
 *     summary: 修改密码（需登录，校验旧密码）
 *     description: |
 *       登录后修改自己的密码。⚠️ 令牌是无状态的，改密码不会让已签发的 accessToken 失效。
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 description: 6-72 个字符，且不能与旧密码相同
 *     responses:
 *       200:
 *         description: 修改成功
 *       400:
 *         description: 旧密码错误或新密码不合法
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
 */
router.put("/password", authMiddleware, changePassword);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: 刷新访问令牌
 *     description: |
 *       用登录时返回的 refreshToken 换取新的 accessToken。
 *       不轮换 refreshToken：服务端无状态存储，无法吊销已签发的令牌。
 *       ⚠️ 必须传 refreshToken：访问令牌不能用于刷新，误传会返回 401。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: 刷新成功
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
 *                   example: 令牌刷新成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *       400:
 *         description: 未提供 refreshToken
 *       401:
 *         description: refreshToken 无效或已过期，或误传了访问令牌
 *       403:
 *         description: 账号已被禁用
 *       500:
 *         description: 服务器内部错误
 */
router.post("/refresh", refreshToken);

/**
 * @swagger
 * /api/auth/getUserInfo:
 *   get:
 *     summary: 获取当前登录用户信息
 *     tags: [Auth]
 *     description: 返回用户公开信息（含手机号）、角色与权限编码
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功获取用户信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *                 message:
 *                   type: string
 *                   example: 获取用户信息成功
 *       401:
 *         description: 未登录或令牌无效
 *       404:
 *         description: 用户不存在
 *       500:
 *         description: 服务器内部错误
 */
router.get("/getUserInfo", authMiddleware, getUserInfo);

export default router;
