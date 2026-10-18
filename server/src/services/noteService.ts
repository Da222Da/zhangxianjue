// src/services/noteService.ts
import { Op } from "sequelize";
import type { Order, WhereOptions } from "sequelize";
import { Category, Note } from "../models/index.ts";
import type { NoteAttributes, NoteCreationAttributes } from "../models/index.ts";
import { ForbiddenError, NotFoundError } from "../utils/errors.ts";
import { collectCategoryIds } from "./categoryService.ts";

/** 分页默认页码 */
export const DEFAULT_PAGE = 1;
/** 分页默认每页条数 */
export const DEFAULT_PAGE_SIZE = 10;
/** 单页最大条数，防止一次拉取过多数据 */
export const MAX_PAGE_SIZE = 100;
/** title 列类型为 STRING，即 VARCHAR(255) */
export const MAX_TITLE_LENGTH = 255;
/** content / cover / description 列类型为 TEXT，上限 65535 字节
 *  注意是字节数而非字符数，中文按 UTF-8 编码占 3 字节 */
export const MAX_TEXT_BYTES = 65535;

/**
 * 列表排序：先按排序号升序，同号再按创建时间倒序
 * 与文章列表保持同一套规则，前端无需区分两种资源的顺序语义
 */
const LIST_ORDER: Order = [
  ["sort", "ASC"],
  ["createdAt", "DESC"],
];

/**
 * 列表查询不返回 content
 *
 * ⚠️ 这是与文章列表契约的**有意分歧**：思维导图正文动辄数 KB，
 * 而卡片页与表格页都只用元数据字段，整列返回纯属浪费带宽。
 * 需要正文的调用方走详情接口 GET /:id。
 */
const LIST_ATTRIBUTES: { exclude: string[] } = { exclude: ["content"] };

/**
 * 分类关联
 *
 * required: false → LEFT JOIN，未分类的笔记不会被过滤掉。
 * 别名 categoryRef 与响应体里的扁平字段 category（分类名）区分开。
 */
const CATEGORY_INCLUDE = {
  model: Category,
  as: "categoryRef",
  attributes: ["id", "name"],
  required: false,
};

