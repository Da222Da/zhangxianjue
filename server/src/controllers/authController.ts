import type { Response, Request } from "express";
import { sendErrorResponse, sendSuccessResponse } from "../utils/response.ts";
import { HttpStatusCode } from "../utils/constants/HttpStatus.ts";
import { signToken, verifyToken } from "../utils/token.ts";
import type { AuthTokenPayload } from "../utils/token.ts";
import User from "../models/users.ts";
import bcrypt from "bcryptjs";

/**
 * 用户注册处理函数
 * @param {Request} req - 请求对象，包含用户注册信息
 * @param {Response} res - 响应对象，用于返回处理结果
 */
export const register = async (req: Request, res: Response) => {
  try {
    // 从请求体中解构出用户名、邮箱和密码
    const { username, email, password } = req.body;
    // 检查用户是否已存在
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return sendErrorResponse(res, HttpStatusCode.BAD_REQUEST, "用户已存在");
    }
    // 检查是否存在
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      return sendErrorResponse(res, HttpStatusCode.BAD_REQUEST, "该邮箱已注册");
    }
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    // 创建用户
    const user = await User.create({
      username,
      email,
      password: hashedPassword + "",
      role_id: 2,
      avatar: "",
    });
    return sendSuccessResponse(res, HttpStatusCode.CREATED, user, "用户注册成功");
  } catch (error) {
    console.error("注册错误:", error);
    return sendErrorResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, "服务器内部错误");
  }
};

// 用户登录处理函数
export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // 查找用户
    const user = await User.findOne({ where: { username } });

    if (!user?.username || !user?.password) {
      return sendErrorResponse(res, HttpStatusCode.BAD_REQUEST, "无效的用户名或密码");
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return sendErrorResponse(res, HttpStatusCode.BAD_REQUEST, "无效的用户名或密码");
    }

    // 生成 JWT 与 Refresh Token
    const token = signToken(user, "access");
    const refreshToken = signToken(user, "refresh");

    return sendSuccessResponse(res, HttpStatusCode.OK, { token, refreshToken }, "登录成功");
  } catch (error) {
    console.error("登录错误:", error);
    return sendErrorResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, "服务器内部错误");
  }
};

/**
 * 刷新访问令牌
 *
 * 只签发新的 accessToken，**不轮换 refreshToken**：服务端无状态存储，
 * 无法吊销已签发的令牌，轮换只会制造「旧令牌依然有效」的假象。
 * 需要真正可吊销时，应引入服务端令牌表（记录已签发的 refreshToken 并支持作废）。
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token || typeof token !== "string") {
      return sendErrorResponse(res, HttpStatusCode.BAD_REQUEST, "缺少 refreshToken");
    }

    let decoded: AuthTokenPayload;
    try {
      // 要求用途必须是 refresh，访问令牌不可用于换取新令牌
      decoded = verifyToken(token, "refresh");
    } catch {
      return sendErrorResponse(res, HttpStatusCode.UNAUTHORIZED, "refreshToken 无效或已过期");
    }

    // 重新读取用户：避免用户被删除或角色变更后，仍沿用旧令牌里的角色
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return sendErrorResponse(res, HttpStatusCode.UNAUTHORIZED, "用户不存在");
    }

    return sendSuccessResponse(res, HttpStatusCode.OK, { token: signToken(user, "access") }, "令牌刷新成功");
  } catch (error) {
    console.error("刷新令牌错误:", error);
    return sendErrorResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, "服务器内部错误");
  }
};

// 获取当前用户信息
export const getUserInfo = async (req: Request, res: Response) => {
  try {
    // 认证中间件已经将用户信息附加到 req.body.user,根据用户 id 获取用户信息
    const { id } = req.body.user;
    const user = await User.findByPk(id);
    if (!user) {
      return sendErrorResponse(res, HttpStatusCode.NOT_FOUND, "用户不存在");
    }

    // 使用解构赋值去除 password 字段
    const { password, ...userWithoutPassword } = user.toJSON();

    return sendSuccessResponse(res, HttpStatusCode.OK, userWithoutPassword, "获取用户信息成功");
  } catch (error) {
    return sendErrorResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, "服务器内部错误");
  }
};
