"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */

/**
 * 书籍表调整
 *
 * - 新增 category_id（关联 BookCategories，删除分类时置空）
 * - 新增 is_free（限免开关）
 * - 删除旧的自定义分类字符串与难度字段
 *
 * 存量数据：原 category 是自由文本，新分类只有「教程 / 善书 / 工具书 / 真实故事」四类，
 * 无法一一映射，因此统一归入「教程」，避免迁移后分类为空。
 */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addColumn("Books", "category_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "分类 id（关联 BookCategories）",
    });
    // 用显式约束名，down 里才能可靠地先删外键再删列
    await queryInterface.sequelize.query(
      "ALTER TABLE `Books` ADD CONSTRAINT `fk_books_category_id` FOREIGN KEY (`category_id`) REFERENCES `BookCategories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE",
    );

    await queryInterface.addColumn("Books", "is_free", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "是否限免：true 时游客与普通用户也可阅读",
    });

    await queryInterface.sequelize.query(
      "UPDATE `Books` SET `category_id` = (SELECT `id` FROM `BookCategories` WHERE `name` = '教程' LIMIT 1) WHERE `category_id` IS NULL",
    );

    await queryInterface.removeColumn("Books", "level");
    await queryInterface.removeColumn("Books", "category");
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addColumn("Books", "category", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      "UPDATE `Books` b LEFT JOIN `BookCategories` c ON b.category_id = c.id SET b.category = c.name",
    );
    await queryInterface.addColumn("Books", "level", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.removeColumn("Books", "is_free");
    await queryInterface.sequelize.query("ALTER TABLE `Books` DROP FOREIGN KEY `fk_books_category_id`");
    await queryInterface.removeColumn("Books", "category_id");
  },
};
