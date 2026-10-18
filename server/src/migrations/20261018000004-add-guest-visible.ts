"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */

/**
 * 游客可见开关
 *
 * Articles / Notes / Books 统一增加 guest_visible，默认 true（保持现有行为）。
 * 关闭后，未登录游客在列表与详情接口中都看不到该内容；登录用户不受影响。
 */
const TABLES = ["Articles", "Notes", "Books"];

export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    for (const table of TABLES) {
      await queryInterface.addColumn(table, "guest_visible", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: "是否对未登录游客可见；false 时游客在列表与详情中都看不到",
      });
    }
  },

  async down(queryInterface: QueryInterface) {
    for (const table of TABLES) {
      await queryInterface.removeColumn(table, "guest_visible");
    }
  },
};
