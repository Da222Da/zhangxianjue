"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */

/**
 * 书籍分类
 *
 * 分类由后台维护，内置四条初始数据直接写进迁移，
 * 保证全新数据库迁移后 admin 的分类下拉框即可使用。
 */
const DEFAULT_CATEGORIES = [
  { id: 1, name: "教程", sort: 1 },
  { id: 2, name: "善书", sort: 2 },
  { id: 3, name: "工具书", sort: 3 },
  { id: 4, name: "真实故事", sort: 4 },
];

export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.createTable("BookCategories", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true,
        comment: "分类名，全局唯一",
      },
      sort: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: "排序号，升序",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    const now = new Date();
    await queryInterface.bulkInsert(
      "BookCategories",
      DEFAULT_CATEGORIES.map((item) => ({ ...item, createdAt: now, updatedAt: now })),
    );
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("BookCategories");
  },
};
