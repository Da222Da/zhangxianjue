"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";

export interface NoteAttributes {
  id: number;
  title: string;
  /** 思维导图正文，格式为 markmap 直接消费的 Markdown 文本；空串表示尚未录入内容 */
  content: string;
  cover: string | null;
  description: string | null;
  /** 分类 id（关联 Categories 表）；null 表示未分类 */
  category_id: number | null;
  /** 排序号，升序；0 表示未排版 */
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

// 创建 Note 时，id 与时间戳由 Sequelize 生成；其余业务字段允许缺省
// ⚠️ content 不在 Optional 列表中：它在库中为 NOT NULL，由 service 统一兜底为空串
export type NoteCreationAttributes = Optional<
  NoteAttributes,
  "id" | "createdAt" | "updatedAt" | "cover" | "description" | "category_id" | "sort"
>;

class Note extends Model<NoteAttributes, NoteCreationAttributes> implements NoteAttributes {
  declare id: number;
  declare title: string;
  declare content: string;
  declare cover: string | null;
  declare description: string | null;
  declare category_id: number | null;
  declare sort: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}
Note.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: DataTypes.STRING,
    // ⚠️ 此处刻意不写 defaultValue：MySQL 不允许 TEXT 列带默认值
    // （报错 1101 "BLOB, TEXT, GEOMETRY or JSON column can't have a default value"），
    // 因此空内容的兜底放在 service 层完成，模型只声明 NOT NULL 约束
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    cover: DataTypes.TEXT,
    description: DataTypes.TEXT,
    // 外键在迁移里声明（ON DELETE RESTRICT）；模型只描述列本身
    category_id: {
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
    // 不写 tableName：Sequelize 将 modelName 复数化为表名 Notes
    modelName: "Note",
  },
);
// Associations
// Note.belongsTo(TargetModel, {
//   as: 'custom_name',
//   foreignKey: {
//     name: 'foreign_key_column_name',
//     allowNull: false,
//   },
//   onDelete: "RESTRICT",
//   foreignKeyConstraint: true,
// });
export default Note;
