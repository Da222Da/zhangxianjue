"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";

/**
 * 书籍与标签的关联表
 *
 * 通过 Book.belongsToMany(Tag, { through: BookTag }) 使用。
 * 关联行没有业务时间戳，因此关闭 timestamps。
 */
export interface BookTagAttributes {
  id: number;
  book_id: number;
  tag_id: number;
}

export type BookTagCreationAttributes = Optional<BookTagAttributes, "id">;

class BookTag extends Model<BookTagAttributes, BookTagCreationAttributes> implements BookTagAttributes {
  declare id: number;
  declare book_id: number;
  declare tag_id: number;
}

BookTag.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    book_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tag_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    // 不写 tableName：Sequelize 将 modelName 复数化为表名 BookTags
    modelName: "BookTag",
    timestamps: false,
  },
);

export default BookTag;
