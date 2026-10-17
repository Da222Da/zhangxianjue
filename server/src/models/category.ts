"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";

/**
 * 分类（树形）
 *
 * 用邻接表（parent_id）表示层级：根分类的 parent_id 为 null，
 * 子分类指向父分类。层级深度不设上限。
 *
 * ⚠️ 同级名称唯一由 **service 层**保证，不建数据库唯一索引：
 * MySQL 的唯一索引把 NULL 视为互不相等，根分类（parent_id = NULL）之间
 * 因此无法靠 `UNIQUE(parent_id, name)` 约束住。与其用哨兵值 0 代替 NULL，
 * 不如在写入前查一次，语义更直白。
 */
export interface CategoryAttributes {
  id: number;
  name: string;
  /** 父分类 id；null 表示根分类 */
  parent_id: number | null;
  /** 同级排序号，升序；0 表示未排版 */
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

// 创建时 id 与时间戳由 Sequelize 生成；其余业务字段允许缺省
export type CategoryCreationAttributes = Optional<CategoryAttributes, "id" | "createdAt" | "updatedAt" | "parent_id" | "sort">;

class Category extends Model<CategoryAttributes, CategoryCreationAttributes> implements CategoryAttributes {
  declare id: number;
  declare name: string;
  declare parent_id: number | null;
  declare sort: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}
Category.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sort: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // 显式声明时间戳列：Sequelize 仅在属性缺失时才自动注入，此处与迁移文件保持一致的 allowNull 约束
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    // 不写 tableName：Sequelize 将 modelName 复数化为表名 Categories
    modelName: "Category",
  },
);
export default Category;
