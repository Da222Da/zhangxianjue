"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";

/** 会员申请状态 */
export type MembershipApplicationStatus = "pending" | "approved" | "rejected";

export interface MembershipApplicationAttributes {
  id: number;
  user_id: number;
  status: MembershipApplicationStatus;
  /** 审核人（管理员）id；未审核时为 null */
  reviewed_by: number | null;
  reviewed_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type MembershipApplicationCreationAttributes = Optional<
  MembershipApplicationAttributes,
  "id" | "createdAt" | "updatedAt" | "reviewed_by" | "reviewed_at"
>;

class MembershipApplication
  extends Model<MembershipApplicationAttributes, MembershipApplicationCreationAttributes>
  implements MembershipApplicationAttributes
{
  declare id: number;
  declare user_id: number;
  declare status: MembershipApplicationStatus;
  declare reviewed_by: number | null;
  declare reviewed_at: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

MembershipApplication.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
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
    modelName: "MembershipApplication",
  },
);

export default MembershipApplication;
