"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */

/**
 * 会员时效
 *
 * - Users.membership_expires_at：仅会员角色有意义
 * - 存量会员统一给 1 年有效期，避免迁移后立刻全部过期
 * - 到期后的降级由服务端在登录 / 鉴权 / 用户列表时惰性执行
 */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addColumn("Users", "membership_expires_at", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "会员到期时间；仅会员角色有值，到期后自动降级为普通用户",
    });

    await queryInterface.sequelize.query(
      "UPDATE `Users` u JOIN `Roles` r ON u.role_id = r.id SET u.membership_expires_at = DATE_ADD(NOW(), INTERVAL 1 YEAR) WHERE r.code = 'member' AND u.membership_expires_at IS NULL",
    );
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.removeColumn("Users", "membership_expires_at");
  },
};
