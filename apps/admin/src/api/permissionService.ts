// src/api/permissionService.ts
import apiClient from "@/services/apiClient";
import type { ApiResponse, Permission } from "@/types/api";

/**
 * 权限目录接口层
 * 权限点由服务端代码与迁移定义，这里只读
 */
const permissionService = {
  /** 查询全部权限点（按分组名、id 排序） */
  getPermissions(): Promise<ApiResponse<Permission[]>> {
    return apiClient.get<Permission[]>("/admin/permission");
  },
};

export default permissionService;
