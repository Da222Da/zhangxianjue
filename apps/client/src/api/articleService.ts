// src/api/articleService.ts
import http from "@/services/http";
import type { ApiResponse, Article } from "@/types/api";

/**
 * 文章列表查询参数
 *
 * ⚠️ 必须用 type 而非 interface：请求层的 `params` 收 `Record<string, unknown>`，
 * 只有类型别名才具备隐式索引签名、可直接赋值。
 */
type ArticleListParams = {
  /** 关键词，命中标题或正文 */
  keyword?: string;
  /** 按分类筛选，命中该分类及其全部子分类 */
  category_id?: number;
  /** 页码，从 1 开始 */
  page?: number;
  /** 每页条数，最大 100 */
  pageSize?: number;
};

/**
 * 文章读接口
 *
 * 后端目前的读接口挂在 `/admin/article` 前缀下（管理端的路径），
 * 但读操作本身是公开的，client 直接复用。
 */
const articleService = {
  /** 查询文章列表，返回带分页字段的完整响应体 */
  getList(params?: ArticleListParams): Promise<ApiResponse<Article[]>> {
    return http.get<Article[]>("/admin/article", params);
  },

  /** 查询文章详情 */
  getDetail(id: number): Promise<ApiResponse<Article>> {
    return http.get<Article>(`/admin/article/${id}`);
  },
};

export default articleService;
