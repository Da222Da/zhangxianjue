"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addColumn("Articles", "category", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "分类名，自由文本；为空表示未分类",
    });
    await queryInterface.addColumn("Articles", "sort", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "排序号，升序；0 表示未排版，此时按创建时间倒序",
    });
  },
  async down(queryInterface: QueryInterface) {
    await queryInterface.removeColumn("Articles", "sort");
    await queryInterface.removeColumn("Articles", "category");
  },
};
