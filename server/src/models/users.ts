"use strict";
import { Model, DataTypes } from "sequelize";
import type { Optional } from "sequelize";
import sequelize from "./connection.ts";
export interface UsersAttributes {
  id: number;
  username: string;
  /** 手机号，client 端登录 / 注册的唯一标识；管理员账号也可绑定 */
  phone: string | null;
  avatar: string;
  password: string;
  /** 角色 id，关联 Roles 表 */
  role_id: number;
  /**
   * 会员到期时间
   *
   * 仅 role_id 为会员时有意义；到期后由服务端自动降级为普通用户。
   * 其它角色固定为 null。
   */
  membership_expires_at: Date | null;
  /** 账号状态：1 启用 / 0 禁用。禁用后不能登录，但已签发的令牌到期前仍有效 */
  status: number;
  createdAt: Date;
  updatedAt: Date;
}

// 创建 Users 时，不需要 id 字段
interface UserCreationAttributes
  extends Optional<
    UsersAttributes,
    "id" | "phone" | "status" | "membership_expires_at" | "createdAt" | "updatedAt"
  > {}
class Users extends Model<UsersAttributes, UserCreationAttributes> implements UsersAttributes {
  declare id: number;
  declare username: string;
  declare phone: string | null;
  declare avatar: string;
  declare password: string;
  declare role_id: number;
  declare membership_expires_at: Date | null;
  declare status: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}
Users.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: DataTypes.STRING,
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password: DataTypes.STRING,
    role_id: DataTypes.INTEGER,
    membership_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1,
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
    modelName: "Users",
  },
);

export default Users;
