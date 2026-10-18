"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";

export interface RoleAttributes {
  id: number;
  /** 角色名，展示用 */
  name: string;
  /** 角色编码，程序判定用（admin / user / 自定义） */
  code: string;
  description: string | null;
  /** 系统内置角色：不可删除 */
  is_system: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 创建 Role 时，id 与时间戳由 Sequelize 生成；其余业务字段允许缺省
export type RoleCreationAttributes = Optional<RoleAttributes, "id" | "createdAt" | "updatedAt" | "description" | "is_system">;

class Role extends Model<RoleAttributes, RoleCreationAttributes> implements RoleAttributes {
  declare id: number;
  declare name: string;
  declare code: string;
  declare description: string | null;
  declare is_system: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Role.init(
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
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_system: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    modelName: "Role",
  },
);

export default Role;
