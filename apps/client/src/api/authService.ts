// src/api/authService.ts
import http from "@/services/http";
import type {
  ApiResponse,
  ChangePasswordParams,
  DevLoginParams,
  ForgotPasswordParams,
  LoginParams,
  LoginResult,
  RegisterParams,
  UserProfile,
} from "@/types/api";

/**
 * 认证接口层
 * 只负责请求与数据转换，不持有状态、不感知组件
 */
const authService = {
  /** 手机号登录：返回双令牌与用户信息（含角色、权限） */
  login(params: LoginParams): Promise<ApiResponse<LoginResult>> {
    return http.post<LoginResult>("/auth/login", params);
  },

  /**
   * 本地开发自动登录
   *
   * 服务端仅在 DEVELOPMENT + `DEV_LOGIN_ENABLED=true` 时提供该路由，
   * 且只接受本机回环地址。入参可省略，此时服务端使用 `DEV_LOGIN_*`。
   * 生产构建不会调用。
   */
  devLogin(params?: DevLoginParams): Promise<ApiResponse<LoginResult>> {
    return http.post<LoginResult>("/auth/dev/login", params ?? {});
  },

  /** 注册：成功后直接返回双令牌（等同于登录） */
  register(params: RegisterParams): Promise<ApiResponse<LoginResult>> {
    return http.post<LoginResult>("/auth/register", params);
  },

  /** 忘记密码：手机号 + 图形验证码 + 新密码 */
  forgotPassword(params: ForgotPasswordParams): Promise<ApiResponse<void>> {
    return http.post<void>("/auth/password/forgot", params);
  },

  /** 已登录用户修改密码（校验旧密码） */
  changePassword(params: ChangePasswordParams): Promise<ApiResponse<void>> {
    return http.put<void>("/auth/password", params);
  },

  /** 获取当前登录用户信息，令牌由 axiosInstance 的请求拦截器注入 */
  getUserInfo(): Promise<ApiResponse<UserProfile>> {
    return http.get<UserProfile>("/auth/getUserInfo");
  },
};

export default authService;
