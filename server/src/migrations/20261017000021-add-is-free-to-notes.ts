"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */

/**
 * 笔记访问控制
 *
 * 默认 false（VIP 专属）：游客与普通用户只能看到「限免」笔记的正文，
 * 会员 / 朋友 / 管理员（具备 library:view）可阅读全部。
 */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addColumn("Notes", "is_free", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "是否限免：true 时游客与普通用户也可阅读",
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.removeColumn("Notes", "is_free");
  },
};
