// src/api/roleService.ts
import apiClient from "@/services/apiClient";
import type { ApiResponse, CreateRolePayload, Role, RolePermissionsPayload, UpdateRolePayload } from "@/types/api";

/**
 * 角色管理接口层
 * 只负责请求与数据转换，不持有状态、不感知组件
 */
const roleService = {
  /** 查询全部角色（含权限与成员数） */
  getRoles(): Promise<ApiResponse<Role[]>> {
    return apiClient.get<Role[]>("/admin/role");
  },

  /** 创建自定义角色 */
  createRole(data: CreateRolePayload): Promise<Role> {
    return apiClient.post<Role>("/admin/role", data);
  },

  /** 更新角色名与描述 */
  updateRole(id: number, data: UpdateRolePayload): Promise<Role> {
    return apiClient.put<Role>(`/admin/role/${id}`, data);
  },

  /** 删除角色（内置角色与仍有成员的角色会被服务端拒绝） */
  deleteRole(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/role/${id}`);
  },

  /** 重设角色权限（整体替换语义） */
  setRolePermissions(id: number, data: RolePermissionsPayload): Promise<Role> {
    return apiClient.put<Role>(`/admin/role/${id}/permissions`, data);
  },
};

export default roleService;
