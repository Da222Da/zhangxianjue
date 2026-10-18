"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    // 历史账号一律视为启用状态
    await queryInterface.addColumn("Users", "status", {
      allowNull: false,
      type: Sequelize.TINYINT,
      defaultValue: 1,
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.removeColumn("Users", "status");
  },
};
