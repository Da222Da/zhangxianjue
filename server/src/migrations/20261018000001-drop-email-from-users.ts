"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */

/**
 * 移除 Users.email
 *
 * 账号统一使用手机号作为联系方式与 client 登录标识；
 * 历史迁移文件保留 createTable 时的 email 列，本迁移负责把存量库收敛到新结构。
 */
export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.removeColumn("Users", "email");
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addColumn("Users", "email", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
