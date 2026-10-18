// src/api/userService.ts
import apiClient from "@/services/apiClient";
import type { ApiResponse, CreateUserPayload, ResetPasswordPayload, UpdateUserPayload, User, UserListParams } from "@/types/api";

/**
 * 用户管理接口层
 * 只负责请求与数据转换，不持有状态、不感知组件
 */
const userService = {
  /** 分页查询用户列表，返回带分页字段的完整响应体 */
  getUsers(params?: UserListParams): Promise<ApiResponse<User[]>> {
    return apiClient.get<User[]>("/admin/user", { params });
  },

  /** 查询用户详情 */
  getUserDetail(id: number): Promise<ApiResponse<User>> {
    return apiClient.get<User>(`/admin/user/${id}`);
  },

  /** 创建用户 */
  createUser(data: CreateUserPayload): Promise<User> {
    return apiClient.post<User>("/admin/user", data);
  },

  /** 更新用户元数据；未提交的字段保持原值 */
  updateUser(id: number, data: UpdateUserPayload): Promise<User> {
    return apiClient.put<User>(`/admin/user/${id}`, data);
  },

  /** 管理员重置密码（不校验旧密码） */
  resetPassword(id: number, data: ResetPasswordPayload): Promise<void> {
    return apiClient.put<void>(`/admin/user/${id}/password`, data);
  },

  /** 删除用户 */
  deleteUser(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/user/${id}`);
  },
};

export default userService;
