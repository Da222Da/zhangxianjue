// src/services/apiClient.ts
import axiosInstance from "./axiosInstance";
import type { ApiResponse } from "@/types/api";

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
}

/**
 * 统一的请求客户端
 *
 * ⚠️ 返回值约定（与 server 的响应体契约一一对应，改动前必须同步两端）：
 * - `get` 返回**完整响应体**（含 status / 分页字段），由调用方自行取 `data`
 * - `post` / `put` / `delete` 返回**解包后的 data**
 */
const apiClient = {
  async get<T = unknown>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response = await axiosInstance.get<ApiResponse<T>>(url, {
      ...options,
      params: options?.params,
    });

    const res = response.data;

    if (!res.status) {
      return Promise.reject(new Error(res.message));
    }

    return res;
  },

  async post<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const response = await axiosInstance.post<ApiResponse<T>>(url, data, options);
    const res = response.data;

    if (!res.status) {
      return Promise.reject(new Error(res.message));
    }

    return res.data;
  },

  async put<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const response = await axiosInstance.put<ApiResponse<T>>(url, data, options);
    const res = response.data;

    if (!res.status) {
      return Promise.reject(new Error(res.message));
    }

    return res.data;
  },

  async delete<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
    const response = await axiosInstance.delete<ApiResponse<T>>(url, options);
    const res = response.data;

    if (!res.status) {
      return Promise.reject(new Error(res.message));
    }

    return res.data;
  },
};

export default apiClient;
