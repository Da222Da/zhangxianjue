// src/api/bookService.ts
import apiClient from "@/services/apiClient";
import type {
  ApiResponse,
  Book,
  BookDetail,
  BookPayload,
  ChapterDetail,
  ChapterPayload,
  Volume,
  VolumePayload,
} from "@/types/api";

/**
 * 书库管理接口层
 *
 * 只负责请求与数据转换，不持有状态、不感知组件。
 * 封面 / 正文插图复用 `${articleService.uploadImage}` 指向的上传接口。
 */
type BookListParams = {
  keyword?: string;
};

const bookService = {
  /** 后台书籍列表（含章节数） */
  getBooks(params?: BookListParams): Promise<ApiResponse<Book[]>> {
    return apiClient.get<Book[]>("/admin/book", { params });
  },

  /** 书籍详情（含章节元数据列表，不含正文） */
  getBookDetail(id: number): Promise<ApiResponse<BookDetail>> {
    return apiClient.get<BookDetail>(`/admin/book/${id}`);
  },

  /** 创建书籍 */
  createBook(data: BookPayload): Promise<BookDetail> {
    return apiClient.post<BookDetail>("/admin/book", data);
  },

  /** 更新书籍元数据 */
  updateBook(id: number, data: BookPayload): Promise<BookDetail> {
    return apiClient.put<BookDetail>(`/admin/book/${id}`, data);
  },

  /** 删除书籍（章节级联删除） */
  deleteBook(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/book/${id}`);
  },

  /** 新增分卷 */
  createVolume(bookId: number, data: VolumePayload): Promise<Volume> {
    return apiClient.post<Volume>(`/admin/book/${bookId}/volume`, data);
  },

  /** 更新分卷 */
  updateVolume(bookId: number, volumeId: number, data: VolumePayload): Promise<Volume> {
    return apiClient.put<Volume>(`/admin/book/${bookId}/volume/${volumeId}`, data);
  },

  /** 删除分卷（该卷下的章节会一并删除） */
  deleteVolume(bookId: number, volumeId: number): Promise<void> {
    return apiClient.delete<void>(`/admin/book/${bookId}/volume/${volumeId}`);
  },

  /** 章节详情（含正文） */
  getChapterDetail(bookId: number, chapterId: number): Promise<ApiResponse<ChapterDetail>> {
    return apiClient.get<ChapterDetail>(`/admin/book/${bookId}/chapter/${chapterId}`);
  },

  /** 新增章节 */
  createChapter(bookId: number, data: ChapterPayload): Promise<ChapterDetail> {
    return apiClient.post<ChapterDetail>(`/admin/book/${bookId}/chapter`, data);
  },

  /** 更新章节 */
  updateChapter(bookId: number, chapterId: number, data: ChapterPayload): Promise<ChapterDetail> {
    return apiClient.put<ChapterDetail>(`/admin/book/${bookId}/chapter/${chapterId}`, data);
  },

  /** 删除章节 */
  deleteChapter(bookId: number, chapterId: number): Promise<void> {
    return apiClient.delete<void>(`/admin/book/${bookId}/chapter/${chapterId}`);
  },
};

export default bookService;
