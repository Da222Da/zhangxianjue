"use strict";
import { QueryInterface } from "sequelize";
/** @type {import('sequelize-cli').Migration} */

/**
 * 调整 library:view 的语义
 *
 * 书库列表本身已对游客开放，该权限现在表示「VIP 阅读权益」：
 * 可读取非限免的书籍、章节与笔记。角色授权关系不变。
 */
export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE `Permissions` SET `name` = 'VIP 阅读权益', `description` = '可阅读非限免的书籍、章节与笔记（会员 / 朋友 / 管理员）' WHERE `code` = 'library:view'",
    );
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE `Permissions` SET `name` = '书库阅读', `description` = '阅读书库中的书籍与章节' WHERE `code` = 'library:view'",
    );
  },
};
