import express from "express";
import { register, login, getUserInfo, refreshToken } from "../controllers/authController.ts";
import { authMiddleware } from "../middlewares/authMiddleware.ts";

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 用户注册
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 default: "exampleUser"
 *               email:
 *                 type: string
 *                 default: "exampleUser@gmail.com"
 *               password:
 *                 type: string,
 *                 default: "123456abc"
 *     responses:
 *       201:
 *         description: 注册用户成功
 *       500:
 *         description: 注册用户失败
 */
router.post("/register", register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: 用户登录
 *     description: Authenticates a user and returns a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: The username of the user.
 *                 example: exampleUser
 *               password:
 *                 type: string
 *                 description: The password of the user.
 *                 example: 123456abc
 *     responses:
 *       200:
 *         description: Successfully logged in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: The JWT token for authentication.
 *                   example: eyJhbGciOiJIUzI1NiIsInR...
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: 刷新访问令牌
 *     description: |
 *       用登录时返回的 refreshToken 换取新的 accessToken。
 *       不轮换 refreshToken：服务端无状态存储，无法吊销已签发的令牌，
 *       轮换只会制造「旧令牌依然有效」的假象。refreshToken 到期后需重新登录。
 *
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
 *                 description: 登录接口返回的 refreshToken
 *                 example: eyJhbGciOiJIUzI1NiIsInR...
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
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: 令牌刷新成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: 新的 accessToken
 *       400:
 *         description: 未提供 refreshToken
 *       401:
 *         description: refreshToken 无效或已过期，或误传了访问令牌
 *       500:
 *         description: 服务器内部错误
 */
router.post("/refresh", refreshToken);

/**
 * @swagger
 * /api/auth/getUserInfo:
 *   get:
 *     summary: 获取用户信息
 *     tags: [Auth]
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
 *                 data:
 *                   type: object
 *                   description: The user information.
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.get("/getUserInfo", authMiddleware, getUserInfo);

export default router;
