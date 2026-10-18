"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";

export interface ArticleAttributes {
  id: number;
  title: string;
  content: string;
  cover: string | null;
  description: string | null;
  /** 分类 id（关联 Categories 表）；null 表示未分类 */
  category_id: number | null;
  /** 关联笔记 id（关联 Notes 表）；null 表示未关联 */
  note_id: number | null;
  /** 是否对未登录游客可见；false 时游客在列表与详情中都看不到 */
  guest_visible: boolean;
  /** 排序号，升序；0 表示未排版 */
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

// 创建 Article 时，id 与时间戳由 Sequelize 生成；其余业务字段允许缺省
export type ArticleCreationAttributes = Optional<
  ArticleAttributes,
  "id" | "createdAt" | "updatedAt" | "cover" | "description" | "category_id" | "note_id" | "guest_visible" | "sort"
>;

class Article extends Model<ArticleAttributes, ArticleCreationAttributes> implements ArticleAttributes {
  declare id: number;
  declare title: string;
  declare content: string;
  declare cover: string | null;
  declare description: string | null;
  declare category_id: number | null;
  declare note_id: number | null;
  declare guest_visible: boolean;
  declare sort: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}
Article.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: DataTypes.STRING,
    content: DataTypes.TEXT,
    cover: DataTypes.TEXT,
    description: DataTypes.TEXT,
    // 外键在迁移里声明（ON DELETE RESTRICT）；模型只描述列本身
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // 关联笔记（外键与 ON DELETE SET NULL 在迁移里声明）；模型只描述列本身
    note_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    guest_visible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    modelName: "Article",
  },
);
// Associations
// Article.belongsTo(TargetModel, {
//   as: 'custom_name',
//   foreignKey: {
//     name: 'foreign_key_column_name',
//     allowNull: false,
//   },
//   onDelete: "RESTRICT",
//   foreignKeyConstraint: true,
// });
export default Article;
