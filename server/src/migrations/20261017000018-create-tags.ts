"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */

/**
 * 书籍标签
 *
 * 与分类一样，内置标签直接写进迁移，全新数据库无需额外 seeder。
 */
const DEFAULT_TAGS = [
  { id: 1, name: "道藏", sort: 1 },
  { id: 2, name: "佛经", sort: 2 },
  { id: 3, name: "易经", sort: 3 },
  { id: 4, name: "真实故事", sort: 4 },
];

export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.createTable("Tags", {
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
        comment: "标签名，全局唯一",
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
      "Tags",
      DEFAULT_TAGS.map((item) => ({ ...item, createdAt: now, updatedAt: now })),
    );
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("Tags");
  },
};
