"use strict";
import { QueryInterface, DataTypes } from "sequelize";

const TABLES = ["Articles", "Notes"] as const;

/**
 * 把文章 / 笔记的分类从「自由文本」升级为「关联分类表」
 *
 * 步骤：加列 → 把现有文本值升级成根分类 → 回填外键 → 加约束 → 删除旧文本列。
 * 这是一次**数据迁移**：已有数据里的分类名会被保留为分类表中的行，不会丢失。
 */
/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    for (const table of TABLES) {
      await queryInterface.addColumn(table, "category_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "分类 id（关联 Categories）；NULL 表示未分类",
      });
    }

    // 收集两张表里出现过的全部分类名
    const names = new Set<string>();
    for (const table of TABLES) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT DISTINCT category AS name FROM ${table} WHERE category IS NOT NULL AND category <> ''`,
      );
      for (const row of rows as Array<{ name: string }>) {
        names.add(row.name);
      }
    }

    // 升级为根分类。用 NOT EXISTS 保证可重复执行（中途失败重跑不会重复建行）
    for (const name of names) {
      await queryInterface.sequelize.query(
        `INSERT INTO Categories (name, parent_id, sort, createdAt, updatedAt)
         SELECT ?, NULL, 0, NOW(), NOW() FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM Categories WHERE name = ? AND parent_id IS NULL)`,
        { replacements: [name, name] },
      );
    }

    // 回填外键
    for (const table of TABLES) {
      await queryInterface.sequelize.query(
        `UPDATE ${table} t
         JOIN Categories c ON c.name = t.category AND c.parent_id IS NULL
         SET t.category_id = c.id
         WHERE t.category IS NOT NULL AND t.category <> ''`,
      );
    }

    for (const table of TABLES) {
      const prefix = table.toLowerCase();
      await queryInterface.addConstraint(table, {
        fields: ["category_id"],
        type: "foreign key",
        name: `${prefix}_category_id_fk`,
        references: { table: "Categories", field: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });
      await queryInterface.addIndex(table, ["category_id"], { name: `${prefix}_category_id` });
    }

    // 旧的文本列彻底移除，避免「分类名」出现两个真相来源
    for (const table of TABLES) {
      await queryInterface.removeColumn(table, "category");
    }
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    for (const table of TABLES) {
      const prefix = table.toLowerCase();
      await queryInterface.addColumn(table, "category", { type: Sequelize.STRING, allowNull: true });
      await queryInterface.sequelize.query(`UPDATE ${table} t JOIN Categories c ON c.id = t.category_id SET t.category = c.name`);
      await queryInterface.removeConstraint(table, `${prefix}_category_id_fk`);
      await queryInterface.removeIndex(table, `${prefix}_category_id`);
      await queryInterface.removeColumn(table, "category_id");
    }
  },
};
