// src/services/authService.ts
import bcrypt from "bcryptjs";
import { Users } from "../models/index.ts";
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from "../utils/errors.ts";
import { Permissions } from "../utils/constants/permissions.ts";
import { signToken, verifyToken } from "../utils/token.ts";
import {
  assertPasswordLength,
  createUser,
  downgradeExpiredMembership,
  getDefaultRole,
  getUserProfile,
  hashPassword,
  UserStatus,
} from "./userService.ts";
import type { UserProfile } from "./userService.ts";

/** 注册入参（client 端使用手机号作为唯一标识） */
export interface RegisterPayload {
  username: string;
  phone: string;
  password: string;
}

/**
 * 登录入参
 *
 * - `phone`：client 端手机号登录（验证码由 controller 校验）
 * - `username`：admin 后台用户名登录
 */
export interface LoginParams {
  username?: string;
  phone?: string;
  password: string;
}

/** bcrypt.compare 的占位哈希：用户不存在时也执行一次比较，避免通过耗时枚举账号 */
const DUMMY_PASSWORD_HASH = "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";

/** 登录成功返回：双令牌 + 完整用户信息（含角色与权限） */
export interface LoginResult {
  token: string;
  refreshToken: string;
  user: UserProfile;
}

/**
 * 注册
 *
 * 角色固定为内置的 user 角色（而不是写死 role_id = 2）：
 * 角色表可以调整，按 code 查默认角色才不会在迁移后失效。
 *
 * ✅ 决策：注册成功后直接签发双令牌（与登录同一形态）。
 * 手机号登录必须带图形验证码，若注册后还要再登录一次，用户得重新过一张验证码；
 * 注册本身已经校验过验证码，直接建立会话更顺畅。
 *
 * @throws {BadRequestError} 用户名 / 手机号重复
 * @throws {NotFoundError} 默认角色缺失
 */
export const register = async (payload: RegisterPayload): Promise<LoginResult> => {
  assertPasswordLength(payload.password);
  const role = await getDefaultRole();

  const user = await createUser({
    username: payload.username,
    phone: payload.phone,
    password: payload.password,
    avatar: "",
    role_id: role.id,
    status: UserStatus.ENABLED,
  });

  return {
    token: signToken(user, "access"),
    refreshToken: signToken(user, "refresh"),
    user,
  };
};

/**
 * 校验账号标识（手机号 / 用户名）+ 密码 + 状态
 *
 * ⚠️ 用户不存在与密码错误返回同一句提示，避免账号枚举。
 * @throws {UnauthorizedError} 用户名 / 手机号或密码错误
 * @throws {ForbiddenError} 账号已被禁用
 */
const authenticate = async (params: LoginParams): Promise<Users> => {
  const byPhone = typeof params.phone === "string" && params.phone !== "";
  const user = await Users.findOne(byPhone ? { where: { phone: params.phone } } : { where: { username: params.username } });

  // 即使用户不存在也执行一次 compare，避免通过响应耗时区分「账号不存在」与「密码错误」
  const passwordValid = await bcrypt.compare(params.password, user?.password ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordValid) {
    throw new UnauthorizedError(byPhone ? "手机号或密码错误" : "无效的用户名或密码");
  }
  if (user.status !== UserStatus.ENABLED) {
    throw new ForbiddenError("账号已被禁用，请联系管理员");
  }

  // 会员到期后先降级，再签发带有最新角色 / 权限的会话
  await downgradeExpiredMembership(user);
  return user;
};

/** 为已认证用户签发双令牌，并附带完整资料 */
const issueSession = async (user: Users): Promise<LoginResult> => {
  const profile = await getUserProfile(user.id);
  return {
    token: signToken(user, "access"),
    refreshToken: signToken(user, "refresh"),
    user: profile,
  };
};

/**
 * client 登录（手机号 / 用户名 + 密码；验证码由 controller 决定是否校验）
 * @throws {UnauthorizedError} 账号或密码错误
 * @throws {ForbiddenError} 账号已被禁用
 */
export const login = async (params: LoginParams): Promise<LoginResult> => issueSession(await authenticate(params));

/**
 * 后台管理端登录
 *
 * ✅ 决策：后台账号同样允许用手机号或用户名登录，且不需要图形验证码；
 * 但登录成功后必须确认角色具备 `admin:access`，否则不签发可供后台使用的会话。
 *
 * @throws {UnauthorizedError} 账号或密码错误
 * @throws {ForbiddenError} 账号被禁用 / 没有后台访问权限
 */
export const adminLogin = async (params: LoginParams): Promise<LoginResult> => {
  const user = await authenticate(params);
  const profile = await getUserProfile(user.id);
  if (!profile.permissions.includes(Permissions.ADMIN_ACCESS)) {
    throw new ForbiddenError("该账号没有后台访问权限");
  }

  return {
    token: signToken(user, "access"),
    refreshToken: signToken(user, "refresh"),
    user: profile,
  };
};

/**
 * 已登录用户修改密码（校验旧密码）
 *
 * ⚠️ 令牌是无状态的：改密码不会让已签发的 accessToken 失效，
 * 需要强制下线时应引入 passwordChangedAt / 令牌版本号。
 * @throws {NotFoundError} 用户不存在
 * @throws {BadRequestError} 旧密码错误
 */
export const changePassword = async (userId: number, oldPassword: string, newPassword: string): Promise<void> => {
  const user = await Users.findByPk(userId);
  if (!user) {
    throw new NotFoundError("用户不存在");
  }

  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) {
    throw new BadRequestError("旧密码不正确");
  }

  await user.update({ password: await hashPassword(newPassword) });
};

/**
 * 忘记密码：按手机号重置
 *
 * ⚠️ 身份校验只靠图形验证码（需求确认的方案），生产环境应追加短信验证码。
 * @throws {NotFoundError} 手机号未注册
 */
export const resetPasswordByPhone = async (phone: string, newPassword: string): Promise<void> => {
  const user = await Users.findOne({ where: { phone } });
  if (!user) {
    throw new NotFoundError("该手机号未注册");
  }

  await user.update({ password: await hashPassword(newPassword) });
};

/**
 * 用 refreshToken 换新的 accessToken
 *
 * 不轮换 refreshToken：服务端无状态存储，无法吊销已签发的令牌，
 * 轮换只会制造「旧令牌依然有效」的假象。需要真正可吊销时，
 * 应引入服务端令牌表（记录已签发的 refreshToken 并支持作废）。
 *
 * @throws {UnauthorizedError} 令牌无效、过期或用途不符
 * @throws {ForbiddenError} 账号已被禁用
 */
export const refreshAccessToken = async (refreshTokenValue: string): Promise<string> => {
  const decoded = verifyToken(refreshTokenValue, "refresh");

  // 重新读取用户：避免用户被删除、角色变更或禁用后，仍沿用旧令牌里的信息
  const user = await Users.findByPk(decoded.id);
  if (!user) {
    throw new UnauthorizedError("用户不存在");
  }
  if (user.status !== UserStatus.ENABLED) {
    throw new ForbiddenError("账号已被禁用，请联系管理员");
  }

  return signToken(user, "access");
};

/**
 * 查询当前登录用户信息
 * @throws {NotFoundError} 用户不存在
 */
export const getCurrentUser = (userId: number): Promise<UserProfile> => getUserProfile(userId);
