"use strict";
import { QueryInterface, DataTypes } from "sequelize";

/**
 * 时间轴事件：单个按钮 → 多个按钮
 *
 * ✅ 决策：用 `buttons` JSON 列存数组，而不是另建 `TimelineEventButtons` 子表。
 * 按钮是事件的**值对象**：没有独立生命周期、不需要按按钮查询、永远与事件一起读写。
 * JSON 列让「读事件 = 拿到全部按钮」「存事件 = 整体替换按钮」都保持单条 SQL，
 * 也省掉了子表的级联删除与排序字段。
 *
 * 迁移内容：加列 → 把旧的 button_text / button_url 包成单元素数组 → 删旧列。
 */
/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addColumn("TimelineEvents", "buttons", {
      type: Sequelize.JSON,
      allowNull: true,
      comment: "自定义按钮数组：[{ text, url }]，顺序即展示顺序；NULL 表示没有按钮",
    });

    // 旧数据平移：原来的一对 button_text / button_url 变成数组里的第一个元素
    await queryInterface.sequelize.query(
      `UPDATE TimelineEvents
       SET buttons = JSON_ARRAY(JSON_OBJECT('text', button_text, 'url', button_url))
       WHERE button_text IS NOT NULL AND button_url IS NOT NULL`,
    );

    await queryInterface.removeColumn("TimelineEvents", "button_text");
    await queryInterface.removeColumn("TimelineEvents", "button_url");
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addColumn("TimelineEvents", "button_text", { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn("TimelineEvents", "button_url", { type: Sequelize.STRING(1024), allowNull: true });

    // 回滚只保留第一个按钮：旧结构本来就存不下多个
    await queryInterface.sequelize.query(
      `UPDATE TimelineEvents
       SET button_text = JSON_UNQUOTE(JSON_EXTRACT(buttons, '$[0].text')),
           button_url  = JSON_UNQUOTE(JSON_EXTRACT(buttons, '$[0].url'))`,
    );

    await queryInterface.removeColumn("TimelineEvents", "buttons");
  },
};
