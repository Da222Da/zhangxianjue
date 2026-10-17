// src/api/categoryService.ts
import http from "@/services/http";
import type { ApiResponse, CategoryTreeNode } from "@/types/api";

/**
 * 分类读接口
 *
 * 与文章 / 笔记一样，读接口挂在 `/admin/category` 前缀下（与管理端共用），
 * 但读操作是公开的，client 直接复用。client 只读，不涉及写接口。
 */
const categoryService = {
  /** 查询完整分类树 */
  getTree(): Promise<ApiResponse<CategoryTreeNode[]>> {
    return http.get<CategoryTreeNode[]>("/admin/category");
  },
};

export default categoryService;
