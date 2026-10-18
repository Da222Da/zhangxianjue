"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.createTable("Roles", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true,
      },
      code: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true,
      },
      description: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      is_system: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: false,
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

    // 内置角色必须随迁移写入（而不是 seeder）：中间件与注册接口都依赖它们存在，
    // 只跑 db:migrate 的部署环境也必须拿到这两个角色。
    const now = new Date();
    await queryInterface.bulkInsert("Roles", [
      {
        id: 1,
        name: "管理员",
        code: "admin",
        description: "拥有后台全部权限的内置角色",
        is_system: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        name: "普通用户",
        code: "user",
        description: "前台注册用户的默认角色，不具备后台管理权限",
        is_system: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Users.role_id 关联 Roles.id；被角色引用的账号必须先换角色才能删除该角色
    await queryInterface.addConstraint("Users", {
      fields: ["role_id"],
      type: "foreign key",
      name: "fk_users_role_id",
      references: { table: "Roles", field: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.removeConstraint("Users", "fk_users_role_id");
    await queryInterface.dropTable("Roles");
  },
};
