"use strict";
import { QueryInterface } from "sequelize";

interface DemoCategory {
  name: string;
  /** 父分类名；null 表示根分类 */
  parentName: string | null;
  sort: number;
}

/**
 * 示例分类树
 *
 * ```
 * 引擎
 *   ├─ UE5
 *   └─ GAS
 * 工程规范
 * ```
 *
 * ⚠️ 这里用**名称**而不是 id 定位分类：迁移 20261017000004 会先把历史数据里的
 * 文本分类名升级成根分类（id 由自增分配），所以 UE5 / GAS / 工程规范 的 id
 * 在不同库里可能不同。按名称查找才能既复用已有行、又保证可重复执行。
 */
const DEMO_CATEGORIES: DemoCategory[] = [
  { name: "引擎", parentName: null, sort: 1 },
  { name: "UE5", parentName: "引擎", sort: 1 },
  { name: "GAS", parentName: "引擎", sort: 2 },
  { name: "工程规范", parentName: null, sort: 2 },
];

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface) {
    /*
     * ⚠️ 只在**分类表完全为空**时写入，绝不改动已有分类。
     *
     * 早期版本是「按名称查找、缺则创建、有则纠正层级」，但那样会带来一个很坑的后果：
     * 用户在后台把示例分类改过名（例如「引擎」→「Unreal Engine」）之后，
     * 再执行一次 db:seed:all 就会把原来的名字重新建出来、并把子分类挪过去，
     * 相当于悄悄撤销了用户的编辑。
     *
     * 代价：升级已有数据库时，迁移只会把历史文本分类升级成**平铺的根分类**，
     * 不会再自动整理成示例树。需要层级时在后台手动调整即可。
     */
    const [existing] = await queryInterface.sequelize.query("SELECT id FROM Categories LIMIT 1");
    if (existing.length > 0) {
      console.log("Categories 表已有数据，跳过示例分类注入");
      return;
    }

    const idByName = new Map<string, number>();
    const now = new Date();

    // 父分类必须先于子分类创建（DEMO_CATEGORIES 的顺序已保证这一点）
    for (const item of DEMO_CATEGORIES) {
      const parentId = item.parentName === null ? null : idByName.get(item.parentName);
      if (item.parentName !== null && parentId === undefined) {
        throw new Error(`父分类「${item.parentName}」不存在，无法创建「${item.name}」`);
      }

      const [result] = await queryInterface.sequelize.query(
        "INSERT INTO Categories (name, parent_id, sort, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
        { replacements: [item.name, parentId, item.sort, now, now] },
      );

      // MySQL 的 INSERT 返回 insertId，用它建立 名称 → id 的映射
      idByName.set(item.name, Number((result as { insertId?: number }).insertId));
    }

    console.log(`已注入 ${DEMO_CATEGORIES.length} 个示例分类`);
  },

  async down(queryInterface: QueryInterface) {
    // 先删子级再删父级：parent_id 外键是 RESTRICT
    const names = DEMO_CATEGORIES.map((item) => item.name);
    await queryInterface.bulkDelete("Categories", { name: names.filter((name) => name !== "引擎") });
    await queryInterface.bulkDelete("Categories", { name: "引擎" });
  },
};
