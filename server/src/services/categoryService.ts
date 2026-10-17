// src/services/categoryService.ts
import type { Order } from "sequelize";
import { Article, Category, Note } from "../models/index.ts";
import { BadRequestError, NotFoundError } from "../utils/errors.ts";

/** name 列类型为 STRING，即 VARCHAR(255) */
export const MAX_NAME_LENGTH = 255;

/** 树形节点，children 按 sort 升序、同序号按名称升序 */
export interface CategoryTreeNode {
  id: number;
  name: string;
  parent_id: number | null;
  sort: number;
  children: CategoryTreeNode[];
}

/** 创建 / 更新分类的入参 */
export interface CategoryPayload {
  name: string;
  /** 不传表示不设置（创建为根分类）/ 保持原值（更新）；传 null 表示移到根级 */
  parent_id?: number | null;
  /** 不传表示不设置（创建取 0）/ 保持原值（更新） */
  sort?: number;
}

/** 列表排序：同级先按排序号，再按名称，保证树的展示顺序稳定 */
const LIST_ORDER: Order = [
  ["sort", "ASC"],
  ["name", "ASC"],
];

/**
 * 查询完整分类树
 *
 * ✅ 决策：一次性取出全表在内存里组装。分类是低频变更的小表，
 * 递归查库（N+1）或写递归 CTE 都不如这样直接。
 */
export const listCategoryTree = async (): Promise<CategoryTreeNode[]> => {
  const rows = await Category.findAll({
    attributes: ["id", "name", "parent_id", "sort"],
    order: LIST_ORDER,
    raw: true,
  });

  const nodes = new Map<number, CategoryTreeNode>();
  for (const row of rows) {
    nodes.set(row.id, { id: row.id, name: row.name, parent_id: row.parent_id, sort: row.sort, children: [] });
  }

  const roots: CategoryTreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parent_id === null) {
      roots.push(node);
      continue;
    }
    const parent = nodes.get(node.parent_id);
    if (parent) {
      parent.children.push(node);
    } else {
      // 父节点缺失（有外键约束时不会发生）时降级为根节点，避免整棵子树消失
      roots.push(node);
    }
  }

  return roots;
};

/**
 * 收集某个分类自身及其全部子孙的 id
 *
 * 供「按父分类筛选」使用：点父分类要能命中所有子分类下的文章/笔记。
 * 同样是一次性取全表在内存里 BFS。
 */
export const collectCategoryIds = async (rootId: number): Promise<number[]> => {
  const rows = await Category.findAll({ attributes: ["id", "parent_id"], raw: true });

  const childrenOf = new Map<number, number[]>();
  for (const row of rows) {
    if (row.parent_id === null) {
      continue;
    }
    const list = childrenOf.get(row.parent_id) ?? [];
    list.push(row.id);
    childrenOf.set(row.parent_id, list);
  }

  const result: number[] = [];
  const queue: number[] = [rootId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || result.includes(current)) {
      continue;
    }
    result.push(current);
    queue.push(...(childrenOf.get(current) ?? []));
  }

  return result;
};

/**
 * 按主键查询分类
 * @throws {NotFoundError} 分类不存在
 */
export const getCategoryById = async (id: number): Promise<Category> => {
  const category = await Category.findByPk(id);
  if (!category) {
    throw new NotFoundError("分类不存在");
  }
  return category;
};

/**
 * 断言同级下名称唯一
 *
 * ⚠️ 为什么不在数据库建唯一索引：MySQL 的唯一索引把 NULL 视为互不相等，
 * 根分类（parent_id = NULL）之间无法被 `UNIQUE(parent_id, name)` 约束住。
 */
const assertSiblingNameAvailable = async (name: string, parentId: number | null, excludeId?: number): Promise<void> => {
  const existing = await Category.findOne({ where: { name, parent_id: parentId } });
  if (existing && existing.id !== excludeId) {
    throw new BadRequestError(`同级下已存在名为「${name}」的分类`);
  }
};

/** 断言父分类存在 */
const assertParentExists = async (parentId: number): Promise<void> => {
  const parent = await Category.findByPk(parentId, { attributes: ["id"] });
  if (!parent) {
    throw new BadRequestError("父分类不存在");
  }
};

/**
 * 创建分类
 * @throws {BadRequestError} 同级重名 / 父分类不存在
 */
export const createCategory = async (payload: CategoryPayload): Promise<Category> => {
  const parentId = payload.parent_id ?? null;

  if (parentId !== null) {
    await assertParentExists(parentId);
  }
  await assertSiblingNameAvailable(payload.name, parentId);

  return Category.create({
    name: payload.name,
    parent_id: parentId,
    sort: payload.sort ?? 0,
  });
};

/**
 * 更新分类（名称 / 父分类 / 排序）
 *
 * 移动父分类时会检查成环：不能把分类挂到自己或自己的子孙下面，
 * 否则树会出现环，遍历时无限递归。
 * @throws {BadRequestError} 同级重名 / 父分类不存在 / 成环
 * @throws {NotFoundError} 分类不存在
 */
export const updateCategory = async (id: number, payload: CategoryPayload): Promise<Category> => {
  const category = await getCategoryById(id);

  const nextName = payload.name;
  const nextParentId = payload.parent_id === undefined ? category.parent_id : payload.parent_id;

  if (nextParentId !== null) {
    if (nextParentId === id) {
      throw new BadRequestError("不能把分类挂到自己下面");
    }
    await assertParentExists(nextParentId);

    // 成环检查：新的父分类不能是当前分类的子孙
    const descendants = await collectCategoryIds(id);
    if (descendants.includes(nextParentId)) {
      throw new BadRequestError("不能把分类挂到自己的子分类下面");
    }
  }

  const parentChanged = nextParentId !== category.parent_id;
  const nameChanged = nextName !== category.name;
  if (nameChanged || parentChanged) {
    await assertSiblingNameAvailable(nextName, nextParentId, id);
  }

  return category.update({ name: nextName, parent_id: nextParentId, sort: payload.sort ?? category.sort });
};

/**
 * 删除分类
 *
 * ✅ 决策：有子分类或仍被文章/笔记引用时**拒绝删除**，由调用方先处理。
 * 数据不会因一次误删而连带消失，也避免把引用方的分类静默置空。
 * @throws {BadRequestError} 存在子分类或仍被引用
 * @throws {NotFoundError} 分类不存在
 */
export const deleteCategory = async (id: number): Promise<void> => {
  await getCategoryById(id);

  const children = await Category.count({ where: { parent_id: id } });
  if (children > 0) {
    throw new BadRequestError(`该分类下还有 ${children} 个子分类，请先删除或移动它们`);
  }

  const [articleCount, noteCount] = await Promise.all([
    Article.count({ where: { category_id: id } }),
    Note.count({ where: { category_id: id } }),
  ]);
  if (articleCount > 0 || noteCount > 0) {
    throw new BadRequestError(`仍有 ${articleCount} 篇文章、${noteCount} 条笔记引用该分类，请先改到其它分类`);
  }

  await Category.destroy({ where: { id } });
};
