// src/types/api.d.ts
// 认证相关
export interface LoginResponse {
  token: string;
  refreshToken: string;
  [prop: string]: any;
}

/** 登录入参 */
export interface LoginParams {
  username: string;
  password: string;
}

/** 服务端错误响应体，由 errorMiddleware 统一输出 */
export interface ApiErrorBody {
  status: false;
  statusCode: number;
  message: string;
  errorCode: number | null;
}

/**
 * 服务端成功响应体
 *
 * 全站统一以 `status: true` 标记成功。分页字段仅在列表接口返回，
 * 与 data 同级展开（对齐 server 的 sendApiSuccessResponse）。
 */
export interface ApiResponse<T = unknown> {
  status: true;
  message: string;
  data: T;
  total?: number;
  currentPage?: number;
  pageSize?: number;
}

// 分类相关
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

/** 分类实体（创建 / 更新接口的返回） */
export interface Category extends Omit<CategoryTreeNode, "children"> {
  createdAt: string;
  updatedAt: string;
}

/** 创建 / 更新分类的入参 */
export interface CategoryPayload {
  name: string;
  /** 不传表示不设置；更新时不传保持原值，传 null 表示移到根级 */
  parent_id?: number | null;
  sort?: number;
}

// 文章相关
export interface Article {
  id: number;
  title: string;
  content: string;
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

/**
 * 创建 / 更新文章元数据的入参。⚠️ 不含 content，正文走 updateArticleContent 单独提交
 */
export interface ArticleMetaPayload {
  title: string;
  /** 不传表示不设置；更新时不传表示保持原值 */
  cover?: string | null;
  description?: string | null;
  /** 不传表示不设置；更新时不传保持原值，传 null 表示移到未分类 */
  category_id?: number | null;
  /** 不传表示不设置；更新时不传保持原值，传 null 表示解除关联 */
  note_id?: number | null;
  /** 不传表示不设置；更新时不传表示保持原值 */
  sort?: number;
}

/** 更新文章正文的入参 */
export interface ArticleContentPayload {
  /** 传空串表示清空正文 */
  content: string;
}

/**
 * 文章元数据弹窗内的共享草稿（表单模型）
 *
 * 不是接口类型：id 允许为空串以表示「尚未创建」，其余字段始终有值，
 * 这样弹窗里不必到处判空。不含 content —— 正文由独立的内容弹窗管理。
 */
export interface ArticleDraft {
  id: number | string;
  title: string;
  cover: string | null;
  description: string | null;
  category_id: number | null;
  note_id: number | null;
  sort: number;
}

// 笔记相关
/**
 * 笔记列表项
 *
 * ⚠️ **不含 content** —— 服务端列表接口刻意排除了正文（思维导图动辄数 KB），
 * 因此这里不复用 Note，让类型系统直接拦住「在列表里读 row.content」这种写法。
 * 需要正文请走 getNoteDetail 取回 Note。
 */
export interface NoteListItem {
  id: number;
  title: string;
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

/** 创建 / 更新笔记元数据的入参。⚠️ 不含 content，正文走 updateNoteContent 单独提交 */
export interface NoteMetaPayload {
  title: string;
  /** 不传表示不设置；更新时不传表示保持原值 */
  cover?: string | null;
  description?: string | null;
  /** 不传表示不设置；更新时不传保持原值，传 null 表示移到未分类 */
  category_id?: number | null;
  /** 不传表示不设置；更新时不传表示保持原值 */
  sort?: number;
}

/** 更新笔记正文的入参 */
export interface NoteContentPayload {
  /** 传空串表示清空正文 */
  content: string;
}

/**
 * 笔记元数据弹窗内的共享草稿（表单模型）
 *
 * 不是接口类型：id 允许为空串以表示「尚未创建」，其余字段始终有值，
 * 这样弹窗里不必到处判空。不含 content —— 正文由独立的内容弹窗管理。
 */
export interface NoteDraft {
  id: number | string;
  title: string;
  cover: string | null;
  description: string | null;
  category_id: number | null;
  sort: number;
}

// 时间轴相关
/** 事件卡片上的一个自定义按钮 */
export interface TimelineButton {
  text: string;
  /** 站内路径或 http(s) 地址 */
  url: string;
}

/** 时间轴上的一个事件 */
export interface TimelineEvent {
  id: number;
  /** 所属年份，时间轴按年份分组 */
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

/** 创建 / 更新事件的入参 */
export interface TimelineEventPayload {
  year: number;
  title: string;
  /** 不传表示不设置；更新时不传表示保持原值 */
  description?: string | null;
  /** 整体替换语义；不传表示保持原值，传空数组或 null 表示清空 */
  buttons?: TimelineButton[] | null;
  sort?: number;
}

/**
 * 时间轴事件弹窗内的共享草稿（表单模型）
 *
 * id 允许为空串以表示「尚未创建」，其余字段始终有值，弹窗里不必到处判空。
 */
export interface TimelineEventDraft {
  id: number | string;
  year: number;
  title: string;
  description: string | null;
  /** 表单里始终是数组，空数组表示没有按钮 */
  buttons: TimelineButton[];
  sort: number;
}

/** 图片上传接口的返回数据 */
export interface UploadedImage {
  /** 相对访问路径，使用前需经 resolveAssetUrl 解析 */
  url: string;
  filename: string;
  /** 文件字节数 */
  size: number;
  mimetype: string;
}

export interface RegisterResponse {
  message: string;
  [prop: string]: any;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
  [prop: string]: any;
}
// 首页统计数据
export interface DashboardStats {
  userCount: number;
  activeUserCount: string;
  permissionCount: number;
  [prop: string]: any;
}

// 分页返回数据类型
export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  [prop: string]: any;
}

// 用户相关
export interface User {
  id: number;
  username: string;
  email: string;
  role_id: number;
  avatar: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  [prop: string]: any;
}
// 角色相关
export interface Role {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  [prop: string]: any;
}
// 权限相关
export interface Permission {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  [prop: string]: any;
}
