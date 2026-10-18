"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */

/**
 * 书籍 ↔ 标签关联表
 *
 * 书籍或标签任一被删除时，关联行都由外键级联清理。
 * (book_id, tag_id) 建唯一索引，避免同一本书重复挂同一标签。
 */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.createTable("BookTags", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      book_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: "Books", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      tag_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: "Tags", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
    });

    await queryInterface.addIndex("BookTags", ["book_id", "tag_id"], {
      unique: true,
      name: "uniq_book_tags_book_id_tag_id",
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("BookTags");
  },
};
