// src/services/apiConfig.ts

/**
 * 后端接口基地址
 *
 * ⚠️ 全局唯一来源：axiosInstance 与静态资源解析都从这里取，不要在别处重复写默认值。
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

/**
 * 接口 origin（剥掉 /api 前缀）
 *
 * 服务端的静态资源（如 `/uploads/xxx.png`）挂在 origin 下而非 `/api` 下，
 * 因此图片地址不能用 API_BASE_URL 直接拼。
 */
export const API_ORIGIN: string = new URL(API_BASE_URL, window.location.origin).origin;

/**
 * 把服务端返回的图片地址解析为可直接访问的 URL
 *
 * - `/uploads/xxx.png` 这类相对路径 → 拼上接口 origin
 * - `http(s)://` 或 `data:` 开头 → 原样返回（cover 允许直接存外链）
 * - 空值 → 返回空串，交由调用方决定占位展示
 */
export const resolveAssetUrl = (path: string | null | undefined): string => {
  if (!path) {
    return "";
  }
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) {
    return path;
  }
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
};
