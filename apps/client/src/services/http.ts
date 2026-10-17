// src/services/http.ts
import axios from "axios";
import type { AxiosError, AxiosInstance } from "axios";
import { API_BASE_URL } from "./apiConfig";
import { ApiError, isApiErrorBody } from "./apiError";
import type { ApiResponse } from "@/types/api";

/**
 * 请求实例
 *
 * client 只做公开读取，无鉴权需求，因此不配置令牌注入；
 * 若将来出现需要登录的接口，参照 apps/admin 的 axiosInstance 补请求拦截器。
 */
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 响应拦截器：把服务端文案透出，供调用方直接取 error.message 展示
axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError<unknown>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;

    if (isApiErrorBody(body)) {
      return Promise.reject(new ApiError(body.message, body.statusCode, body.errorCode));
    }
    if (error instanceof Error) {
      return Promise.reject(error);
    }
    return Promise.reject(new ApiError("请求失败，请稍后重试", status));
  },
);

export const http = {
  /**
   * 发起 GET 请求
   * @throws {ApiError} 服务端返回错误时抛出，其 message 即服务端文案
   */
  async get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const response = await axiosInstance.get<ApiResponse<T>>(url, { params });
    const body = response.data;

    // 兜底：HTTP 200 但业务标记为失败的情况不应被静默忽略
    if (!body.status) {
      throw new ApiError(body.message || "请求失败", response.status);
    }

    return body;
  },
};

export default http;
