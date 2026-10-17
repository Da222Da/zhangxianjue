"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.createTable("Categories", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "分类名；同级唯一由 service 层保证（MySQL 唯一索引不约束 NULL 父子关系）",
      },
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "父分类 id；NULL 表示根分类",
        references: { model: "Categories", key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      sort: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "同级排序号，升序；0 表示未排版",
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    // 按父分类查子分类是最主要的访问路径（构建树、级联校验）
    await queryInterface.addIndex("Categories", ["parent_id"], { name: "categories_parent_id" });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("Categories");
  },
};
