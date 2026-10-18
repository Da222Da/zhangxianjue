// src/services/bookService.ts
import { Op } from "sequelize";
import type { Includeable, Order, WhereOptions } from "sequelize";
import { Book, BookCategory, Chapter, Tag, Volume, sequelize } from "../models/index.ts";
import type { BookAttributes, ChapterAttributes, VolumeAttributes } from "../models/index.ts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors.ts";

/** title 列类型为 STRING，即 VARCHAR(255) */
export const MAX_TITLE_LENGTH = 255;
/** description / summary / content / cover 列类型为 TEXT，上限 65535 字节 */
export const MAX_TEXT_BYTES = 65535;

/** 书籍列表排序：先按排序号，再按创建时间倒序 */
const BOOK_ORDER: Order = [
  ["sort", "ASC"],
  ["createdAt", "DESC"],
  ["id", "ASC"],
];

/** 分卷排序：先按排序号，再按录入顺序 */
const VOLUME_ORDER: Order = [
  ["sort", "ASC"],
  ["id", "ASC"],
];

/** 章节排序：属于同一分卷时先按排序号，再按录入顺序 */
const CHAPTER_ORDER: Order = [
  ["sort", "ASC"],
  ["id", "ASC"],
];

/**
 * 书籍查询统一带出分类名与标签
 *
 * required: false → LEFT JOIN，未分类 / 无标签的书籍不会被过滤掉。
 */
const BOOK_INCLUDE: Includeable[] = [
  {
    model: BookCategory,
    as: "categoryRef",
    attributes: ["id", "name"],
    required: false,
  },
  {
    model: Tag,
    as: "tags",
    attributes: ["id", "name"],
    through: { attributes: [] },
    required: false,
  },
];

/** 响应体里的标签项 */
export interface TagItem {
  id: number;
  name: string;
}

