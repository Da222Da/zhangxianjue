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

/** 登录 / 注册的 401 是业务错误（凭证错误），不应触发静默刷新 */
const AUTH_PATHS = ["/auth/login", "/auth/register"];

/** 正在进行中的刷新请求 */
let refreshPromise: Promise<string> | null = null;

/**
 * 用 refreshToken 换新的 accessToken
 *
 * ⚠️ 刻意用**裸 axios** 绕过本文件的拦截器：刷新失败（401）若再次触发刷新会形成递归。
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

/** 并发 401 共享同一次刷新 */
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
  const token = useAuthStore().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ========== 响应拦截器：静默刷新 + 统一错误形态 ==========
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<unknown>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    const config = error.config as RetriableConfig | undefined;
    const url = config?.url ?? "";
    const isRefreshCall = url.includes(REFRESH_PATH);
    const isAuthCall = AUTH_PATHS.some((path) => url.includes(path));

    // 访问令牌过期：先尝试静默刷新，成功后重放原请求
    if (status === 401 && config && !config._retry && !isRefreshCall && !isAuthCall) {
      config._retry = true;
      try {
        const token = await getFreshAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(config);
      } catch {
        // 刷新失败（refreshToken 也过期或缺失），继续走下面的会话清理
      }
    }

    // 登录态确实失效：只清理会话。
    // ⚠️ client 的页面是公开的，不能像 admin 那样强制跳登录页 ——
    //    用户浏览文章时令牌过期不应被打断。
    if (status === 401) {
      useAuthStore().clearSession();
    }

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
