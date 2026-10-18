"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";

/**
 * 书籍分类
 *
 * 与文章 / 笔记使用的 Categories（树形）不同：书籍分类是后台维护的扁平列表，
 * 一本书最多属于一个分类。
 */
export interface BookCategoryAttributes {
  id: number;
  /** 分类名，全局唯一 */
  name: string;
  /** 排序号，升序；0 表示未排版 */
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

export type BookCategoryCreationAttributes = Optional<
  BookCategoryAttributes,
  "id" | "createdAt" | "updatedAt" | "sort"
>;

class BookCategory
  extends Model<BookCategoryAttributes, BookCategoryCreationAttributes>
  implements BookCategoryAttributes
{
  declare id: number;
  declare name: string;
  declare sort: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

BookCategory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    sort: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
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
    // 不写 tableName：Sequelize 将 modelName 复数化为表名 BookCategories
    modelName: "BookCategory",
  },
);

export default BookCategory;
