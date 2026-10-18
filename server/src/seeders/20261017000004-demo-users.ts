"use strict";
import { QueryInterface, QueryTypes } from "sequelize";
import bcrypt from "bcryptjs";

interface DemoUser {
  username: string;
  phone: string;
  /** 角色编码，按 code 查找（不写死 role_id） */
  roleCode: "user" | "member" | "friend";
}

/**
 * 示例账号
 *
 * 用于验证「只有朋友 / 会员能看书库」以及会员申请流程。
 * 统一密码：abc123456
 *
 * | 手机号        | 用户名   | 角色     | 能否看书库 |
 * | :------------ | :------- | :------- | :--------- |
 * | 13800000001   | 会员小雨 | member   | ✅         |
 * | 13800000002   | 朋友阿星 | friend   | ✅         |
 * | 13800000003   | 普通小林 | user     | ❌         |
 */
const DEMO_PASSWORD = "abc123456";

const DEMO_USERS: DemoUser[] = [
  { username: "会员小雨", phone: "13800000001", roleCode: "member" },
  { username: "朋友阿星", phone: "13800000002", roleCode: "friend" },
  { username: "普通小林", phone: "13800000003", roleCode: "user" },
];

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface) {
    // 按 code 查角色：角色 id 由迁移分配，不能依赖具体数字
    const roles = (await queryInterface.sequelize.query("SELECT id, code FROM Roles", {
      type: QueryTypes.SELECT,
    })) as Array<{ id: number; code: string }>;
    const roleIdByCode = new Map(roles.map((role) => [role.code, role.id]));

    const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
    const now = new Date();
    // 示例会员默认 1 年有效期
    const memberExpiresAt = new Date(now);
    memberExpiresAt.setFullYear(memberExpiresAt.getFullYear() + 1);

    for (const item of DEMO_USERS) {
      const roleId = roleIdByCode.get(item.roleCode);
      if (roleId === undefined) {
        throw new Error(`角色 ${item.roleCode} 不存在，请先执行 db:migrate`);
      }

      // 幂等：手机号或用户名任一已存在就跳过，不覆盖用户改过的数据
      const existing = (await queryInterface.sequelize.query(
        "SELECT id FROM Users WHERE phone = :phone OR username = :username LIMIT 1",
        { type: QueryTypes.SELECT, replacements: { phone: item.phone, username: item.username } },
      )) as Array<{ id: number }>;
      if (existing.length > 0) {
        console.log(`用户「${item.username}」已存在，跳过`);
        continue;
      }

      await queryInterface.bulkInsert("Users", [
        {
          username: item.username,
          phone: item.phone,
          avatar: "",
          password: passwordHash,
          role_id: roleId,
          membership_expires_at: item.roleCode === "member" ? memberExpiresAt : null,
          status: 1,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.bulkDelete("Users", {
      phone: DEMO_USERS.map((item) => item.phone),
    });
  },
};
