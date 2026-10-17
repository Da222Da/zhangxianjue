// src/store/auth.ts
import { defineStore } from "pinia";
import type { LoginResponse, User } from "@/types/api";

interface AuthState {
  /** 当前登录用户，刷新后由 useAuth().loadUser() 补齐 */
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

/**
 * 登录态状态层
 *
 * ⚠️ 只作状态容器，**不发请求**。登录/退出等编排统一放在 `@/composables/useAuth`，
 * 以此避免 `axiosInstance → store → authService → apiClient → axiosInstance` 的循环依赖。
 */
export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    user: null,
    accessToken: null,
    refreshToken: null,
  }),

  getters: {
    /** 是否已登录，路由守卫与请求拦截器均以此为准 */
    isAuthenticated: (state): boolean => !!state.accessToken,
    displayName: (state): string => state.user?.username ?? "",
  },

  actions: {
    /** 写入登录接口返回的双令牌 */
    setSession({ token, refreshToken }: LoginResponse) {
      this.accessToken = token;
      this.refreshToken = refreshToken;
    },

    /**
     * 仅更新访问令牌
     * 供请求拦截器静默刷新后回写，refreshToken 保持不变（服务端不轮换）
     */
    setAccessToken(token: string) {
      this.accessToken = token;
    },

    /** 更新用户信息 */
    setUser(user: User) {
      this.user = user;
    },

    /** 清空会话：退出登录、令牌失效时调用 */
    clearSession() {
      this.user = null;
      this.accessToken = null;
      this.refreshToken = null;
    },
  },

  // 持久化到 localStorage，刷新页面后保持登录态
  persist: true,
});
