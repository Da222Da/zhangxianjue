"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */

/**
 * 权限点目录
 *
 * ⚠️ 必须与 `src/utils/constants/permissions.ts` 的编码保持一致。
 * 迁移是历史快照，刻意不 import 业务常量；权限点是系统能力，只能随代码新增，
 * 后台的「权限管理」负责把权限分配给角色，不负责增删权限点本身。
 */
const PERMISSION_SEED = [
  { id: 1, code: "admin:access", name: "后台访问", group_name: "系统", description: "允许登录后台管理端" },
  { id: 2, code: "user:manage", name: "用户管理", group_name: "系统", description: "用户增删改查、重置密码、启用 / 禁用" },
  { id: 3, code: "role:manage", name: "角色管理", group_name: "系统", description: "角色增删改查" },
  { id: 4, code: "permission:manage", name: "权限管理", group_name: "系统", description: "给角色分配权限" },
  { id: 5, code: "article:manage", name: "文章管理", group_name: "内容", description: "文章新增、修改、删除" },
  { id: 6, code: "note:manage", name: "笔记管理", group_name: "内容", description: "笔记新增、修改、删除" },
  { id: 7, code: "category:manage", name: "分类管理", group_name: "内容", description: "分类新增、修改、删除" },
  { id: 8, code: "timeline:manage", name: "时间轴管理", group_name: "内容", description: "时间轴事件新增、修改、删除" },
  { id: 9, code: "upload:manage", name: "图片上传", group_name: "内容", description: "上传图片资源" },
];

export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.createTable("Permissions", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      code: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true,
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      group_name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      description: {
        allowNull: true,
        type: Sequelize.TEXT,
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

    const now = new Date();
    await queryInterface.bulkInsert(
      "Permissions",
      PERMISSION_SEED.map((item) => ({ ...item, createdAt: now, updatedAt: now })),
    );
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("Permissions");
  },
};
