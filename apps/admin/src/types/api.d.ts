// src/types/api.d.ts
// 认证相关
export interface LoginResponse {
  token: string;
  refreshToken: string;
  /** 登录接口顺带返回的用户信息（含角色与权限） */
  user: User;
}

/**
 * 后台登录入参
 *
 * `phone` 与 `username` 二选一；后台登录不要求图形验证码。
 */
export interface LoginParams {
  /** 手机号（与 username 二选一） */
  phone?: string;
  /** 用户名（与 phone 二选一） */
  username?: string;
  password: string;
}

/** 本地开发自动登录入参；均可省略，省略时服务端使用 DEV_LOGIN_* */
export interface DevLoginParams {
  phone?: string;
  username?: string;
  password?: string;
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
  /** 是否对未登录游客可见；false 时游客在列表与详情中都看不到 */
  guest_visible: boolean;
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
  /** 不传表示创建时默认游客可见 / 更新时保持原值 */
  guest_visible?: boolean;
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
  guest_visible: boolean;
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
  /** 是否限免；false 表示 VIP 专属，游客与普通用户无法阅读正文 */
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

/** 创建 / 更新笔记元数据的入参。⚠️ 不含 content，正文走 updateNoteContent 单独提交 */
export interface NoteMetaPayload {
  title: string;
  /** 不传表示不设置；更新时不传表示保持原值 */
  cover?: string | null;
  description?: string | null;
  /** 不传表示不设置；更新时不传保持原值，传 null 表示移到未分类 */
  category_id?: number | null;
  /** 不传表示创建时为 VIP 专属 / 更新时保持原值 */
  is_free?: boolean;
  /** 不传表示创建时默认游客可见 / 更新时保持原值 */
  guest_visible?: boolean;
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
  is_free: boolean;
  guest_visible: boolean;
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
/** 账号状态：1 启用 / 0 禁用 */
export type UserStatus = 0 | 1;

/** 用户公开信息（服务端不返回密码） */
export interface User {
  id: number;
  username: string;
  /** 手机号；client / 后台均可作为登录标识 */
  phone: string | null;
  avatar: string;
  role_id: number;
  /** 角色名（服务端由关联查出，只读） */
  role_name: string;
  /** 角色编码（服务端由关联查出，只读） */
  role_code: string;
  /** 会员到期时间；非会员为 null */
  membership_expires_at: string | null;
  status: UserStatus;
  /** 该角色拥有的权限编码，前端据此控制菜单与按钮 */
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

/** 创建用户入参 */
export interface CreateUserPayload {
  username: string;
  /** 可选；建议填写，否则该账号无法在 client 用手机号登录 */
  phone?: string;
  password: string;
  avatar?: string;
  role_id: number;
  /** 仅会员角色有意义；不传默认当前时间 + 1 年 */
  membership_expires_at?: string | null;
  /** 不传默认 1（启用） */
  status?: UserStatus;
}

/** 更新用户入参；未提交的字段保持原值 */
export interface UpdateUserPayload {
  username?: string;
  /** 传 null 或空串表示清空 */
  phone?: string | null;
  avatar?: string;
  role_id?: number;
  /** 仅会员角色有意义；传 null 时服务端重新给 1 年 */
  membership_expires_at?: string | null;
  status?: UserStatus;
}

/** 管理员重置密码入参 */
export interface ResetPasswordPayload {
  password: string;
}

/** 用户列表查询参数（type 才能直接赋给 apiClient 的 params） */
export type UserListParams = {
  keyword?: string;
  role_id?: number;
  status?: UserStatus;
  page?: number;
  pageSize?: number;
};

// 角色相关
/** 角色实体 */
export interface Role {
  id: number;
  name: string;
  /** 角色编码：内置 admin / user，自定义角色由服务端生成 */
  code: string;
  description: string | null;
  /** 系统内置角色不可删除 */
  is_system: boolean;
  /** 该角色下的用户数 */
  user_count: number;
  permission_ids: number[];
  permission_codes: string[];
  createdAt: string;
  updatedAt: string;
}

/** 更新角色入参 */
export interface UpdateRolePayload {
  name: string;
  description?: string | null;
}

/** 创建角色入参 */
export interface CreateRolePayload extends UpdateRolePayload {
  /** 不传表示不分配权限 */
  permission_ids?: number[];
}

/** 重设角色权限入参（整体替换） */
export interface RolePermissionsPayload {
  permission_ids: number[];
}

// 权限相关
/** 权限点（目录由服务端迁移定义，后台只负责分配给角色） */
export interface Permission {
  id: number;
  code: string;
  name: string;
  /** 分组名，后台按组渲染 */
  group_name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// 书库相关
/** 书籍列表项（含章节数） */
/** 书籍标签的简要信息（随书籍返回） */
export interface BookTagRef {
  id: number;
  name: string;
}

/** 书籍分类（后台管理用，含排序与时间戳） */
export interface BookCategoryItem {
  id: number;
  name: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** 书籍标签（后台管理用，含排序与时间戳） */
export interface BookTagItem {
  id: number;
  name: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** 新增 / 编辑分类、标签的入参 */
export interface BookTaxonomyPayload {
  name: string;
  sort?: number;
}

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
  /** 是否限免；false 表示 VIP 专属 */
  is_free: boolean;
  /** 是否对未登录游客可见；false 时游客在列表与详情中都看不到 */
  guest_visible: boolean;
  sort: number;
  /** 分卷数（服务端聚合，只读） */
  volume_count: number;
  /** 章节数（服务端聚合，只读） */
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

/** 创建 / 更新书籍的入参 */
export interface BookPayload {
  title: string;
  cover?: string | null;
  description?: string | null;
  /** 不传表示保持原值；传 null 表示移到未分类 */
  category_id?: number | null;
  /** 整体替换语义：传空数组表示清空标签，不传表示保持原值 */
  tag_ids?: number[];
  /** 不传表示创建时默认 false（VIP 专属）/ 更新时保持原值 */
  is_free?: boolean;
  /** 不传表示创建时默认游客可见 / 更新时保持原值 */
  guest_visible?: boolean;
  sort?: number;
}

/** 创建 / 更新分卷的入参 */
export interface VolumePayload {
  title: string;
  sort?: number;
}

/** 创建 / 更新章节的入参 */
export interface ChapterPayload {
  /** 创建时必填；更新时传入表示移动到另一个分卷 */
  volume_id?: number;
  title: string;
  summary?: string | null;
  content?: string;
  sort?: number;
}

/** 书籍元数据弹窗内的共享草稿 */
export interface BookDraft {
  id: number | string;
  title: string;
  cover: string | null;
  description: string | null;
  category_id: number | null;
  tag_ids: number[];
  is_free: boolean;
  guest_visible: boolean;
  sort: number;
}

/** 章节编辑弹窗内的共享草稿 */
export interface ChapterDraft {
  id: number | string;
  /** 所属分卷；null 表示尚未选择 */
  volume_id: number | null;
  title: string;
  summary: string | null;
  content: string;
  sort: number;
}

// 会员申请相关
export type MembershipApplicationStatus = "pending" | "approved" | "rejected";

/** 后台会员申请列表项 */
export interface MembershipApplicationItem {
  id: number;
  user_id: number;
  username: string;
  phone: string | null;
  role_id: number;
  role_name: string;
  role_code: string;
  status: MembershipApplicationStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 会员申请列表查询参数 */
export type MembershipListParams = {
  status?: MembershipApplicationStatus;
  page?: number;
  pageSize?: number;
};
