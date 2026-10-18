// src/api/bookService.ts
import http from "@/services/http";
import type { ApiResponse, Book, BookDetail, ChapterDetail } from "@/types/api";

/**
 * 书库阅读接口层
 * 只负责请求与数据转换；列表公开，VIP 专属内容的访问由服务端按 is_free / library:view 校验
 */
const bookService = {
  /** 书籍列表（含章节数） */
  getBooks(): Promise<ApiResponse<Book[]>> {
    return http.get<Book[]>("/library/book");
  },

  /** 书籍详情（含章节列表，不含正文） */
  getBookDetail(id: number): Promise<ApiResponse<BookDetail>> {
    return http.get<BookDetail>(`/library/book/${id}`);
  },

  /** 章节正文 */
  getChapterDetail(bookId: number, chapterId: number): Promise<ApiResponse<ChapterDetail>> {
    return http.get<ChapterDetail>(`/library/book/${bookId}/chapter/${chapterId}`);
  },
};

export default bookService;