export interface BookListItem {
  id: number;
  title: string;
  cover: string | null;
  description: string | null;
  /** 分类 id；null 表示未分类 */
  category_id: number | null;
  /** 分类名（由关联查出，只读）；null 表示未分类 */
  category: string | null;
  /** 标签列表；无标签时为空数组 */
  tags: TagItem[];
  /** 是否限免；false 表示 VIP 专属 */
  is_free: boolean;
  /** 是否对未登录游客可见；false 时游客在列表与详情中都看不到 */
  guest_visible: boolean;
  sort: number;
  /** 分卷数（由 Volume 聚合，只读） */
  volume_count: number;
  /** 章节数（由 Chapter 聚合，只读） */
  chapter_count: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VolumeSummary {
  id: number;
  book_id: number;
  title: string;
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 分卷及其章节（章节不含正文） */
export interface VolumeWithChapters extends VolumeSummary {
  chapters: ChapterListItem[];
}

export interface ChapterListItem {
  id: number;
  book_id: number;
  volume_id: number;
  title: string;
  summary: string | null;
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookDetail extends BookListItem {
  /** 按 sort 升序的分卷，每卷内按章节 sort 升序 */
  volumes: VolumeWithChapters[];
}

export interface ChapterDetail extends ChapterListItem {
  content: string;
}

/** 创建 / 更新书籍的入参；undefined 表示保持原值 */
export interface BookPayload {
  title: string;
  cover?: string | null;
  description?: string | null;
  category_id?: number | null;
  /** 整体替换语义：传空数组表示清空标签，不传表示保持原值 */
  tag_ids?: number[];
  is_free?: boolean;
  /** 不传表示创建时默认为 true（游客可见）/ 更新时保持原值 */
  guest_visible?: boolean;
  sort?: number;
}

/** 创建 / 更新分卷的入参；undefined 表示保持原值 */
export interface VolumePayload {
  title: string;
  sort?: number;
}

/** 创建 / 更新章节的入参；undefined 表示保持原值 */
export interface ChapterPayload {
  /** 创建时必填；更新时传入表示把章节移动到另一个分卷 */
  volume_id?: number;
  title: string;
  summary?: string | null;
  content?: string;
  sort?: number;
}

/** 查询结果里带分类 / 标签关联的模型实例 */
type BookRow = Book & {
  categoryRef?: { id: number; name: string } | null;
  tags?: Array<{ id: number; name: string }>;
};

/** 构造 LIKE 匹配模式：转义 % _ \ 三个通配符字符 */
const buildLikePattern = (keyword: string): string => `%${keyword.replace(/[\\%_]/g, "\\$&")}%`;

/** 查询各书籍的章节数，返回 book_id → count */
const loadChapterCounts = async (): Promise<Map<number, number>> => {
  const rows = (await Chapter.findAll({
    attributes: ["book_id", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
    group: ["book_id"],
    raw: true,
  })) as unknown as Array<{ book_id: number; count: number | string }>;

  return new Map(rows.map((row) => [row.book_id, Number(row.count)]));
};

/** 查询各书籍的分卷数，返回 book_id → count */
const loadVolumeCounts = async (): Promise<Map<number, number>> => {
  const rows = (await Volume.findAll({
    attributes: ["book_id", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
    group: ["book_id"],
    raw: true,
  })) as unknown as Array<{ book_id: number; count: number | string }>;

  return new Map(rows.map((row) => [row.book_id, Number(row.count)]));
};

/** 模型实例 → 列表项 */
const toListItem = (book: BookRow, chapterCount: number, volumeCount: number): BookListItem => {
  const plain = book.get({ plain: true }) as BookAttributes & {
    categoryRef?: { id: number; name: string } | null;
    tags?: Array<{ id: number; name: string }>;
  };

  return {
    id: plain.id,
    title: plain.title,
    cover: plain.cover,
    description: plain.description,
    category_id: plain.category_id,
    category: plain.categoryRef?.name ?? null,
    tags: (plain.tags ?? []).map((tag) => ({ id: tag.id, name: tag.name })),
    is_free: plain.is_free,
    guest_visible: plain.guest_visible,
    sort: plain.sort,
    volume_count: volumeCount,
    chapter_count: chapterCount,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

/** 分卷模型实例 → 摘要（不含章节） */
const toVolumeSummary = (volume: Volume): VolumeSummary => {
  const plain = volume.get({ plain: true }) as VolumeAttributes;
  return {
    id: plain.id,
    book_id: plain.book_id,
    title: plain.title,
    sort: plain.sort,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

/** 章节模型实例 → 列表项（不含正文） */
const toChapterListItem = (chapter: Chapter): ChapterListItem => {
  const plain = chapter.get({ plain: true }) as ChapterAttributes;
  const { content: _content, ...rest } = plain;
  return rest;
};

/**
 * 查询书籍列表
 * @param keyword 可选关键词，命中标题（admin 列表使用）
 * @param includeGuestHidden 是否包含「游客不可见」的书籍；admin / 已登录用户传 true
 */
export const listBooks = async (keyword?: string, includeGuestHidden = true): Promise<BookListItem[]> => {
  const where: WhereOptions<BookAttributes> = {};
  if (keyword) {
    where.title = { [Op.like]: buildLikePattern(keyword) };
  }
  if (!includeGuestHidden) {
    where.guest_visible = true;
  }

  const [books, chapterCountMap, volumeCountMap] = await Promise.all([
    Book.findAll({ where, include: BOOK_INCLUDE, order: BOOK_ORDER }),
    loadChapterCounts(),
    loadVolumeCounts(),
  ]);
  return (books as BookRow[]).map((book) =>
    toListItem(book, chapterCountMap.get(book.id) ?? 0, volumeCountMap.get(book.id) ?? 0),
  );
};

/** 按主键取出书籍（含分类与标签关联） */
const findBookOrFail = async (id: number): Promise<BookRow> => {
  const book = await Book.findByPk(id, { include: BOOK_INCLUDE });
  if (!book) {
    throw new NotFoundError("书籍不存在");
  }
  return book as BookRow;
};

/** 按主键取出用于访问判定的最小字段 */
const findBookAccessOrFail = async (id: number): Promise<Book> => {
  const book = await Book.findByPk(id, { attributes: ["id", "is_free", "guest_visible"] });
  if (!book) {
    throw new NotFoundError("书籍不存在");
  }
  return book;
};

/**
 * 校验游客可见性
 *
 * 游客不可见的内容统一按「不存在」处理，避免通过详情接口探测隐藏内容；
 * 登录用户（含普通用户）不受此开关影响。
 */
const assertGuestVisible = (book: Pick<Book, "guest_visible">, isAuthenticated: boolean): void => {
  if (!book.guest_visible && !isAuthenticated) {
    throw new NotFoundError("书籍不存在");
  }
};

/**
 * 校验书籍是否可读
 * @throws {ForbiddenError} 书为 VIP 专属且访客不具备 library:view
 */
const assertBookReadable = (book: Book, canViewVip: boolean): void => {
  if (!book.is_free && !canViewVip) {
    throw new ForbiddenError("本书为 VIP 专属，开通会员或联系管理员获取阅读权益");
  }
};

/** 由书籍行组装详情（分卷 + 每卷章节，不含章节正文） */
const buildBookDetail = async (book: BookRow): Promise<BookDetail> => {
  const [volumes, chapters] = await Promise.all([
    Volume.findAll({ where: { book_id: book.id }, order: VOLUME_ORDER }),
    Chapter.findAll({ where: { book_id: book.id }, order: CHAPTER_ORDER }),
  ]);

  const chapterItems = chapters.map(toChapterListItem);
  const chaptersByVolume = new Map<number, ChapterListItem[]>();
  for (const chapter of chapterItems) {
    const list = chaptersByVolume.get(chapter.volume_id) ?? [];
    list.push(chapter);
    chaptersByVolume.set(chapter.volume_id, list);
  }

  const volumeItems: VolumeWithChapters[] = volumes.map((volume) => ({
    ...toVolumeSummary(volume),
    chapters: chaptersByVolume.get(volume.id) ?? [],
  }));

  return {
    ...toListItem(book, chapterItems.length, volumeItems.length),
    volumes: volumeItems,
  };
};

/**
 * 查询书籍详情（含章节列表，不含章节正文）
 * @throws {NotFoundError} 书籍不存在
 */
export const getBookDetail = async (id: number): Promise<BookDetail> => buildBookDetail(await findBookOrFail(id));

/**
 * 按访客权益查询书籍详情
 * @throws {NotFoundError} 书籍不存在或对游客隐藏
 * @throws {ForbiddenError} VIP 专属且访客无阅读权益
 */
export const getReadableBookDetail = async (
  id: number,
  canViewVip: boolean,
  isAuthenticated: boolean,
): Promise<BookDetail> => {
  const book = await findBookOrFail(id);
  assertGuestVisible(book, isAuthenticated);
  assertBookReadable(book, canViewVip);
  return buildBookDetail(book);
};

/** 按书籍 + 章节主键取出章节 */
const findChapterOrFail = async (bookId: number, chapterId: number): Promise<Chapter> => {
  const chapter = await Chapter.findOne({ where: { id: chapterId, book_id: bookId } });
  if (!chapter) {
    throw new NotFoundError("章节不存在");
  }
  return chapter;
};

/**
 * 查询章节详情（含正文）
 * @throws {NotFoundError} 章节不存在
 */
export const getChapterDetail = async (bookId: number, chapterId: number): Promise<ChapterDetail> => {
  const chapter = await findChapterOrFail(bookId, chapterId);
  return chapter.get({ plain: true }) as ChapterDetail;
};

/**
 * 按访客权益查询章节详情
 * @throws {NotFoundError} 书籍或章节不存在，或书籍对游客隐藏
 * @throws {ForbiddenError} 所属书籍为 VIP 专属且访客无阅读权益
 */
export const getReadableChapterDetail = async (
  bookId: number,
  chapterId: number,
  canViewVip: boolean,
  isAuthenticated: boolean,
): Promise<ChapterDetail> => {
  const book = await findBookAccessOrFail(bookId);
  assertGuestVisible(book, isAuthenticated);
  assertBookReadable(book, canViewVip);
  return getChapterDetail(bookId, chapterId);
};

/** 校验分类存在（undefined / null 表示不设置） */
const assertCategoryExists = async (categoryId: number | null | undefined): Promise<void> => {
  if (categoryId === undefined || categoryId === null) {
    return;
  }
  const category = await BookCategory.findByPk(categoryId);
  if (!category) {
    throw new BadRequestError("分类不存在，请刷新后重试");
  }
};

/** 去重并校验标签全部存在 */
const assertTagsExist = async (tagIds: number[] | undefined): Promise<number[]> => {
  if (tagIds === undefined) {
    return [];
  }
  const uniqueIds = [...new Set(tagIds)];
  if (uniqueIds.length === 0) {
    return [];
  }

  const count = await Tag.count({ where: { id: uniqueIds } });
  if (count !== uniqueIds.length) {
    throw new BadRequestError("包含不存在的标签，请刷新后重试");
  }
  return uniqueIds;
};

/**
 * 创建书籍
 * @throws {BadRequestError} 分类或标签不存在
 */
export const createBook = async (payload: BookPayload): Promise<BookDetail> => {
  await assertCategoryExists(payload.category_id);
  const tagIds = await assertTagsExist(payload.tag_ids);

  const book = await sequelize.transaction(async (transaction) => {
    const created = await Book.create(
      {
        title: payload.title,
        cover: payload.cover ?? null,
        description: payload.description ?? null,
        category_id: payload.category_id ?? null,
        is_free: payload.is_free ?? false,
        guest_visible: payload.guest_visible ?? true,
        sort: payload.sort ?? 0,
      },
      { transaction },
    );

    if (tagIds.length > 0) {
      await created.setTags(tagIds, { transaction });
    }
    return created;
  });

  return getBookDetail(book.id);
};

/**
 * 更新书籍元数据
 *
 * undefined 的字段保持原值，显式传 null 表示清空。
 * @throws {NotFoundError} 书籍不存在
 * @throws {BadRequestError} 分类或标签不存在
 */
export const updateBook = async (id: number, payload: BookPayload): Promise<BookDetail> => {
  const book = await findBookOrFail(id);
  await assertCategoryExists(payload.category_id);
  const tagIds = await assertTagsExist(payload.tag_ids);

  const patch: Partial<BookAttributes> = { title: payload.title };
  if (payload.cover !== undefined) patch.cover = payload.cover;
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.category_id !== undefined) patch.category_id = payload.category_id;
  if (payload.is_free !== undefined) patch.is_free = payload.is_free;
  if (payload.guest_visible !== undefined) patch.guest_visible = payload.guest_visible;
  if (payload.sort !== undefined) patch.sort = payload.sort;

  await sequelize.transaction(async (transaction) => {
    await book.update(patch, { transaction });
    if (payload.tag_ids !== undefined) {
      await book.setTags(tagIds, { transaction });
    }
  });

  return getBookDetail(id);
};

/**
 * 删除书籍
 *
 * 分卷、章节与标签关联由外键 ON DELETE CASCADE 一并删除。
 * @throws {NotFoundError} 书籍不存在
 */
export const deleteBook = async (id: number): Promise<void> => {
  const book = await findBookOrFail(id);
  await book.destroy();
};

/** 按书籍 + 分卷主键取出分卷 */
const findVolumeOrFail = async (bookId: number, volumeId: number): Promise<Volume> => {
  const volume = await Volume.findOne({ where: { id: volumeId, book_id: bookId } });
  if (!volume) {
    throw new NotFoundError("分卷不存在");
  }
  return volume;
};

/**
 * 新增分卷
 * @throws {NotFoundError} 书籍不存在
 */
export const createVolume = async (bookId: number, payload: VolumePayload): Promise<VolumeSummary> => {
  const book = await Book.findByPk(bookId, { attributes: ["id"] });
  if (!book) {
    throw new NotFoundError("书籍不存在");
  }

  const volume = await Volume.create({
    book_id: bookId,
    title: payload.title,
    sort: payload.sort ?? 0,
  });
  return toVolumeSummary(volume);
};

/**
 * 更新分卷
 * @throws {NotFoundError} 分卷不存在
 */
export const updateVolume = async (
  bookId: number,
  volumeId: number,
  payload: VolumePayload,
): Promise<VolumeSummary> => {
  const volume = await findVolumeOrFail(bookId, volumeId);

  const patch: Partial<VolumeAttributes> = { title: payload.title };
  if (payload.sort !== undefined) {
    patch.sort = payload.sort;
  }

  await volume.update(patch);
  return toVolumeSummary(volume);
};

/**
 * 删除分卷
 *
 * ✅ 决策：连同该卷全部章节一起删除（界面会二次确认并提示不可恢复）。
 * 显式删除章节而不是只依赖外键，保证级联行为在 service 层也可见。
 * @throws {NotFoundError} 分卷不存在
 */
export const deleteVolume = async (bookId: number, volumeId: number): Promise<void> => {
  const volume = await findVolumeOrFail(bookId, volumeId);

  await sequelize.transaction(async (transaction) => {
    await Chapter.destroy({ where: { volume_id: volumeId }, transaction });
    await volume.destroy({ transaction });
  });
};

/**
 * 创建章节
 * @throws {NotFoundError} 书籍或分卷不存在
 * @throws {BadRequestError} 未指定 volume_id
 */
export const createChapter = async (bookId: number, payload: ChapterPayload): Promise<ChapterDetail> => {
  if (payload.volume_id === undefined) {
    throw new BadRequestError("volume_id 不能为空");
  }

  const book = await Book.findByPk(bookId, { attributes: ["id"] });
  if (!book) {
    throw new NotFoundError("书籍不存在");
  }
  await findVolumeOrFail(bookId, payload.volume_id);

  const chapter = await Chapter.create({
    book_id: bookId,
    volume_id: payload.volume_id,
    title: payload.title,
    summary: payload.summary ?? null,
    content: payload.content ?? "",
    sort: payload.sort ?? 0,
  });

  return chapter.get({ plain: true }) as ChapterDetail;
};

/**
 * 更新章节
 *
 * 传入 volume_id 表示把章节移动到该分卷；分卷必须属于同一本书。
 * @throws {NotFoundError} 章节或目标分卷不存在
 */
export const updateChapter = async (bookId: number, chapterId: number, payload: ChapterPayload): Promise<ChapterDetail> => {
  const chapter = await findChapterOrFail(bookId, chapterId);

  const patch: Partial<ChapterAttributes> = { title: payload.title };
  if (payload.volume_id !== undefined) {
    await findVolumeOrFail(bookId, payload.volume_id);
    patch.volume_id = payload.volume_id;
  }
  if (payload.summary !== undefined) patch.summary = payload.summary;
  if (payload.content !== undefined) patch.content = payload.content;
  if (payload.sort !== undefined) patch.sort = payload.sort;

  await chapter.update(patch);
  return chapter.get({ plain: true }) as ChapterDetail;
};

/**
 * 删除章节
 * @throws {NotFoundError} 章节不存在
 */
export const deleteChapter = async (bookId: number, chapterId: number): Promise<void> => {
  const chapter = await findChapterOrFail(bookId, chapterId);
  await chapter.destroy();
};
