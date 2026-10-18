"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";

/**
 * 书籍分卷
 *
 * 层级：Book → Volume → Chapter。
 * 章节必须归属于某个分卷；删除书籍或分卷时，章节由外键级联删除。
 */
export interface VolumeAttributes {
  id: number;
  /** 所属书籍 id；书籍删除时由外键级联删除 */
  book_id: number;
  title: string;
  /** 书籍内的分卷排序号，升序 */
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

export type VolumeCreationAttributes = Optional<VolumeAttributes, "id" | "createdAt" | "updatedAt" | "sort">;

class Volume extends Model<VolumeAttributes, VolumeCreationAttributes> implements VolumeAttributes {
  declare id: number;
  declare book_id: number;
  declare title: string;
  declare sort: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Volume.init(
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
    title: {
      type: DataTypes.STRING,
      allowNull: false,
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
    modelName: "Volume",
  },
);

export default Volume;