/** 列表项：不含 content */
export interface NoteListItem {
  id: number;
  title: string;
  cover: string | null;
  description: string | null;
  category_id: number | null;
  /** 分类名（由关联查出）；未分类为 null */
  category: string | null;
  /** 是否限免；false 表示 VIP 专属 */
  is_free: boolean;
  /** 是否对未登录游客可见；false 时游客在列表与详情中都看不到 */
  guest_visible: boolean;
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 详情：在列表项基础上带思维导图正文 */
export interface NoteDetail extends NoteListItem {
  content: string;
}

/** 查询结果里带分类关联的模型实例 */
type NoteRow = Note & { categoryRef?: Category | null };

/** 已通过类型转换与范围校验的列表查询条件 */
export interface NoteListQuery {
  /** 模糊搜索关键词，命中 title、description 与 content */
  keyword?: string;
  /** 按分类筛选；命中该分类及其全部子分类 */
  categoryId?: number;
  /** 当前页码，从 1 开始 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/** 列表查询结果，字段与响应体一一对应 */
export interface NoteListResult {
  rows: NoteListItem[];
  total: number;
  currentPage: number;
  pageSize: number;
}

/** 创建 / 更新笔记元数据的入参（不含 content） */
export interface NoteMetaPayload {
  title: string;
  /** 不传表示不设置（创建）/ 保持原值（更新）；传 null 表示清空 */
  cover?: string | null;
  /** 不传表示不设置（创建）/ 保持原值（更新）；传 null 表示清空 */
  description?: string | null;
  /** 不传表示不设置（创建）/ 保持原值（更新）；传 null 表示移到未分类 */
  category_id?: number | null;
  /** 不传表示创建时为 VIP 专属 / 更新时保持原值 */
  is_free?: boolean;
  /** 不传表示创建时默认为 true（游客可见）/ 更新时保持原值 */
  guest_visible?: boolean;
  /** 不传表示不设置（创建取默认值 0）/ 保持原值（更新） */
  sort?: number;
}


/** 把带关联的模型实例摊平成响应体：category 是分类名而非对象 */
const toPlain = (row: NoteRow): NoteAttributes & { categoryRef?: { name: string } | null } =>
  row.get({ plain: true }) as NoteAttributes & { categoryRef?: { name: string } | null };

const toListItem = (row: NoteRow): NoteListItem => {
  const { content: _content, categoryRef, ...rest } = toPlain(row);
  return { ...rest, category: categoryRef?.name ?? null };
};

const toDetail = (row: NoteRow): NoteDetail => {
  const { categoryRef, ...rest } = toPlain(row);
  return { ...rest, category: categoryRef?.name ?? null };
};

/**
 * 构造 LIKE 匹配模式
 * 转义用户输入中的 % _ \ 三个通配符字符，避免其被当作通配符使用
 * （MySQL 默认转义符为反斜杠）
 */
const buildLikePattern = (keyword: string): string => `%${keyword.replace(/[\\%_]/g, "\\$&")}%`;

/**
 * 构造关键词检索条件
 * 命中 title / description / content 三个字段 —— 正文虽不在列表响应里，
 * 但作为可检索字段能覆盖"记得写过但想不起标题"的场景
 */
const buildKeywordCondition = (keyword: string): WhereOptions<NoteAttributes> => {
  const pattern = buildLikePattern(keyword);
  return {
    [Op.or]: [
      { title: { [Op.like]: pattern } },
      { description: { [Op.like]: pattern } },
      { content: { [Op.like]: pattern } },
    ],
  };
};

/**
 * 组合列表筛选条件，各条件之间为 AND 关系
 * 无条件时返回空对象，等价于不加 WHERE
 *
 * ⚠️ 分类筛选是异步的：需要先把整棵子树展开成 id 列表（父分类要命中所有子孙）。
 */
const buildWhereCondition = async (
  query: NoteListQuery,
  includeGuestHidden: boolean,
): Promise<WhereOptions<NoteAttributes>> => {
  const conditions: WhereOptions<NoteAttributes>[] = [];

  if (query.keyword) {
    conditions.push(buildKeywordCondition(query.keyword));
  }
  if (query.categoryId !== undefined) {
    const ids = await collectCategoryIds(query.categoryId);
    conditions.push({ category_id: { [Op.in]: ids } });
  }
  if (!includeGuestHidden) {
    conditions.push({ guest_visible: true });
  }

  return conditions.length > 0 ? { [Op.and]: conditions } : {};
};

/**
 * 分页查询笔记列表（不含 content）
 *
 * 登录用户返回全部笔记（含 VIP 专属），前端按 is_free 打角标；
 * 游客只返回 guest_visible=true 的笔记。真正的正文拦截在详情接口。
 * @param query 已完成校验的查询条件
 * @param includeGuestHidden 是否包含「游客不可见」的笔记；admin / 已登录用户传 true
 */
export const listNotes = async (query: NoteListQuery, includeGuestHidden = true): Promise<NoteListResult> => {
  const { page, pageSize } = query;

  const { count, rows } = await Note.findAndCountAll({
    where: await buildWhereCondition(query, includeGuestHidden),
    attributes: LIST_ATTRIBUTES,
    include: [CATEGORY_INCLUDE],
    limit: pageSize,
    // 偏移量：跳过前面已翻过的页
    offset: (page - 1) * pageSize,
    order: LIST_ORDER,
  });

  return { rows: (rows as NoteRow[]).map(toListItem), total: count, currentPage: page, pageSize };
};

/**
 * 按主键取出模型实例（供更新 / 删除内部使用）
 * @throws {NotFoundError} 笔记不存在
 */
const findNoteOrFail = async (id: number): Promise<NoteRow> => {
  const note = await Note.findByPk(id, { include: [CATEGORY_INCLUDE] });
  if (!note) {
    throw new NotFoundError("笔记不存在");
  }
  return note as NoteRow;
};

/**
 * 按主键查询笔记详情（含 content）
 * @throws {NotFoundError} 笔记不存在
 */
export const getNoteById = async (id: number): Promise<NoteDetail> => toDetail(await findNoteOrFail(id));

/**
 * 按访客权益查询笔记详情
 * @throws {NotFoundError} 笔记不存在或对游客隐藏
 * @throws {ForbiddenError} 笔记为 VIP 专属且访客无阅读权益
 */
export const getReadableNoteById = async (
  id: number,
  includeRestricted: boolean,
  isAuthenticated: boolean,
): Promise<NoteDetail> => {
  const note = await findNoteOrFail(id);
  if (!note.guest_visible && !isAuthenticated) {
    throw new NotFoundError("笔记不存在");
  }
  if (!note.is_free && !includeRestricted) {
    throw new ForbiddenError("这篇笔记为 VIP 专属，开通会员或联系管理员获取阅读权益");
  }
  return toDetail(note);
};

/**
 * 创建笔记
 *
 * ⚠️ content 兜底为空串而非 null：该列在库中为 NOT NULL，
 * 且 MySQL 不允许 TEXT 列带默认值，只能由本层补上。
 * 工具栏「新增」只填元数据，正文随后通过「编辑内容」补录。
 * @param payload 已校验的元数据
 */
export const createNote = async (payload: NoteMetaPayload): Promise<NoteDetail> => {
  const note = await Note.create({
    title: payload.title,
    content: "",
    cover: payload.cover ?? null,
    description: payload.description ?? null,
    category_id: payload.category_id ?? null,
    is_free: payload.is_free ?? false,
    guest_visible: payload.guest_visible ?? true,
    sort: payload.sort ?? 0,
  });

  // 重新查一次以带上分类名
  return getNoteById(note.id);
};

/**
 * 更新笔记元数据（不触碰 content）
 *
 * cover / description / category_id / sort 为 undefined 时保持原值不变，
 * 仅在显式传入时才覆盖，避免只提交 title 的调用方误清空其它字段。
 * @throws {NotFoundError} 笔记不存在
 */
export const updateNoteMeta = async (id: number, payload: NoteMetaPayload): Promise<NoteDetail> => {
  const note = await findNoteOrFail(id);

  const patch: Partial<NoteAttributes> = { title: payload.title };
  if (payload.cover !== undefined) {
    patch.cover = payload.cover;
  }
  if (payload.description !== undefined) {
    patch.description = payload.description;
  }
  if (payload.category_id !== undefined) {
    patch.category_id = payload.category_id;
  }
  if (payload.is_free !== undefined) {
    patch.is_free = payload.is_free;
  }
  if (payload.guest_visible !== undefined) {
    patch.guest_visible = payload.guest_visible;
  }
  if (payload.sort !== undefined) {
    patch.sort = payload.sort;
  }

  await note.update(patch as Partial<NoteCreationAttributes>);
  return getNoteById(id);
};

/**
 * 只更新笔记正文
 *
 * 与 updateNoteMeta 拆成两个入口，与 admin 的两个弹窗一一对应：
 * 元数据弹窗与内容弹窗各管一半字段，避免"部分更新"语义下的字段互相覆盖。
 * @throws {NotFoundError} 笔记不存在
 */
export const updateNoteContent = async (id: number, content: string): Promise<NoteDetail> => {
  const note = await findNoteOrFail(id);
  await note.update({ content });
  return getNoteById(id);
};

/**
 * 删除笔记
 * @throws {NotFoundError} 笔记不存在
 */
export const deleteNote = async (id: number): Promise<void> => {
  const note = await findNoteOrFail(id);
  await note.destroy();
};
