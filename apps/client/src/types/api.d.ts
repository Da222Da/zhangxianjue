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

// 认证相关
/** 当前登录用户（服务端不返回密码） */
export interface UserProfile {
  id: number;
  username: string;
  /** 手机号（client 登录标识） */
  phone: string | null;
  avatar: string;
  role_id: number;
  /** 角色名（服务端由关联查出） */
  role_name: string;
  /** 角色编码（服务端由关联查出） */
  role_code: string;
  /** 会员到期时间；非会员为 null */
  membership_expires_at: string | null;
  /** 1 启用 / 0 禁用 */
  status: number;
  /** 该角色拥有的权限编码 */
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

/** 图形验证码 */
export interface CaptchaResult {
  captchaId: string;
  /** SVG data URI，可直接放进 <img src> */
  image: string;
  /** 有效期（秒） */
  expiresIn: number;
}

/**
 * 登录入参
 *
 * `phone` 与 `username` 二选一（client 页面按输入内容自动判断），
 * client 登录必须携带图形验证码。
 */
export interface LoginParams {
  /** 手机号（与 username 二选一） */
  phone?: string;
  /** 用户名（与 phone 二选一） */
  username?: string;
  password: string;
  captchaId: string;
  captchaCode: string;
}

/**
 * 本地开发自动登录入参
 *
 * 均可省略：省略账号密码时服务端会使用 server/.env 的 DEV_LOGIN_*。
 */
export interface DevLoginParams {
  phone?: string;
  username?: string;
  password?: string;
}

/** 登录 / 注册成功响应数据 */
export interface LoginResult {
  token: string;
  refreshToken: string;
  user: UserProfile;
}

/** 注册入参（手机号 + 图形验证码） */
export interface RegisterParams {
  username: string;
  phone: string;
  password: string;
  captchaId: string;
  captchaCode: string;
}

/** 忘记密码入参（手机号 + 图形验证码 + 新密码） */
export interface ForgotPasswordParams {
  phone: string;
  password: string;
  captchaId: string;
  captchaCode: string;
}

/** 已登录用户修改密码入参 */
export interface ChangePasswordParams {
  oldPassword: string;
  newPassword: string;
}

// 书库相关
/** 书籍标签的简要信息 */
export interface BookTagRef {
  id: number;
  name: string;
}

/** 书籍列表项 */
export interface Book {
  id: number;
  title: string;
  cover: string | null;
  description: string | null;
  /** 分类 id；null 表示未分类 */
  category_id: number | null;
  /** 分类名（服务端由关联查出，只读）；null 表示未分类 */
  category: string | null;
  /** 标签列表 */
  tags: BookTagRef[];
  /** 是否限免；false 表示 VIP 专属，游客与普通用户无法打开 */
  is_free: boolean;
  /** 是否对未登录游客可见；false 时游客在列表与详情中都看不到 */
  guest_visible: boolean;
  sort: number;
  /** 分卷数 */
  volume_count: number;
  /** 章节数 */
  chapter_count: number;
  createdAt: string;
  updatedAt: string;
}

/** 分卷元数据 */
export interface Volume {
  id: number;
  book_id: number;
  title: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** 分卷及其章节（章节不含正文） */
export interface VolumeWithChapters extends Volume {
  chapters: ChapterListItem[];
}

/** 章节元数据（不含正文） */
export interface ChapterListItem {
  id: number;
  book_id: number;
  volume_id: number;
  title: string;
  summary: string | null;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** 书籍详情（含分卷与章节列表） */
export interface BookDetail extends Book {
  volumes: VolumeWithChapters[];
}

/** 章节详情（含 Markdown 正文） */
export interface ChapterDetail extends ChapterListItem {
  content: string;
}

// 会员申请相关
export type MembershipViewStatus = "none" | "pending" | "approved" | "rejected";

/** 当前用户的会员申请状态 */
export interface MembershipStatus {
  status: MembershipViewStatus;
  appliedAt: string | null;
  reviewedAt: string | null;
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
  /** 是否限免；false 表示 VIP 专属，游客与普通用户无法读取正文 */
  is_free: boolean;
  /** 是否对未登录游客可见；false 时游客在列表与详情中都看不到 */
  guest_visible: boolean;
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
  /** 是否对未登录游客可见；false 时游客在列表与详情中都看不到 */
  guest_visible: boolean;
  /** 排序号，升序；0 表示未排版 */
  sort: number;
  createdAt: string;
  updatedAt: string;
}
