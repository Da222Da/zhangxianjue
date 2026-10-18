"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";

export interface PermissionAttributes {
  id: number;
  /** 权限编码，后端中间件按它校验（如 article:manage） */
  code: string;
  /** 权限名，展示用 */
  name: string;
  /** 分组名，后台按组渲染（系统 / 内容） */
  group_name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PermissionCreationAttributes = Optional<PermissionAttributes, "id" | "createdAt" | "updatedAt" | "description">;

class Permission extends Model<PermissionAttributes, PermissionCreationAttributes> implements PermissionAttributes {
  declare id: number;
  declare code: string;
  declare name: string;
  declare group_name: string;
  declare description: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Permission.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    group_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    modelName: "Permission",
  },
);

export default Permission;
