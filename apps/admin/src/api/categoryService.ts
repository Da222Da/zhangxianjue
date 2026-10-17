// src/api/categoryService.ts
import apiClient from "@/services/apiClient";
import type { ApiResponse, Category, CategoryPayload, CategoryTreeNode } from "@/types/api";

/**
 * 分类接口
 *
 * 读接口公开；写接口需管理员令牌（由 axiosInstance 自动注入）。
 */
const categoryService = {
  /** 查询完整分类树 */
  getTree(): Promise<ApiResponse<CategoryTreeNode[]>> {
    return apiClient.get<CategoryTreeNode[]>("/admin/category");
  },

  /** 创建分类；parent_id 不传则为根分类 */
  createCategory(data: CategoryPayload): Promise<Category> {
    return apiClient.post<Category>("/admin/category", data);
  },

  /** 更新分类；parent_id 传 null 表示移到根级 */
  updateCategory(id: number, data: CategoryPayload): Promise<Category> {
    return apiClient.put<Category>(`/admin/category/${id}`, data);
  },

  /** 删除分类；有子分类或仍被引用时服务端会返回 400 */
  deleteCategory(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/category/${id}`);
  },
};

export default categoryService;
