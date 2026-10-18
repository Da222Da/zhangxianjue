"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./connection.ts";

export interface RolePermissionAttributes {
  role_id: number;
  permission_id: number;
}

/**
 * 角色-权限关联表
 *
 * 纯关联表，没有时间戳：一行只表示「某个角色拥有某个权限」。
 * 主键为 (role_id, permission_id)，同一对组合只能出现一次。
 */
class RolePermission extends Model<RolePermissionAttributes, RolePermissionAttributes> implements RolePermissionAttributes {
  declare role_id: number;
  declare permission_id: number;
}

RolePermission.init(
  {
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    permission_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
  },
  {
    sequelize,
    modelName: "RolePermission",
    timestamps: false,
  },
);

export default RolePermission;
