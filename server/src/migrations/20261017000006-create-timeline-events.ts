"use strict";
import { QueryInterface, DataTypes } from "sequelize";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.createTable("TimelineEvents", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "事件所属年份，作为时间轴的分组单元",
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "事件标题",
      },
      description: {
        type: Sequelize.TEXT,
        comment: "事件描述",
      },
      button_text: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "自定义按钮文案；与 button_url 必须成对出现",
      },
      button_url: {
        type: Sequelize.STRING(1024),
        allowNull: true,
        comment: "自定义按钮链接；站内路径（/notes/1）或 http(s) 地址",
      },
      sort: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "同一年内的排序号，升序",
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    // 列表固定按 year DESC, sort ASC 取，联合索引直接覆盖排序
    await queryInterface.addIndex("TimelineEvents", ["year", "sort"], { name: "timeline_events_year_sort" });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.removeIndex("TimelineEvents", "timeline_events_year_sort");
    await queryInterface.dropTable("TimelineEvents");
  },
};
