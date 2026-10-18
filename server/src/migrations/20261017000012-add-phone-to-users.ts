"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    // 手机号是 client 端登录 / 注册的唯一标识；管理员历史账号可以没有手机号。
    // MySQL 的 UNIQUE 索引把多个 NULL 视为互不冲突，所以这里保持 nullable。
    await queryInterface.addColumn("Users", "phone", {
      allowNull: true,
      type: Sequelize.STRING(20),
    });

    await queryInterface.addIndex("Users", ["phone"], {
      unique: true,
      name: "uniq_users_phone",
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.removeIndex("Users", "uniq_users_phone");
    await queryInterface.removeColumn("Users", "phone");
  },
};
