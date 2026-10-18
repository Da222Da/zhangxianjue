"use strict";
import { Model, DataTypes } from "sequelize";
import type { BelongsToManySetAssociationsMixin, Optional } from "sequelize";
import sequelize from "./connection.ts";
import type Tag from "./tag.ts";

export interface BookAttributes {
  id: number;
  title: string;
  /** 封面相对路径或外链；null 表示没有封面，前端走占位样式 */
  cover: string | null;
  description: string | null;
  /** 分类 id（关联 BookCategories 表）；null 表示未分类 */
  category_id: number | null;
  /**
   * 是否限免
   *
   * true → 游客与普通用户也可阅读；false → 仅具备 library:view 的 VIP（会员 / 朋友 / 管理员）可阅读
   */
  is_free: boolean;
  /** 是否对未登录游客可见；false 时游客在列表与详情中都看不到 */
  guest_visible: boolean;
  /** 排序号，升序；0 表示未排版 */
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

export type BookCreationAttributes = Optional<
  BookAttributes,
  "id" | "createdAt" | "updatedAt" | "cover" | "description" | "category_id" | "is_free" | "guest_visible" | "sort"
>;

class Book extends Model<BookAttributes, BookCreationAttributes> implements BookAttributes {
  declare id: number;
  declare title: string;
  declare cover: string | null;
  declare description: string | null;
  declare category_id: number | null;
  declare is_free: boolean;
  declare guest_visible: boolean;
  declare sort: number;
  declare createdAt: Date;
  declare updatedAt: Date;

  // 由 models/index.ts 的 belongsToMany 注入；在这里声明以避免 service 层使用 any
  declare setTags: BelongsToManySetAssociationsMixin<Tag, number>;
}

Book.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cover: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // 外键在迁移里声明（ON DELETE SET NULL）；模型只描述列本身
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_free: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    // 显式声明时间戳列，与迁移文件保持一致的 allowNull 约束
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
    modelName: "Book",
  },
);

export default Book;
