// src/api/bookCategoryService.ts
import apiClient from "@/services/apiClient";
import type { ApiResponse, BookCategoryItem, BookTaxonomyPayload } from "@/types/api";

/** 书籍分类管理接口层 */
const bookCategoryService = {
  /** 分类列表，按 sort 升序 */
  getCategories(): Promise<ApiResponse<BookCategoryItem[]>> {
    return apiClient.get<BookCategoryItem[]>("/admin/book/category");
  },

  /** 新增分类 */
  createCategory(data: BookTaxonomyPayload): Promise<BookCategoryItem> {
    return apiClient.post<BookCategoryItem>("/admin/book/category", data);
  },

  /** 更新分类 */
  updateCategory(id: number, data: BookTaxonomyPayload): Promise<BookCategoryItem> {
    return apiClient.put<BookCategoryItem>(`/admin/book/category/${id}`, data);
  },

  /** 删除分类；相关书籍会变为未分类 */
  deleteCategory(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/book/category/${id}`);
  },
};

export default bookCategoryService;
