"use strict";
import { QueryInterface, QueryTypes } from "sequelize";

interface DemoChapter {
  title: string;
  summary: string;
  content: string;
  sort: number;
}

interface DemoBook {
  title: string;
  description: string;
  /** 分类名；写入时解析成 category_id（分类由迁移建好） */
  categoryName: string;
  /** 标签名；写入时解析成 id 并写进 BookTags */
  tags: string[];
  is_free: boolean;
  sort: number;
  chapters: DemoChapter[];
}

/**
 * 示例书库
 *
 * 结构与参考站一致：书籍卡片 + 章节列表 + 章节正文。
 * 判重方式：书籍按标题、章节按「书籍标题 + 章节标题」，
 * 因此 `db:seed:all` 可以重复执行，也不会覆盖后台编辑过的内容。
 */
const DEMO_BOOKS: DemoBook[] = [
  {
    title: "SDL 与太空战机",
    description: "通过 SDL2 图形库学习 C++ 游戏开发基础，从零开始构建一款经典的太空射击游戏。掌握游戏循环、输入处理、图像渲染和音频播放等核心概念。",
    categoryName: "教程",
    tags: ["道藏"],
    is_free: true,
    sort: 1,
    chapters: [
      {
        title: "课程简介",
        summary: "了解本课程的学习内容与目标。",
        sort: 0,
        content: `## 你会做出什么

一门课带你从空目录开始，做出一个可玩的太空射击游戏：

- 游戏循环与固定时间步
- 键盘输入与玩家移动
- 子弹、敌机与碰撞检测
- 简单的粒子特效与音效

## 前置知识

需要会写基础的 C++（变量、函数、类）。不要求图形学基础。`,
      },
      {
        title: "环境配置",
        summary: "安装编译器、SDL2 与 CMake，跑通第一个窗口。",
        sort: 1,
        content: `## 安装依赖

\`\`\`bash
# Windows + vcpkg
vcpkg install sdl2 sdl2-image sdl2-mixer
\`\`\`

## 第一个窗口

\`\`\`cpp
SDL_Init(SDL_INIT_VIDEO);
SDL_Window* window = SDL_CreateWindow("Space Shooter", 0, 0, 1280, 720, 0);
\`\`\`

> 编译前确认 \`SDL2\` 的头文件与库路径都已经进入 CMake。`,
      },
      {
        title: "游戏循环与渲染",
        summary: "建立固定时间步的游戏循环，并画出第一帧画面。",
        sort: 2,
        content: `## 固定时间步

\`\`\`cpp
const double STEP = 1.0 / 60.0;
while (running) {
  double frameTime = now() - last;
  accumulator += frameTime;
  while (accumulator >= STEP) {
    update(STEP);
    accumulator -= STEP;
  }
  render();
}
\`\`\`

## 渲染顺序

1. 清屏
2. 背景（星空层）
3. 实体（玩家 / 子弹 / 敌机）
4. UI（分数 / 生命）`,
      },
      {
        title: "精灵与输入",
        summary: "加载纹理、绘制精灵，并处理键盘输入。",
        sort: 3,
        content: `## 加载纹理

\`\`\`cpp
SDL_Surface* surface = IMG_Load("assets/player.png");
SDL_Texture* texture = SDL_CreateTextureFromSurface(renderer, surface);
\`\`\`

## 输入

用「按键状态表」而不是事件驱动移动，才能支持同时按两个方向键：

\`\`\`cpp
const Uint8* keys = SDL_GetKeyboardState(nullptr);
if (keys[SDL_SCANCODE_LEFT]) player.x -= speed * dt;
\`\`\``,
      },
      {
        title: "碰撞与敌机",
        summary: "实现子弹与敌机的碰撞检测，并让敌机按波次刷新。",
        sort: 4,
        content: `## AABB 碰撞

\`\`\`cpp
bool intersects(const Rect& a, const Rect& b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}
\`\`\`

## 波次刷新

把敌机生成交给一个时间累加器：每 N 秒生成一批，难度随时间提高生成频率。`,
      },
      {
        title: "打包与发布",
        summary: "整理资源目录、生成发布包，并做一次性能检查。",
        sort: 5,
        content: `## 资源目录

\`\`\`text
assets/
  images/
  audio/
  levels/
\`\`\`

## 发布前检查

- [ ] Release 构建
- [ ] 资源路径使用相对路径
- [ ] 关闭调试控制台
- [ ] 在目标机型上跑满 60 FPS`,
      },
    ],
  },
  {
    title: "模块化编程与幽灵逃生",
    description: "学习 C++ 游戏开发中的模块化编程思想，使用 SDL3、GLM 数学库构建一款生存类游戏。掌握组件化设计、向量数学和资源管理等高级概念。",
    categoryName: "工具书",
    tags: ["易经"],
    is_free: false,
    sort: 2,
    chapters: [
      {
        title: "课程简介",
        summary: "深入了解本课程的学习内容和目标。",
        sort: 0,
        content: `## 课程目标

把「一个 main.cpp 打天下」的写法拆成可维护的模块：

- 场景（Scene）与实体（Entity）分离
- 组件化：位置、渲染、碰撞各自独立
- 资源管理器统一加载与缓存

## 最终成品

一款俯视角的幽灵逃生游戏，包含敌人追击、道具拾取与关卡切换。`,
      },
      {
        title: "环境配置",
        summary: "配置 SDL3、GLM 与构建系统。",
        sort: 1,
        content: `\`\`\`bash
vcpkg install sdl3 glm
\`\`\`

⚠️ SDL3 的 API 与 SDL2 不兼容，示例代码不要混用。`,
      },
      {
        title: "游戏框架设计",
        summary: "设计 Scene / Entity / Component 三层结构。",
        sort: 2,
        content: `## 三层结构

\`\`\`text
Game
 ├─ Scene（关卡）
 │   ├─ Entity（玩家 / 敌人 / 道具）
 │   │   ├─ TransformComponent
 │   │   ├─ SpriteComponent
 │   │   └─ ColliderComponent
 └─ ResourceManager
\`\`\`

这样新增一类敌人不需要改引擎代码，只需要组合组件。`,
      },
      {
        title: "玩家角色与摄像机",
        summary: "实现玩家移动与跟随摄像机。",
        sort: 3,
        content: `## 摄像机跟随

\`\`\`cpp
camera.position = lerp(camera.position, player.position, 0.1f);
\`\`\`

使用插值而不是直接赋值，画面会明显更顺滑。`,
      },
      {
        title: "敌人与战斗属性",
        summary: "给敌人加上追击 AI 与生命 / 攻击属性。",
        sort: 4,
        content: `## 追击 AI

\`\`\`cpp
glm::vec2 dir = glm::normalize(player.position - enemy.position);
enemy.position += dir * enemy.speed * dt;
\`\`\`

## 战斗属性

把生命、攻击、防御放进 \`StatsComponent\`，战斗系统只读这些数据，不关心具体是谁。`,
      },
    ],
  },
  {
    title: "分层架构与阳光岛",
    description: "学习 C++ 游戏开发中的分层架构设计，使用 SDL3、glm、nlohmann-json、Tiled 构建一款平台跳跃游戏。掌握现代游戏引擎的设计理念与现代 C++ 的最佳实践。",
    categoryName: "善书",
    tags: ["佛经", "真实故事"],
    is_free: true,
    sort: 3,
    chapters: [
      {
        title: "课程简介",
        summary: "了解分层架构的目标与最终项目形态。",
        sort: 0,
        content: `## 分层目标

- 表现层（渲染 / 音频）
- 逻辑层（物理 / 战斗）
- 数据层（关卡 / 配置）

任意一层替换都不影响另外两层。`,
      },
      {
        title: "分层架构总览",
        summary: "用接口隔离各层，并确定依赖方向。",
        sort: 1,
        content: `## 依赖方向

\`\`\`text
Game → Systems → Core
\`\`\`

底层只提供能力，不反向依赖上层。用纯虚接口做边界，方便单测替换实现。`,
      },
      {
        title: "资源管理",
        summary: "用 RAII 管理纹理、音频与 JSON 配置。",
        sort: 2,
        content: `\`\`\`cpp
class Texture {
 public:
  explicit Texture(const std::string& path);
  ~Texture();
  Texture(const Texture&) = delete;
  Texture& operator=(const Texture&) = delete;
};
\`\`\`

> 资源对象不可复制、只能移动，避免重复释放。`,
      },
      {
        title: "关卡与场景切换",
        summary: "解析 Tiled 地图，并实现场景淡入淡出。",
        sort: 3,
        content: `## 读取 Tiled 地图

使用 \`nlohmann-json\` 解析 \`.tmj\` 文件，把图层转成碰撞矩形与装饰精灵。

## 场景切换

先淡出、加载新场景、再淡入，避免加载卡顿直接暴露给玩家。`,
      },
    ],
  },
];

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface) {
    const now = new Date();

    /** 分类名 → id；分类由迁移 20261017000017 建好 */
    const resolveCategoryId = async (name: string): Promise<number | null> => {
      const rows = (await queryInterface.sequelize.query("SELECT id FROM BookCategories WHERE name = :name LIMIT 1", {
        type: QueryTypes.SELECT,
        replacements: { name },
      })) as Array<{ id: number }>;
      return rows[0]?.id ?? null;
    };

    /** 标签名 → id；标签由迁移 20261017000018 建好 */
    const resolveTagIds = async (names: string[]): Promise<number[]> => {
      if (names.length === 0) {
        return [];
      }
      const rows = (await queryInterface.sequelize.query("SELECT id FROM Tags WHERE name IN (:names)", {
        type: QueryTypes.SELECT,
        replacements: { names },
      })) as Array<{ id: number }>;
      return rows.map((row) => row.id);
    };

    for (const book of DEMO_BOOKS) {
      const existingBooks = (await queryInterface.sequelize.query(
        "SELECT id FROM Books WHERE title = :title LIMIT 1",
        { type: QueryTypes.SELECT, replacements: { title: book.title } },
      )) as Array<{ id: number }>;

      let bookId = existingBooks[0]?.id;
      if (bookId === undefined) {
        const categoryId = await resolveCategoryId(book.categoryName);
        await queryInterface.bulkInsert("Books", [
          {
            title: book.title,
            cover: null,
            description: book.description,
            category_id: categoryId,
            is_free: book.is_free,
            sort: book.sort,
            createdAt: now,
            updatedAt: now,
          },
        ]);

        const created = (await queryInterface.sequelize.query(
          "SELECT id FROM Books WHERE title = :title ORDER BY id DESC LIMIT 1",
          { type: QueryTypes.SELECT, replacements: { title: book.title } },
        )) as Array<{ id: number }>;
        bookId = created[0]?.id;

        // 标签关联只在新建书籍时写入，重复执行不会覆盖后台已调整的标签
        if (bookId !== undefined) {
          const tagIds = await resolveTagIds(book.tags);
          if (tagIds.length > 0) {
            await queryInterface.bulkInsert(
              "BookTags",
              tagIds.map((tagId) => ({ book_id: bookId, tag_id: tagId })),
            );
          }
        }
      }

      if (bookId === undefined) {
        throw new Error(`示例书籍「${book.title}」创建失败`);
      }

      // 示例书籍统一归入「默认分卷」；重复执行时复用已有分卷
      const volumeTitle = "默认分卷";
      const existingVolumes = (await queryInterface.sequelize.query(
        "SELECT id FROM Volumes WHERE book_id = :bookId AND title = :title LIMIT 1",
        { type: QueryTypes.SELECT, replacements: { bookId, title: volumeTitle } },
      )) as Array<{ id: number }>;

      let volumeId = existingVolumes[0]?.id;
      if (volumeId === undefined) {
        await queryInterface.bulkInsert("Volumes", [
          {
            book_id: bookId,
            title: volumeTitle,
            sort: 0,
            createdAt: now,
            updatedAt: now,
          },
        ]);
        const createdVolumes = (await queryInterface.sequelize.query(
          "SELECT id FROM Volumes WHERE book_id = :bookId AND title = :title ORDER BY id DESC LIMIT 1",
          { type: QueryTypes.SELECT, replacements: { bookId, title: volumeTitle } },
        )) as Array<{ id: number }>;
        volumeId = createdVolumes[0]?.id;
      }

      if (volumeId === undefined) {
        throw new Error(`示例书籍「${book.title}」的默认分卷创建失败`);
      }

      for (const chapter of book.chapters) {
        const existingChapters = (await queryInterface.sequelize.query(
          "SELECT id FROM Chapters WHERE book_id = :bookId AND title = :title LIMIT 1",
          { type: QueryTypes.SELECT, replacements: { bookId, title: chapter.title } },
        )) as Array<{ id: number }>;
        if (existingChapters.length > 0) {
          continue;
        }

        await queryInterface.bulkInsert("Chapters", [
          {
            book_id: bookId,
            volume_id: volumeId,
            title: chapter.title,
            summary: chapter.summary,
            content: chapter.content,
            sort: chapter.sort,
            createdAt: now,
            updatedAt: now,
          },
        ]);
      }
    }
  },

  async down(queryInterface: QueryInterface) {
    // Chapters 的外键是 ON DELETE CASCADE，删书即可连带删除章节
    await queryInterface.bulkDelete("Books", {
      title: DEMO_BOOKS.map((book) => book.title),
    });
  },
};
