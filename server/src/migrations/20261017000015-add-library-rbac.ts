"use strict";
import { QueryInterface, DataTypes, Op } from "sequelize";
/** @type {import('sequelize-cli').Migration} */

/**
 * 书库相关角色与权限
 *
 * - 新增权限点：library:view（阅读书库）、book:manage（后台书库管理）
 * - 新增内置角色：会员（member）、朋友（friend）
 * - 授权：管理员 → library:view + book:manage；会员 / 朋友 → library:view
 *
 * ⚠️ 权限编码必须与 `src/utils/constants/permissions.ts` 保持一致。
 */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    const now = new Date();

    await queryInterface.bulkInsert("Permissions", [
      {
        id: 10,
        code: "library:view",
        name: "书库阅读",
        group_name: "内容",
        description: "阅读书库中的书籍与章节",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 11,
        code: "book:manage",
        name: "书库管理",
        group_name: "内容",
        description: "后台维护书籍与章节",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await queryInterface.bulkInsert("Roles", [
      {
        id: 3,
        name: "会员",
        code: "member",
        description: "可阅读书库；由会员申请审核通过后自动授予",
        is_system: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 4,
        name: "朋友",
        code: "friend",
        description: "可阅读书库的内置角色，由管理员直接分配",
        is_system: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await queryInterface.bulkInsert("RolePermissions", [
      // 管理员：书库阅读 + 书库管理
      { role_id: 1, permission_id: 10 },
      { role_id: 1, permission_id: 11 },
      // 会员 / 朋友：只读
      { role_id: 3, permission_id: 10 },
      { role_id: 4, permission_id: 10 },
    ]);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.bulkDelete("RolePermissions", {
      [Op.or]: [{ permission_id: [10, 11] }, { role_id: [3, 4] }],
    });
    await queryInterface.bulkDelete("Roles", { id: [3, 4] });
    await queryInterface.bulkDelete("Permissions", { id: [10, 11] });
  },
};
