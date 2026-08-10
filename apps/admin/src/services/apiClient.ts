import axiosInstance from "./axiosInstance";

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: Record<string, any>;
  [key: string]: any;
}

interface ApiResponse<T = any> {
  status: boolean;
  message: string;
  data: T;
}

const apiClient = {
  async get<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response: any = await axiosInstance.get<T>(url, {
      ...options,
      params: options?.params,
    });

    const res = response.data;

    if (!res.status) {
      return Promise.reject(new Error(res.message));
    }

    return res;
  },

  async post<T>(url: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response: any = await axiosInstance.post<T>(url, data, options);
    const res = response.data;

    if (!res.status) {
      return Promise.reject(new Error(res.message));
    }

    return res.data;
  },

  async put<T>(url: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response: any = await axiosInstance.put<T>(url, data, options);
    const res = response.data;

    if (!res.status) {
      return Promise.reject(new Error(res.message));
    }

    return res.data;
  },

  async delete<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response: any = await axiosInstance.delete<T>(url, options);
    const res = response.data;

    if (!res.status) {
      return Promise.reject(new Error(res.message));
    }

    return res.data;
  },
};

export default apiClient;
