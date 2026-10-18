// src/api/tagService.ts
import apiClient from "@/services/apiClient";
import type { ApiResponse, BookTagItem, BookTaxonomyPayload } from "@/types/api";

/** 书籍标签管理接口层 */
const tagService = {
  /** 标签列表，按 sort 升序 */
  getTags(): Promise<ApiResponse<BookTagItem[]>> {
    return apiClient.get<BookTagItem[]>("/admin/book/tag");
  },

  /** 新增标签 */
  createTag(data: BookTaxonomyPayload): Promise<BookTagItem> {
    return apiClient.post<BookTagItem>("/admin/book/tag", data);
  },

  /** 更新标签 */
  updateTag(id: number, data: BookTaxonomyPayload): Promise<BookTagItem> {
    return apiClient.put<BookTagItem>(`/admin/book/tag/${id}`, data);
  },

  /** 删除标签；书籍与标签的关联会一并删除 */
  deleteTag(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/book/tag/${id}`);
  },
};

export default tagService;
