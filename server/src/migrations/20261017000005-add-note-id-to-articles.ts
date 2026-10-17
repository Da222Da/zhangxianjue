"use strict";
import { QueryInterface, DataTypes } from "sequelize";

/**
 * 给文章增加「关联笔记」字段
 *
 * ✅ 决策：`ON DELETE SET NULL` 而非 RESTRICT。
 * 文章 → 笔记 是**可选**的延伸阅读关系，删除笔记不应被文章卡住；
 * 笔记被删后文章只是少一个入口，本身仍然完整，因此让外键自动置空，
 * 避免留下悬空 id 或要求用户在删除笔记前手工解绑。
 */
/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addColumn("Articles", "note_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "关联笔记 id（关联 Notes）；NULL 表示未关联",
    });

    await queryInterface.addConstraint("Articles", {
      fields: ["note_id"],
      type: "foreign key",
      name: "articles_note_id_fk",
      references: { table: "Notes", field: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    await queryInterface.addIndex("Articles", ["note_id"], { name: "articles_note_id" });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.removeConstraint("Articles", "articles_note_id_fk");
    await queryInterface.removeIndex("Articles", "articles_note_id");
    await queryInterface.removeColumn("Articles", "note_id");
  },
};
