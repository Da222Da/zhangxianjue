"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */

/**
 * 书库分卷：Book → Volume → Chapter
 *
 * - 新建 Volumes 表，书籍删除时级联删除分卷
 * - Chapters 增加 volume_id；已有章节全部归入自动创建的「默认分卷」
 * - 先把 volume_id 补全并置为 NOT NULL，再补外键，避免 MySQL 修改
 *   带外键的列时报 “Cannot change column used in a foreign key constraint”
 */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.createTable("Volumes", {
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

    await queryInterface.addIndex("Volumes", ["book_id"], { name: "idx_volumes_book_id" });

    // 先以可空列落地，backfill 完成后再收紧约束
    await queryInterface.addColumn("Chapters", "volume_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "所属分卷 id；分卷删除时级联删除章节",
    });

    await queryInterface.sequelize.query(
      "INSERT INTO `Volumes` (`book_id`, `title`, `sort`, `createdAt`, `updatedAt`) " +
        "SELECT c.book_id, '默认分卷', 0, NOW(), NOW() FROM `Chapters` c " +
        "WHERE NOT EXISTS (SELECT 1 FROM `Volumes` v WHERE v.book_id = c.book_id) " +
        "GROUP BY c.book_id",
    );

    await queryInterface.sequelize.query(
      "UPDATE `Chapters` c JOIN (SELECT book_id, MIN(id) AS id FROM `Volumes` GROUP BY book_id) v " +
        "ON v.book_id = c.book_id SET c.volume_id = v.id WHERE c.volume_id IS NULL",
    );

    await queryInterface.changeColumn("Chapters", "volume_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      comment: "所属分卷 id；分卷删除时级联删除章节",
    });

    await queryInterface.addConstraint("Chapters", {
      fields: ["volume_id"],
      type: "foreign key",
      name: "fk_chapters_volume_id",
      references: { table: "Volumes", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.removeConstraint("Chapters", "fk_chapters_volume_id");
    await queryInterface.removeColumn("Chapters", "volume_id");
    await queryInterface.dropTable("Volumes");
  },
};
