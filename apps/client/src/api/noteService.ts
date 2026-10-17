// src/api/noteService.ts
import http from "@/services/http";
import type { ApiResponse, Note, NoteListItem } from "@/types/api";

/**
 * 笔记列表查询参数
 *
 * ⚠️ 必须用 type 而非 interface：请求层的 `params` 收 `Record<string, unknown>`，
 * 只有类型别名才具备隐式索引签名、可直接赋值。
 */
type NoteListParams = {
  /** 关键词，命中标题、描述或正文 */
  keyword?: string;
  /** 按分类筛选，命中该分类及其全部子分类 */
  category_id?: number;
  /** 页码，从 1 开始 */
  page?: number;
  /** 每页条数，最大 100 */
  pageSize?: number;
};

/**
 * 笔记读接口
 *
 * 与文章一样，读接口挂在 `/admin/note` 前缀下（管理端的路径），
 * 但读操作本身是公开的，client 直接复用。client 只读，不涉及写接口。
 */
const noteService = {
  /**
   * 查询笔记列表
   *
   * ⚠️ 列表元素是 NoteListItem，**不含 content**（服务端刻意排除）。
   * 卡片页只用元数据字段，正文由详情页单独拉取。
   */
  getList(params?: NoteListParams): Promise<ApiResponse<NoteListItem[]>> {
    return http.get<NoteListItem[]>("/admin/note", params);
  },

  /** 查询笔记详情，含思维导图正文 */
  getDetail(id: number): Promise<ApiResponse<Note>> {
    return http.get<Note>(`/admin/note/${id}`);
  },
};

export default noteService;
