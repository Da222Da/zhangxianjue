"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";

export interface ChapterAttributes {
  id: number;
  /** 所属书籍 id；书籍删除时由外键级联删除 */
  book_id: number;
  /** 所属分卷 id；分卷删除时由外键级联删除 */
  volume_id: number;
  title: string;
  /** 章节导读，渲染在阅读页的「本节内容」面板 */
  summary: string | null;
  /** 章节正文（Markdown） */
  content: string;
  /** 分卷内的排序号，升序 */
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ChapterCreationAttributes = Optional<
  ChapterAttributes,
  "id" | "createdAt" | "updatedAt" | "summary" | "content" | "sort"
>;

class Chapter extends Model<ChapterAttributes, ChapterCreationAttributes> implements ChapterAttributes {
  declare id: number;
  declare book_id: number;
  declare volume_id: number;
  declare title: string;
  declare summary: string | null;
  declare content: string;
  declare sort: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Chapter.init(
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
    volume_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
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
    modelName: "Chapter",
  },
);

export default Chapter;
