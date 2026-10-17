"use strict";
import { QueryInterface } from "sequelize";

interface DemoEvent {
  year: number;
  title: string;
  description: string;
  /** 自定义按钮，顺序即展示顺序 */
  buttons?: Array<{ text: string; url: string }>;
  sort: number;
}

/**
 * 示例时间轴
 *
 * ⚠️ 与其它 seeder 一样：本项目没有配置 seederStorage（默认 none），
 * `db:seed:all` 每次都会重跑，因此这里按「年份 + 标题」判重，保证可重复执行。
 */
const DEMO_EVENTS: DemoEvent[] = [
  {
    year: 2026,
    title: "完成个人站点的重建",
    description: "从零搭好 server / admin / client，把笔记、文章与时间轴三条主线跑通。",
    // 两个按钮：演示一个事件可以挂多个入口
    buttons: [
      { text: "查看文章库", url: "/articles" },
      { text: "回到时间轴", url: "/timeline" },
    ],
    sort: 1,
  },
  {
    year: 2026,
    title: "整理 UE5 移动端优化清单",
    description: "把渲染管线、Draw Call、纹理与验收指标整理成一张思维导图。",
    buttons: [{ text: "查看笔记", url: "/notes/1" }],
    sort: 2,
  },
  {
    year: 2025,
    title: "开始系统整理 Unreal Engine 笔记",
    description: "不再零散记在便签里，改成按主题归档、用思维导图串起来。",
    sort: 1,
  },
  {
    year: 2025,
    title: "在项目里第一次接入 GAS",
    description: "AttributeSet / GameplayAbility / GameplayEffect 三件套正式进入业务代码。",
    sort: 2,
  },
  {
    year: 2024,
    title: "搭好第一套完整的开发环境",
    description: "引擎、IDE、版本管理与构建脚本全部就位，开始能稳定地产出内容。",
    sort: 1,
  },
];

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface) {
    const now = new Date();
    let inserted = 0;

    for (const event of DEMO_EVENTS) {
      const [existing] = await queryInterface.sequelize.query(
        "SELECT id FROM TimelineEvents WHERE year = ? AND title = ? LIMIT 1",
        { replacements: [event.year, event.title] },
      );
      if (existing.length > 0) {
        continue;
      }

      await queryInterface.bulkInsert("TimelineEvents", [
        {
          year: event.year,
          title: event.title,
          description: event.description,
          // ⚠️ bulkInsert 走的是原始 SQL 生成器，不认识 JSON 列；数组必须先序列化成字符串，
          //    由 MySQL 的 JSON 类型解析，否则会抛 Invalid value
          buttons: event.buttons?.length ? JSON.stringify(event.buttons) : null,
          sort: event.sort,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      inserted += 1;
    }

    console.log(inserted > 0 ? `已注入 ${inserted} 条示例时间轴事件` : "示例时间轴事件已存在，跳过注入");
  },

  async down(queryInterface: QueryInterface) {
    for (const event of DEMO_EVENTS) {
      await queryInterface.bulkDelete("TimelineEvents", { year: event.year, title: event.title });
    }
  },
};
