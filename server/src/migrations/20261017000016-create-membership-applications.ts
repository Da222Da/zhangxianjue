"use strict";
import { QueryInterface, DataTypes } from "sequelize";
/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.createTable("MembershipApplications", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      user_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      status: {
        allowNull: false,
        type: Sequelize.STRING(20),
        defaultValue: "pending",
      },
      reviewed_by: {
        allowNull: true,
        type: Sequelize.INTEGER,
        references: { model: "Users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      reviewed_at: {
        allowNull: true,
        type: Sequelize.DATE,
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

    await queryInterface.addIndex("MembershipApplications", ["user_id", "status"], { name: "idx_membership_user_status" });
    await queryInterface.addIndex("MembershipApplications", ["status"], { name: "idx_membership_status" });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("MembershipApplications");
  },
};
