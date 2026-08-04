// src/types/api.d.ts
// 认证相关
export interface LoginResponse {
  token: string;
  refreshToken: string;
  [prop: string]: any;
}

export interface RegisterResponse {
  message: string;
  [prop: string]: any;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
  [prop: string]: any;
}
// 首页统计数据
export interface DashboardStats {
  userCount: number;
  activeUserCount: string;
  permissionCount: number;
  [prop: string]: any;
}

// 分页返回数据类型
export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  [prop: string]: any;
}

// 用户相关
export interface User {
  id: number;
  username: string;
  email: string;
  role_id: number;
  avatar: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  [prop: string]: any;
}
// 角色相关
export interface Role {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  [prop: string]: any;
}
// 权限相关
export interface Permission {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  [prop: string]: any;
}
