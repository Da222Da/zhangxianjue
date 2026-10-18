// src/store/auth.ts
import { defineStore } from "pinia";
import type { LoginResult, UserProfile } from "@/types/api";

interface AuthState {
  /** 当前登录用户，包含角色与权限 */
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
}

/**
 * 登录态状态层
 *
 * ⚠️ 只作状态容器，**不发请求**。登录 / 注册 / 退出等编排统一放在
 * `@/composables/useAuth`，避免 `axiosInstance → store → authService` 的循环依赖。
 */
export const useAuthStore = defineStore("client-auth", {
  state: (): AuthState => ({
    user: null,
    accessToken: null,
    refreshToken: null,
  }),

  getters: {
    isAuthenticated: (state): boolean => !!state.accessToken,
    displayName: (state): string => state.user?.username ?? "",
    /** 头像首字母，用于没有头像时的占位 */
    initial: (state): string => (state.user?.username ?? "").charAt(0).toUpperCase(),
    /** 当前账号的权限编码；user 尚未加载时为空数组 */
    permissions: (state): string[] => state.user?.permissions ?? [],
    /** 是否具备某个权限；VIP 权益判断与路由守卫共用 */
    hasPermission: (state) => {
      return (code: string): boolean => state.user?.permissions?.includes(code) ?? false;
    },
  },

  actions: {
    /** 写入登录接口返回的双令牌与用户信息 */
    setSession({ token, refreshToken, user }: LoginResult) {
      this.accessToken = token;
      this.refreshToken = refreshToken;
      this.user = user;
    },

    /** 仅更新访问令牌（供静默刷新回写；服务端不轮换 refreshToken） */
    setAccessToken(token: string) {
      this.accessToken = token;
    },

    setUser(user: UserProfile) {
      this.user = user;
    },

    /** 清空会话：退出登录、令牌失效时调用 */
    clearSession() {
      this.user = null;
      this.accessToken = null;
      this.refreshToken = null;
    },
  },

  // 持久化到 localStorage，刷新后保持登录态
  persist: true,
});
