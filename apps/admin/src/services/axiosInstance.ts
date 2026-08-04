// src/services/axiosInstance.ts
import axios from "axios";
import type { AxiosInstance } from "axios";
// import axios, { AxiosInstance, AxiosError, AxiosResponse } from "axios";
// import { useAuthStore } from "@/store/auth";
// import router from "@/router";
// import { ElNotification } from "element-plus";

const axiosInstance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api",
  // baseURL: '/api',
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器
// axiosInstance.interceptors.request.use(
//   (config) => {
//     const authStore = useAuthStore();
//     const token = authStore.accessToken;
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => {
//     return Promise.reject(error);
//   }
// );

// 响应拦截器
// axiosInstance.interceptors.response.use(
//   (response: AxiosResponse) => {
//     return response.data;
//   },
//   async (error: AxiosError) => {
//     const authStore = useAuthStore();
//     const originalRequest = error.config as any;

//     // 如果响应状态码为 401，尝试刷新令牌
//     if (error.response && error.response.status === 401 && !originalRequest._retry) {
//       originalRequest._retry = true;
//       try {
//         await authStore.refreshToken(); // 调用刷新令牌的方法
//         originalRequest.headers["Authorization"] = `Bearer ${authStore.accessToken}`;
//         return axiosInstance(originalRequest);
//       } catch (err) {
//         authStore.logout();
//         router.push({ name: "Login" });
//         ElNotification({
//           title: "登录过期",
//           message: "请重新登录。",
//           type: "error",
//         });
//         return Promise.reject(err);
//       }
//     }
//     // 返回业务逻辑错误信息
//     if (error.response && error.response.data) {
//       return Promise.reject(error.response.data);
//     }

//     return Promise.reject(error);
//   },
// );

export default axiosInstance;
