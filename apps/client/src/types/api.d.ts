// src/types/api.d.ts

/** 服务端错误响应体，由 server 的 errorMiddleware 统一输出 */
export interface ApiErrorBody {
  status: false;
  statusCode: number;
  message: string;
  errorCode: number | null;
}

/**
 * 服务端成功响应体
 *
 * 全站统一以 `status: true` 标记成功；分页字段仅在列表接口返回，与 data 同级展开。
 */
export interface ApiResponse<T = unknown> {
  status: true;
  message: string;
  data: T;
  total?: number;
  currentPage?: number;
  pageSize?: number;
}

/** 分类树节点：children 递归嵌套 */
export interface CategoryTreeNode {
  id: number;
  name: string;
  /** 父分类 id；null 表示根分类 */
  parent_id: number | null;
  /** 同级排序号，升序 */
  sort: number;
  children: CategoryTreeNode[];
}

/**
 * 笔记列表项
 *
 * ⚠️ **不含 content** —— 服务端列表接口刻意排除了思维导图正文（动辄数 KB），
 * 因此这里单独声明而不复用 Note，让类型系统拦住「在列表里读 row.content」。
 * 正文只从详情接口取。
 */
export interface NoteListItem {
  id: number;
  title: string;
  /** 封面地址，可能为相对路径（如 /uploads/xxx.png），使用前需经 resolveAssetUrl 解析 */
  cover: string | null;
  description: string | null;
  /** 分类 id；null 表示未分类 */
  category_id: number | null;
  /** 分类名（服务端由关联查出，只读）；null 表示未分类 */
  category: string | null;
  /** 排序号，升序；0 表示未排版 */
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** 笔记详情（含思维导图正文） */
export interface Note extends NoteListItem {
  /** @zhangxianjue/markmap 直接消费的 Markdown 文本；空串表示尚未录入内容 */
  content: string;
}

/** 事件卡片上的一个自定义按钮 */
export interface TimelineButton {
  text: string;
  /** 站内路径或 http(s) 地址 */
  url: string;
}

/** 时间轴上的一个事件 */
export interface TimelineEvent {
  id: number;
  /** 所属年份，页面按年份分组 */
  year: number;
  title: string;
  description: string | null;
  /** 自定义按钮，顺序即展示顺序；没有按钮时为空数组 */
  buttons: TimelineButton[];
  /** 同一年内的排序号，升序 */
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** 文章 */
export interface Article {
  id: number;
  title: string;
  content: string;
  /** 封面地址，可能为相对路径（如 /uploads/xxx.png），使用前需经 resolveAssetUrl 解析 */
  cover: string | null;
  description: string | null;
  /** 分类 id；null 表示未分类 */
  category_id: number | null;
  /** 分类名（服务端由关联查出，只读）；null 表示未分类 */
  category: string | null;
  /** 关联笔记 id；null 表示未关联 */
  note_id: number | null;
  /** 关联笔记标题（服务端由关联查出，只读）；null 表示未关联 */
  note_title: string | null;
  /** 排序号，升序；0 表示未排版 */
  sort: number;
  createdAt: string;
  updatedAt: string;
}
