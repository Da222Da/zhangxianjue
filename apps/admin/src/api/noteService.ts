// src/api/noteService.ts
import apiClient from "@/services/apiClient";
import type {
  ApiResponse,
  Note,
  NoteContentPayload,
  NoteListItem,
  NoteMetaPayload,
  UploadedImage,
} from "@/types/api";

/**
 * 笔记列表查询参数
 *
 * ⚠️ 必须用 type 而非 interface 声明：`apiClient` 的 `params` 收的是
 * `Record<string, unknown>`，只有类型别名才具备隐式索引签名、可直接赋值。
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

const noteService = {
  /**
   * 查询笔记列表，返回带分页字段的完整响应体
   *
   * ⚠️ 列表元素是 NoteListItem，**不含 content**（服务端刻意排除）
   */
  getNote(params?: NoteListParams): Promise<ApiResponse<NoteListItem[]>> {
    return apiClient.get<NoteListItem[]>("/admin/note", { params });
  },

  /** 查询笔记详情，含思维导图正文 */
  getNoteDetail(id: number): Promise<ApiResponse<Note>> {
    return apiClient.get<Note>(`/admin/note/${id}`);
  },

  /**
   * 更新笔记元数据，**不触碰正文**
   *
   * cover / description / category / sort 不传则服务端保持原值
   */
  updateNote(id: number, data: NoteMetaPayload): Promise<Note> {
    return apiClient.put<Note>(`/admin/note/${id}`, data);
  },

  /** 更新笔记正文，服务端会忽略请求体里的其它字段 */
  updateNoteContent(id: number, data: NoteContentPayload): Promise<Note> {
    return apiClient.put<Note>(`/admin/note/${id}/content`, data);
  },

  /** 创建笔记，只提交元数据；正文由服务端落库为空串 */
  createNote(data: NoteMetaPayload): Promise<Note> {
    return apiClient.post<Note>("/admin/note", data);
  },

  /** 删除笔记，成功时服务端不返回 data */
  deleteNote(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/note/${id}`);
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

export default noteService;
