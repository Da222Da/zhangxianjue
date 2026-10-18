// src/services/bookCategoryService.ts
import { BookCategory } from "../models/index.ts";
import type { BookCategoryAttributes } from "../models/index.ts";
import { BadRequestError, NotFoundError } from "../utils/errors.ts";

/** name 列类型为 STRING，即 VARCHAR(255)，这里限制得更紧一些 */
export const MAX_CATEGORY_NAME_LENGTH = 100;

export interface BookCategoryItem extends BookCategoryAttributes {}

export interface BookCategoryPayload {
  name: string;
  /** 不传表示创建时取 0 / 更新时保持原值 */
  sort?: number;
}

/** 查询全部分类，按排序号升序 */
export const listBookCategories = async (): Promise<BookCategoryItem[]> => {
  const rows = await BookCategory.findAll({
    attributes: ["id", "name", "sort", "createdAt", "updatedAt"],
    order: [
      ["sort", "ASC"],
      ["id", "ASC"],
    ],
    raw: true,
  });
  return rows;
};

/**
 * 校验分类名唯一
 * @throws {BadRequestError} 名称已被其它分类占用
 */
const assertNameAvailable = async (name: string, excludeId?: number): Promise<void> => {
  const existing = await BookCategory.findOne({ where: { name } });
  if (existing && existing.id !== excludeId) {
    throw new BadRequestError("分类名称已存在");
  }
};

const findCategoryOrFail = async (id: number): Promise<BookCategory> => {
  const category = await BookCategory.findByPk(id);
  if (!category) {
    throw new NotFoundError("分类不存在");
  }
  return category;
};

/** 创建分类 */
export const createBookCategory = async (payload: BookCategoryPayload): Promise<BookCategoryItem> => {
  await assertNameAvailable(payload.name);

  const category = await BookCategory.create({
    name: payload.name,
    sort: payload.sort ?? 0,
  });
  return category.get({ plain: true }) as BookCategoryItem;
};

/** 更新分类（sort 未传时保持原值） */
export const updateBookCategory = async (id: number, payload: BookCategoryPayload): Promise<BookCategoryItem> => {
  const category = await findCategoryOrFail(id);
  await assertNameAvailable(payload.name, id);

  const patch: Partial<BookCategoryAttributes> = { name: payload.name };
  if (payload.sort !== undefined) {
    patch.sort = payload.sort;
  }

  await category.update(patch);
  return category.get({ plain: true }) as BookCategoryItem;
};

/**
 * 删除分类
 *
 * 书籍的 category_id 外键为 ON DELETE SET NULL，删除后相关书籍自动变为未分类。
 * @throws {NotFoundError} 分类不存在
 */
export const deleteBookCategory = async (id: number): Promise<void> => {
  const category = await findCategoryOrFail(id);
  await category.destroy();
};
