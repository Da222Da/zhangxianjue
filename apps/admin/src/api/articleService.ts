// src/api/articleService.ts
import apiClient from "@/services/apiClient";
import type { ApiResponse, Article, ArticleContentPayload, ArticleMetaPayload, UploadedImage } from "@/types/api";

/**
 * 文章列表查询参数
 *
 * ⚠️ 必须用 type 而非 interface 声明：`apiClient` 的 `params` 收的是
 * `Record<string, unknown>`，只有类型别名才具备隐式索引签名、可直接赋值。
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

const articleService = {
  /** 查询文章列表，返回带分页字段的完整响应体 */
  getArticle(params?: ArticleListParams): Promise<ApiResponse<Article[]>> {
    return apiClient.get<Article[]>("/admin/article", { params });
  },

  /** 查询文章详情 */
  getArticleDetail(id: number): Promise<ApiResponse<Article>> {
    return apiClient.get<Article>(`/admin/article/${id}`);
  },

  /**
   * 更新文章元数据，**不触碰正文**
   *
   * cover / description / category_id / note_id / sort 不传则服务端保持原值
   */
  updateArticle(id: number, data: ArticleMetaPayload): Promise<Article> {
    return apiClient.put<Article>(`/admin/article/${id}`, data);
  },

  /** 更新文章正文，服务端会忽略请求体里的其它字段 */
  updateArticleContent(id: number, data: ArticleContentPayload): Promise<Article> {
    return apiClient.put<Article>(`/admin/article/${id}/content`, data);
  },

  /** 创建文章，只提交元数据；正文由服务端落库为空串 */
  createArticle(data: ArticleMetaPayload): Promise<Article> {
    return apiClient.post<Article>("/admin/article", data);
  },

  /** 删除文章，成功时服务端不返回 data */
  deleteArticle(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/article/${id}`);
  },

  /**
   * 上传单张图片（需登录），返回相对访问路径
   *
   * 无需手动设置 Content-Type：axios 检测到 FormData 会主动让出该头，
   * 由浏览器带上 multipart 的 boundary（见 axios/lib/helpers/resolveConfig.js）。
   */
  uploadImage(file: File): Promise<UploadedImage> {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post<UploadedImage>("/admin/upload", form);
  },
};

export default articleService;
