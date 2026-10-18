// src/services/http.ts
import axiosInstance from "./axiosInstance";
import { ApiError } from "./apiError";
import type { ApiResponse } from "@/types/api";

/**
 * 请求封装
 *
 * 令牌注入、401 静默刷新与错误形态统一在 axiosInstance 里处理；
 * 本层只负责「解包 / 兜底判定」，调用方拿到的永远是 ApiResponse。
 */
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

  /**
   * 发起 POST 请求
   * @throws {ApiError} 服务端返回错误时抛出，其 message 即服务端文案
   */
  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await axiosInstance.post<ApiResponse<T>>(url, data);
    const body = response.data;

    if (!body.status) {
      throw new ApiError(body.message || "请求失败", response.status);
    }

    return body;
  },

  /**
   * 发起 PUT 请求
   * @throws {ApiError} 服务端返回错误时抛出，其 message 即服务端文案
   */
  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await axiosInstance.put<ApiResponse<T>>(url, data);
    const body = response.data;

    if (!body.status) {
      throw new ApiError(body.message || "请求失败", response.status);
    }

    return body;
  },
};

export default http;
