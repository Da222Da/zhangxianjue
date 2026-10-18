// src/api/authService.ts
import apiClient from "@/services/apiClient";
import type { ApiResponse, DevLoginParams, LoginParams, LoginResponse, User } from "@/types/api";

/**
 * 认证接口层
 * 只负责请求与数据转换，不持有状态、不感知组件
 */
const authService = {
  /** 后台登录，成功时返回 accessToken、refreshToken 与用户信息 */
  login(params: LoginParams): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>("/auth/admin/login", params);
  },

  /**
   * 本地开发自动登录（仅 DEVELOPMENT + server 的 DEV_LOGIN_ENABLED=true）
   *
   * 入参可省略：省略时使用 server/.env 的 DEV_LOGIN_*。请求会被限制在本机。
   */
  devLogin(params?: DevLoginParams): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>("/auth/dev/login", params ?? {});
  },

  /** 获取当前登录用户信息，令牌由 axiosInstance 的请求拦截器注入 */
  getUserInfo(): Promise<ApiResponse<User>> {
    return apiClient.get<User>("/auth/getUserInfo");
  },
};

export default authService;
