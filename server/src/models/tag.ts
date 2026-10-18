"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";

/**
 * 书籍标签
 *
 * 与分类的区别：一本书可以有多个标签，标签由后台维护。
 */
export interface TagAttributes {
  id: number;
  /** 标签名，全局唯一 */
  name: string;
  /** 排序号，升序；0 表示未排版 */
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TagCreationAttributes = Optional<TagAttributes, "id" | "createdAt" | "updatedAt" | "sort">;

class Tag extends Model<TagAttributes, TagCreationAttributes> implements TagAttributes {
  declare id: number;
  declare name: string;
  declare sort: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Tag.init(
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
    // 不写 tableName：Sequelize 将 modelName 复数化为表名 Tags
    modelName: "Tag",
  },
);

export default Tag;
