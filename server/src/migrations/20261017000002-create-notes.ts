"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.createTable("Notes", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      title: {
        type: Sequelize.STRING,
        comment: "标题",
      },
      // ⚠️ 不能写 defaultValue：MySQL 不允许 TEXT 列带默认值
      // （1101 BLOB, TEXT, GEOMETRY or JSON column can't have a default value），
      // 空内容的兜底由 service 层负责
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: "思维导图正文，markmap 消费的 Markdown 文本；空串表示尚未录入",
      },
      cover: {
        type: Sequelize.TEXT,
        comment: "封面，存相对路径（如 /uploads/xxx.png）",
      },
      description: {
        type: Sequelize.TEXT,
        comment: "描述摘要",
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "分类名，自由文本；为空表示未分类",
      },
      sort: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "排序号，升序；0 表示未排版，此时按创建时间倒序",
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("Notes");
  },
};
