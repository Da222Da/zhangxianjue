"use strict";
import { QueryInterface, DataTypes } from "sequelize";

interface DemoArticle {
  id: number;
  title: string;
  content: string;
  cover: string | null;
  description: string;
  /** 分类名；写入时解析成 category_id（分类树由 demo-categories 先建好） */
  categoryName: string;
  sort: number;
}

/**
 * 示例文章
 *
 * 与示例笔记配合使用：笔记思维导图的「延伸阅读」分支会链接到这里的文章
 * （`[标题](/articles/N)`），用来演示「笔记 → 文章」的跳转。
 *
 * ⚠️ `id` 写死为 1–3：笔记里的链接指向这些 id，若由自增分配，
 * 一旦库里已有其它文章（例如一条遗留的测试数据）id 就会错位，链接随之失效。
 * 显式指定 id 在 AUTO_INCREMENT 尚未走到时是安全的。
 */
export const DEMO_ARTICLES: DemoArticle[] = [
  {
    id: 1,
    title: "移动端渲染管线详解",
    content: `# 移动端渲染管线详解

移动端与 PC 的差异主要来自**带宽**与**功耗**，而不是算力。

## 一、管线阶段

1. 应用阶段：剔除、排序、提交 Draw Call
2. 几何阶段：顶点变换、裁剪
3. 光栅化：片元生成
4. 像素阶段：着色、混合

## 二、移动端的三个限制

- **Tile-based GPU**：片上缓存，过度绘制代价高
- **带宽**：每帧读写 GBuffer 非常昂贵
- **功耗**：持续高负载会降频

## 三、常用开关

\`\`\`ini
; 关闭移动端 HDR
r.MobileHDR=0

; 限制阴影层级
r.Shadow.MaxCSMResolution=1024
\`\`\`

## 四、验收指标

| 指标 | 目标 |
| :--- | :--- |
| 帧率 | 30 FPS 稳定 |
| Draw Call | < 800 |
| 峰值内存 | < 1.5 GB |
`,
    cover: null,
    description: "从管线阶段讲到移动端的三个硬约束，附常用控制台开关与验收指标。",
    categoryName: "UE5",
    sort: 1,
  },
  {
    id: 2,
    title: "Lumen 与 Nanite 的技术背景",
    content: `# Lumen 与 Nanite 的技术背景

## Nanite

虚拟化几何体（Virtualized Geometry）把模型拆成簇，
只光栅化屏幕上可见、且误差允许的那部分。

- 依赖 Compute Shader，要求 SM5 及以上
- 高模不再需要手工 LOD
- 代价是包体与磁盘 IO

## Lumen

基于距离场与屏幕空间追踪的动态全局光照。

- 软件光追在移动端默认关闭
- 动态 GI 换静态烘焙，通常可省 30% 以上帧时间
- 对场景尺度敏感，小物件容易漏光

## 结论

两者都是**面向 PC / 次世代主机**的方案。
移动端项目应把它们当作「未来选项」，而不是标配。
`,
    cover: null,
    description: "Nanite 虚拟几何体与 Lumen 动态 GI 的原理、限制与适用场景。",
    categoryName: "UE5",
    sort: 2,
  },
  {
    id: 3,
    title: "GAS 架构实践",
    content: `# GAS 架构实践

Gameplay Ability System 把「能力」「数值」「效果」拆成三个独立概念。

## 三件套

| 概念 | 职责 |
| :--- | :--- |
| AttributeSet | 承载血量、蓝量等数值 |
| GameplayAbility | 承载技能逻辑 |
| GameplayEffect | 承载数值变更 |

## 最小可用组合

1. 定义 AttributeSet 并注册到 Owner
2. 用 GameplayAbility 描述一次技能
3. 通过 GameplayEffect 修改数值

## 两个常见坑

- **技能要在服务器激活**：客户端只做预测，权威在服务端
- **表现与逻辑分离**：动画、特效由 GameplayCue 负责，不要写进 Ability

\`\`\`cpp
// 激活技能的最小调用
AbilitySystemComponent->TryActivateAbilityByClass(AbilityClass);
\`\`\`
`,
    cover: null,
    description: "GAS 三件套的职责划分、最小可用组合，以及两个高频踩坑点。",
    categoryName: "GAS",
    sort: 3,
  },
];

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface) {
    // 幂等：按 id 判重逐条插入，避免重复执行 db:seed:all 时主键冲突
    // ⚠️ 本项目未配置 seederStorage（默认 none），cli 不记录已执行的 seeder，
    //    每次 db:seed:all 都会重跑，这层判断不能省。
    /** 分类名 → id；分类树由 20261017000000-demo-categories 先建好 */
    const resolveCategoryId = async (name: string): Promise<number | null> => {
      const [rows] = await queryInterface.sequelize.query("SELECT id FROM Categories WHERE name = ? LIMIT 1", {
        replacements: [name],
      });
      const row = (rows as Array<{ id: number }>)[0];
      return row?.id ?? null;
    };

    const now = new Date();
    let inserted = 0;

    for (const article of DEMO_ARTICLES) {
      const [existing] = await queryInterface.sequelize.query("SELECT id FROM Articles WHERE id = ?", {
        replacements: [article.id],
      });
      if (existing.length > 0) {
        continue;
      }

      const { categoryName, ...rest } = article;
      await queryInterface.bulkInsert("Articles", [
        { ...rest, category_id: await resolveCategoryId(categoryName), createdAt: now, updatedAt: now },
      ]);
      inserted += 1;
    }

    console.log(inserted > 0 ? `已注入 ${inserted} 条示例文章` : "示例文章已存在，跳过注入");
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.bulkDelete("Articles", { id: DEMO_ARTICLES.map((article) => article.id) });
  },
};
