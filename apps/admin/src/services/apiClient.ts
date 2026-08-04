import axiosInstance from "./axiosInstance";

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: Record<string, any>;
  [key: string]: any;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
  config: any;
  request?: any;
}

const apiClient = {
  async get<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response = await axiosInstance.get<T>(url, {
      ...options,
      params: options?.params,
    });
    return response;
  },

  async post<T>(url: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response = await axiosInstance.post<T>(url, data, options);
    return response;
  },

  async put<T>(url: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response = await axiosInstance.put<T>(url, data, options);
    return response;
  },

  async delete<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response = await axiosInstance.delete<T>(url, options);
    return response;
  },

  async patch<T>(url: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response = await axiosInstance.patch<T>(url, data, options);
    return response;
  },
};

export default apiClient;
