// src/services/articleService.ts
import { Op } from "sequelize";
import type { Order, WhereOptions } from "sequelize";
import { Article, Category, Note } from "../models/index.ts";
import type { ArticleAttributes, ArticleCreationAttributes } from "../models/index.ts";
import { NotFoundError } from "../utils/errors.ts";
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
 */
const LIST_ORDER: Order = [
  ["sort", "ASC"],
  ["createdAt", "DESC"],
];

/**
 * 分类关联
 *
 * required: false → LEFT JOIN，未分类的文章不会被过滤掉。
 * 别名 categoryRef 与响应体里的扁平字段 category（分类名）区分开。
 */
const CATEGORY_INCLUDE = {
  model: Category,
  as: "categoryRef",
  attributes: ["id", "name"],
  required: false,
};

/**
 * 关联笔记
 *
 * 同样 required: false，未关联的文章不会被过滤掉。
 * 别名 noteRef 与响应体里的扁平字段 note_title 区分开。
 */
const NOTE_INCLUDE = {
  model: Note,
  as: "noteRef",
  attributes: ["id", "title"],
  required: false,
};

/** 列表项：不含 content */
export interface ArticleListItem {
  id: number;
  title: string;
  cover: string | null;
  description: string | null;
  category_id: number | null;
  /** 分类名（由关联查出）；未分类为 null */
  category: string | null;
  /** 关联笔记 id；null 表示未关联 */
  note_id: number | null;
  /** 关联笔记标题（由关联查出，只读）；未关联为 null */
  note_title: string | null;
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 详情：在列表项基础上带正文 */
export interface ArticleDetail extends ArticleListItem {
  content: string;
}

/** 查询结果里带分类 / 关联笔记的模型实例 */
type ArticleRow = Article & { categoryRef?: Category | null; noteRef?: Note | null };

/** 已通过类型转换与范围校验的列表查询条件 */
export interface ArticleListQuery {
  /** 模糊搜索关键词，命中 title 与 content */
  keyword?: string;
  /** 按分类筛选；命中该分类及其全部子分类 */
  categoryId?: number;
  /** 当前页码，从 1 开始 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/** 列表查询结果，字段与响应体一一对应 */
export interface ArticleListResult {
  rows: ArticleListItem[];
  total: number;
  currentPage: number;
  pageSize: number;
}

/**
 * 创建 / 更新文章元数据的入参（不含 content）
 *
 * ⚠️ 与笔记完全一致：元数据与正文是两个独立入口。
 * 工具栏「新增」只填元数据，正文随后通过「编辑内容」补录。
 */
export interface ArticleMetaPayload {
  title: string;
  /** 不传表示不设置（创建）/ 保持原值（更新）；传 null 表示清空 */
  cover?: string | null;
  /** 不传表示不设置（创建）/ 保持原值（更新）；传 null 表示清空 */
  description?: string | null;
  /** 不传表示不设置（创建）/ 保持原值（更新）；传 null 表示移到未分类 */
  category_id?: number | null;
  /** 不传表示不设置（创建）/ 保持原值（更新）；传 null 表示解除关联 */
  note_id?: number | null;
  /** 不传表示不设置（创建取默认值 0）/ 保持原值（更新） */
  sort?: number;
}

/** 把带关联的模型实例摊平成响应体：category / note_title 是派生字段而非对象 */
const toPlain = (
  row: ArticleRow,
): ArticleAttributes & { categoryRef?: { name: string } | null; noteRef?: { id: number; title: string } | null } =>
  row.get({ plain: true }) as ArticleAttributes & {
    categoryRef?: { name: string } | null;
    noteRef?: { id: number; title: string } | null;
  };

const toListItem = (row: ArticleRow): ArticleListItem => {
  // 去掉 content 与关联对象，只保留列表字段
  const { content: _content, categoryRef, noteRef, ...rest } = toPlain(row);
  return { ...rest, category: categoryRef?.name ?? null, note_title: noteRef?.title ?? null };
};

const toDetail = (row: ArticleRow): ArticleDetail => {
  const { categoryRef, noteRef, ...rest } = toPlain(row);
  return { ...rest, category: categoryRef?.name ?? null, note_title: noteRef?.title ?? null };
};

/**
 * 构造 LIKE 匹配模式
 * 转义用户输入中的 % _ \ 三个通配符字符，避免其被当作通配符使用
 * （MySQL 默认转义符为反斜杠）
 */
const buildLikePattern = (keyword: string): string => `%${keyword.replace(/[\\%_]/g, "\\$&")}%`;

/**
 * 构造关键词检索条件
 * 当前命中 title 与 content 两个字段，如需增加可搜索字段，在此追加即可
 */
const buildKeywordCondition = (keyword: string): WhereOptions<ArticleAttributes> => ({
  [Op.or]: [{ title: { [Op.like]: buildLikePattern(keyword) } }, { content: { [Op.like]: buildLikePattern(keyword) } }],
});

/**
 * 组合列表筛选条件，各条件之间为 AND 关系
 * 无条件时返回空对象，等价于不加 WHERE
 *
 * ⚠️ 分类筛选是异步的：需要先把整棵子树展开成 id 列表（父分类要命中所有子孙）。
 */
const buildWhereCondition = async (query: ArticleListQuery): Promise<WhereOptions<ArticleAttributes>> => {
  const conditions: WhereOptions<ArticleAttributes>[] = [];

  if (query.keyword) {
    conditions.push(buildKeywordCondition(query.keyword));
  }
  if (query.categoryId !== undefined) {
    const ids = await collectCategoryIds(query.categoryId);
    conditions.push({ category_id: { [Op.in]: ids } });
  }

  return conditions.length > 0 ? { [Op.and]: conditions } : {};
};

/**
 * 分页查询文章列表
 * @param query 已完成校验的查询条件
 */
export const listArticles = async (query: ArticleListQuery): Promise<ArticleListResult> => {
  const { page, pageSize } = query;

  const { count, rows } = await Article.findAndCountAll({
    where: await buildWhereCondition(query),
    include: [CATEGORY_INCLUDE, NOTE_INCLUDE],
    limit: pageSize,
    // 偏移量：跳过前面已翻过的页
    offset: (page - 1) * pageSize,
    order: LIST_ORDER,
  });

  return { rows: (rows as ArticleRow[]).map(toListItem), total: count, currentPage: page, pageSize };
};

/**
 * 按主键取出模型实例（供更新 / 删除内部使用）
 * @throws {NotFoundError} 文章不存在
 */
const findArticleOrFail = async (id: number): Promise<ArticleRow> => {
  const article = await Article.findByPk(id, { include: [CATEGORY_INCLUDE, NOTE_INCLUDE] });
  if (!article) {
    throw new NotFoundError("文章不存在");
  }
  return article as ArticleRow;
};

/**
 * 按主键查询文章详情
 * @throws {NotFoundError} 文章不存在
 */
export const getArticleById = async (id: number): Promise<ArticleDetail> => toDetail(await findArticleOrFail(id));

/**
 * 创建文章
 *
 * content 直接落空串：该列允许 NULL，但空串能省去前端每处判空，
 * 与笔记表保持同一种「尚未录入正文」的表示。
 * @param payload 已校验的元数据
 */
export const createArticle = async (payload: ArticleMetaPayload): Promise<ArticleDetail> => {
  const article = await Article.create({
    title: payload.title,
    content: "",
    cover: payload.cover ?? null,
    description: payload.description ?? null,
    category_id: payload.category_id ?? null,
    note_id: payload.note_id ?? null,
    sort: payload.sort ?? 0,
  });

  // 重新查一次以带上分类名，避免在 create 之后手工拼装
  return getArticleById(article.id);
};

/**
 * 更新文章元数据（不触碰 content）
 *
 * cover / description / category_id / note_id / sort 为 undefined 时保持原值不变，
 * 仅在显式传入时才覆盖，避免只提交 title 的调用方误清空其它字段。
 * @throws {NotFoundError} 文章不存在
 */
export const updateArticleMeta = async (id: number, payload: ArticleMetaPayload): Promise<ArticleDetail> => {
  const article = await findArticleOrFail(id);

  const patch: Partial<ArticleAttributes> = { title: payload.title };
  if (payload.cover !== undefined) {
    patch.cover = payload.cover;
  }
  if (payload.description !== undefined) {
    patch.description = payload.description;
  }
  if (payload.category_id !== undefined) {
    patch.category_id = payload.category_id;
  }
  if (payload.note_id !== undefined) {
    patch.note_id = payload.note_id;
  }
  if (payload.sort !== undefined) {
    patch.sort = payload.sort;
  }

  await article.update(patch as Partial<ArticleCreationAttributes>);
  return getArticleById(id);
};

/**
 * 只更新文章正文
 *
 * 与 updateArticleMeta 拆成两个入口，与 admin 的两个弹窗一一对应：
 * 元数据弹窗与内容弹窗各管一半字段，避免"部分更新"语义下的字段互相覆盖。
 * @throws {NotFoundError} 文章不存在
 */
export const updateArticleContent = async (id: number, content: string): Promise<ArticleDetail> => {
  const article = await findArticleOrFail(id);
  await article.update({ content });
  return getArticleById(id);
};

/**
 * 删除文章
 * @throws {NotFoundError} 文章不存在
 */
export const deleteArticle = async (id: number): Promise<void> => {
  const article = await findArticleOrFail(id);
  await article.destroy();
};
