"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.createTable("RolePermissions", {
      role_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        references: { model: "Roles", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      permission_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        references: { model: "Permissions", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
    });

    // 管理员角色（id=1）默认拥有全部权限；普通用户角色（id=2）不分配任何权限。
    await queryInterface.bulkInsert(
      "RolePermissions",
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((permissionId) => ({
        role_id: 1,
        permission_id: permissionId,
      })),
    );
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("RolePermissions");
  },
};
