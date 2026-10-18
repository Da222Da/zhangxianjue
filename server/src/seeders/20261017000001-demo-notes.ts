"use strict";
import { QueryInterface, DataTypes } from "sequelize";

interface DemoNote {
  id: number;
  title: string;
  content: string;
  cover: string | null;
  description: string;
  /** 分类名；写入时解析成 category_id（分类树由 demo-categories 先建好） */
  categoryName: string;
  /** 是否限免：游客与普通用户可读 */
  is_free: boolean;
  sort: number;
}

/**
 * 示例笔记
 *
 * content 是 markmap 直接消费的 Markdown 文本：
 * 标题与列表会被解析成思维导图的层级节点，# 一级标题为根节点。
 *
 * 其中「相关笔记」分支里的 `[标题](/notes/N)` 是站内链接：
 * client 的详情页会接管点击并用 vue-router 跳转，可用来验证节点内链接。
 * ⚠️ 这些链接指向的是**数据库自增 id**，所以下面的 `id` 必须写死，
 * 否则全新库的 id 顺序一旦变化，示例数据里的链接就会指错。
 *
 * cover 统一留空（没有随仓库分发的图片文件），卡片页会走占位样式；
 * 需要真实封面可在 admin 的笔记管理页上传后替换。
 */
export const DEMO_NOTES: DemoNote[] = [
  {
    id: 1,
    title: "Unreal Engine 5 移动端优化清单",
    content: `# UE5 移动端优化

- **渲染管线**
  - 使用 Mobile HDR 关闭
  - 关闭 Lumen，改用烘焙 Lightmap
  - \`r.Mobile.ShadingPath 0\`
- **Draw Call**
  - 合并材质球，减少材质分支
  - StaticMesh 开启实例化
  - 用 Merge Actors 合并静态物件
- **纹理**
  - 上限 1024，格式 ASTC
  - 关闭 Mip 之外的流送
- **验收**
  - 目标机型稳定 30 FPS
  - 峰值内存不超过 1.5 GB
- **相关笔记**
  - [Nanite 与 Lumen 的取舍](/notes/2)
  - [移动端渲染管线速查](/notes/4)
  - [GAS 技能系统入门](/notes/3)
- **延伸阅读**
  - [移动端渲染管线详解](/articles/1)`,
    cover: null,
    description: "从渲染管线到 Draw Call 的移动端优化顺序，以及可量化的验收指标。",
    categoryName: "UE5",
    is_free: true,
    sort: 1,
  },
  {
    id: 2,
    title: "Nanite 与 Lumen 的取舍",
    content: `# Nanite 与 Lumen 取舍

- **Nanite**
  - 只支持 SM5 及以上，移动端不可用
  - 依赖虚拟几何体，需要高模资产
  - 会显著增加包体
- **Lumen**
  - 软件光追在移动端默认关闭
  - 动态 GI 换静态烘焙可省 30% 以上帧时间
- **决策**
  - PC 端保留两者
  - 移动端统一走烘焙流程
  - 项目中期再评估是否回归
- **相关笔记**
  - [Unreal Engine 5 移动端优化清单](/notes/1)
  - [移动端渲染管线速查](/notes/4)
- **延伸阅读**
  - [Lumen 与 Nanite 的技术背景](/articles/2)`,
    cover: null,
    description: "Nanite 与 Lumen 在 PC 与移动端的可用性差异，以及项目层面的取舍依据。",
    categoryName: "UE5",
    is_free: false,
    sort: 2,
  },
  {
    id: 3,
    title: "GAS 技能系统入门",
    content: `# GAS 技能系统

- **核心概念**
  - Ability：一次可被激活的技能
  - Attribute：血量、蓝量等数值
  - Effect：对 Attribute 的修改
- **最小可用组合**
  - AttributeSet 承载数值
  - GameplayAbility 承载逻辑
  - GameplayEffect 承载数值变更
- **常见坑**
  - Ability 要在服务器激活
  - 表现与逻辑必须分离
- **相关笔记**
  - [资产命名规范](/notes/5)
- **延伸阅读**
  - [GAS 架构实践](/articles/3)`,
    cover: null,
    description: "Gameplay Ability System 的核心概念与最小可用组合，附两个常见坑。",
    categoryName: "GAS",
    is_free: true,
    sort: 3,
  },
  {
    id: 4,
    title: "移动端渲染管线速查",
    content: `# 移动端渲染管线速查

- **开启项**
  - Mobile HDR：按项目决定
  - Mobile Deferred：占用更多带宽
- **必关项**
  - Lumen Diffuse Indirect
  - 动态阴影层级不超过两级
- **性能目标**
  - 每帧 Draw Call < 800
  - 三角形 < 30 万
- **相关笔记**
  - [Unreal Engine 5 移动端优化清单](/notes/1)
  - [Nanite 与 Lumen 的取舍](/notes/2)`,
    cover: null,
    description: "移动端渲染管线的开关项与每帧性能目标，配合优化清单使用。",
    categoryName: "UE5",
    is_free: false,
    sort: 4,
  },
  {
    id: 5,
    title: "资产命名规范",
    content: `# 资产命名规范

- **前缀约定**
  - \`SM_\` 静态网格
  - \`M_\` 材质
  - \`T_\` 贴图
  - \`BP_\` 蓝图
- **目录约定**
  - 按类型分层，同类资源集中
  - 禁止在根目录堆资源
- **相关笔记**
  - [GAS 技能系统入门](/notes/3)`,
    cover: null,
    description: "引擎资产的命名前缀与目录分层约定，便于团队协作与资源检索。",
    categoryName: "工程规范",
    is_free: true,
    sort: 5,
  },
];

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface) {
    // 幂等：Notes 表已有数据时不再注入，避免重复执行 db:seed:all 灌入重复行。
    // ⚠️ 本项目没有配置 seederStorage（默认 none），cli 不记录哪些 seeder 跑过，
    //    每次 db:seed:all 都会重跑所有 seeder —— 这层判断不能省。
    const [existing] = await queryInterface.sequelize.query("SELECT id FROM Notes LIMIT 1");
    if (existing.length > 0) {
      console.log("Notes 表已有数据，跳过示例笔记注入");
      return;
    }

    /** 分类名 → id；分类树由 20261017000000-demo-categories 先建好 */
    const resolveCategoryId = async (name: string): Promise<number | null> => {
      const [rows] = await queryInterface.sequelize.query("SELECT id FROM Categories WHERE name = ? LIMIT 1", {
        replacements: [name],
      });
      const row = (rows as Array<{ id: number }>)[0];
      return row?.id ?? null;
    };

    const now = new Date();
    const rows: Array<Record<string, unknown>> = [];
    for (const note of DEMO_NOTES) {
      const { categoryName, ...rest } = note;
      rows.push({ ...rest, category_id: await resolveCategoryId(categoryName), createdAt: now, updatedAt: now });
    }

    await queryInterface.bulkInsert("Notes", rows);
    console.log(`已注入 ${DEMO_NOTES.length} 条示例笔记`);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.bulkDelete("Notes", { title: DEMO_NOTES.map((note) => note.title) });
  },
};
