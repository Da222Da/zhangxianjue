// src/services/tagService.ts
import { Tag } from "../models/index.ts";
import type { TagAttributes } from "../models/index.ts";
import { BadRequestError, NotFoundError } from "../utils/errors.ts";

/** name 列类型为 STRING，即 VARCHAR(255)，这里限制得更紧一些 */
export const MAX_TAG_NAME_LENGTH = 100;

export interface TagItem extends TagAttributes {}

export interface TagPayload {
  name: string;
  /** 不传表示创建时取 0 / 更新时保持原值 */
  sort?: number;
}

/** 查询全部标签，按排序号升序 */
export const listTags = async (): Promise<TagItem[]> => {
  const rows = await Tag.findAll({
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
 * 校验标签名唯一
 * @throws {BadRequestError} 名称已被其它标签占用
 */
const assertNameAvailable = async (name: string, excludeId?: number): Promise<void> => {
  const existing = await Tag.findOne({ where: { name } });
  if (existing && existing.id !== excludeId) {
    throw new BadRequestError("标签名称已存在");
  }
};

const findTagOrFail = async (id: number): Promise<Tag> => {
  const tag = await Tag.findByPk(id);
  if (!tag) {
    throw new NotFoundError("标签不存在");
  }
  return tag;
};

/** 创建标签 */
export const createTag = async (payload: TagPayload): Promise<TagItem> => {
  await assertNameAvailable(payload.name);

  const tag = await Tag.create({
    name: payload.name,
    sort: payload.sort ?? 0,
  });
  return tag.get({ plain: true }) as TagItem;
};

/** 更新标签（sort 未传时保持原值） */
export const updateTag = async (id: number, payload: TagPayload): Promise<TagItem> => {
  const tag = await findTagOrFail(id);
  await assertNameAvailable(payload.name, id);

  const patch: Partial<TagAttributes> = { name: payload.name };
  if (payload.sort !== undefined) {
    patch.sort = payload.sort;
  }

  await tag.update(patch);
  return tag.get({ plain: true }) as TagItem;
};

/**
 * 删除标签
 *
 * BookTags 关联行由外键 ON DELETE CASCADE 自动清理。
 * @throws {NotFoundError} 标签不存在
 */
export const deleteTag = async (id: number): Promise<void> => {
  const tag = await findTagOrFail(id);
  await tag.destroy();
};
