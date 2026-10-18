"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.createTable("Chapters", {
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
      title: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      summary: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      content: {
        allowNull: false,
        type: Sequelize.TEXT,
        defaultValue: "",
      },
      sort: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0,
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

    await queryInterface.addIndex("Chapters", ["book_id"], { name: "idx_chapters_book_id" });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("Chapters");
  },
};
