// src/services/axiosInstance.ts
import axios from "axios";
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { ApiError, isApiErrorBody } from "./apiError";
import { API_BASE_URL } from "./apiConfig";
import { useAuthStore } from "@/store/auth";
import type { ApiResponse } from "@/types/api";

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

/** 标记已重放过一次的请求，避免刷新后仍 401 时无限循环 */
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/** 刷新接口路径：命中它的 401 不得再触发刷新，否则会递归 */
const REFRESH_PATH = "/auth/refresh";

/** 正在进行中的刷新请求 */
let refreshPromise: Promise<string> | null = null;

/**
 * 用 refreshToken 换新的 accessToken
 *
 * ⚠️ 这里刻意用**裸 axios** 而非本实例：刷新请求必须绕过本文件的拦截器，
 * 否则刷新失败（401）会再次触发刷新，形成递归。
 * 也正因如此，该请求没有走 `apiClient`/`api/authService` —— 它是传输层的内务。
 */
const requestNewAccessToken = async (): Promise<string> => {
  const authStore = useAuthStore();
  const { refreshToken } = authStore;
  if (!refreshToken) {
    throw new ApiError("缺少 refreshToken", 401);
  }

  const response = await axios.post<ApiResponse<{ token: string }>>(`${API_BASE_URL}${REFRESH_PATH}`, { refreshToken });
  const token = response.data?.data?.token;
  if (!token) {
    throw new ApiError("刷新令牌失败", 401);
  }

  authStore.setAccessToken(token);
  return token;
};

/**
 * 取新令牌，并对并发去重
 *
 * 页面同时发出多个请求时可能一起收到 401，若各自刷新会把令牌换乱，
 * 因此共享同一个进行中的 Promise。
 */
const getFreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = requestNewAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

// ========== 请求拦截器：注入登录令牌 ==========
axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // 在拦截器内部（而非模块顶层）调用，此时 Pinia 已完成安装
  const token = useAuthStore().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ========== 响应拦截器：静默刷新 + 统一错误形态 ==========
axiosInstance.interceptors.response.use(
  // 成功分支原样透传：解包由 apiClient 负责，此处不得改动结构
  (response) => response,
  async (error: AxiosError<unknown>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    const config = error.config as RetriableConfig | undefined;
    const isRefreshCall = config?.url?.includes(REFRESH_PATH) ?? false;

    // 访问令牌过期：先尝试静默刷新，成功后重放原请求
    if (status === 401 && config && !config._retry && !isRefreshCall) {
      config._retry = true;
      try {
        const token = await getFreshAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(config);
      } catch {
        // 刷新失败（refreshToken 也过期或缺失），继续走下面的登出流程
      }
    }

    // 登录态确实失效：清理会话并回到登录页
    if (status === 401) {
      useAuthStore().clearSession();

      // 动态导入 router：router 会静态引入布局与视图，进而回到本模块，
      // 静态导入将形成循环依赖，这里用动态导入切断
      const { default: router } = await import("@/router");
      const current = router.currentRoute.value;
      if (current.name !== "Login") {
        await router.replace({ name: "Login", query: { redirect: current.fullPath } });
      }
      return Promise.reject(new ApiError(isApiErrorBody(body) ? body.message : "登录已失效，请重新登录", status));
    }

    // 其余错误：透出服务端文案，供调用方直接取 error.message 展示
    if (isApiErrorBody(body)) {
      return Promise.reject(new ApiError(body.message, body.statusCode, body.errorCode));
    }
    if (error instanceof Error) {
      return Promise.reject(error);
    }
    return Promise.reject(new ApiError("请求失败，请稍后重试", status));
  },
);

export default axiosInstance;
