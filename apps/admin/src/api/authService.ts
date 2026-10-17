// src/api/authService.ts
import apiClient from "@/services/apiClient";
import type { ApiResponse, LoginParams, LoginResponse, User } from "@/types/api";

/**
 * 认证接口层
 * 只负责请求与数据转换，不持有状态、不感知组件
 */
const authService = {
  /** 登录，成功时返回 accessToken 与 refreshToken */
  login(params: LoginParams): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>("/auth/login", params);
  },

  /** 获取当前登录用户信息，令牌由 axiosInstance 的请求拦截器注入 */
  getUserInfo(): Promise<ApiResponse<User>> {
    return apiClient.get<User>("/auth/getUserInfo");
  },
};

export default authService;
