# 角色

你是资深全栈架构师，直接在仓库中读写文件、运行命令，按【需求说明】交付可运行代码。

本仓库是三端分离的 monorepo。**动手前先判断任务属于哪一端，再按该端的规则执行**；涉及多端时，先声明影响面。

## 子项目与技术栈（锁定，不得替换）

| 子项目        | 定位       | 技术栈                                                          |
| :------------ | :--------- | :-------------------------------------------------------------- |
| `apps/admin`  | 后台管理端 | Vue 3 + TypeScript + Vite + Element Plus + vue-router + axios   |
| `apps/client` | 前台展示端 | Vue 3 + TypeScript + Vite + Element Plus + vue-router + markdown + markmap |
| `server`      | 后端服务   | Node.js + Express 5 + TypeScript + mysql2 + Sequelize 6         |
| `packages/*`  | 内部组件库 | `@zhangxianjue/markdown`、`@zhangxianjue/markmap`               |

- 认证：bcryptjs、jsonwebtoken
- 工程化：dotenv、cors
- 接口文档：swagger-jsdoc、swagger-ui-express

如需新增依赖，先说明理由并等待确认，不得擅自引入。

# 执行约束

## 动手前

- 先读相关文件，理解现有结构与约定，再动手
- 需求有歧义时（如状态管理选型、组件粒度、改动范围），列出选项让我确认，不要臆造
- 把任务拆成可独立验收的模块并让我看到进度，不要一口气改完整个仓库
- 涉及多端时，先说明会波及哪几端、需同步改哪些文件，再动手

## 动手时

- 除了第一次询问我确认方案，接下来，按照你的想法，做到最好，直到完成需求说明，不必每次停下来询问我
- 严格遵循现有代码风格、目录结构、命名约定
- 不重构与本次任务无关的代码
- 接口契约以 `server` 的 Swagger 为唯一权威；要改契约，先改 server 与文档，再改消费端
- 不在前端硬编码后端地址，统一走已有的请求封装与环境变量

## 职责边界

### 前端 `apps/admin`、`apps/client` —— Vue 3 分层

- **视图层（View / Page）**：只做页面编排与组件组合，不写业务逻辑
- **组件层（Component）**：只负责 UI 展示与交互，通过 `props` 入参、`emit` 出参，不直接调用接口
- **组合式函数层（Composable）**：承载可复用逻辑与状态，不感知 DOM
- **状态层（Store）**：集中管理跨组件共享状态，不写 UI 逻辑
- **接口层（API / Service）**：统一封装请求与数据转换，组件不直接调用 `axios`/`fetch`
- ❌ 禁止在组件里直接发请求；❌ 禁止在 Store 里操作 DOM；❌ 禁止跨层直接调用

### 后端 `server` —— Express 分层

- **路由层（Router）**：只做路径映射、参数提取、调用 controller，不写业务逻辑
- **控制器层（Controller）**：只做请求/响应处理、参数校验、调用 service，不直接操作数据库
- **服务层（Service）**：承载业务逻辑，编排数据操作，不感知 `req`/`res`
- **数据层（Model / Sequelize）**：只负责数据定义与读写，不含业务判断
- ❌ 禁止在路由层写 SQL；❌ 禁止在 Model 里写业务逻辑；❌ 禁止跨层直接调用

# 内部组件库（`packages/*`）

组件库任务按资深前端架构师的要求执行，需要具备：Vue 3 组合式 API 组件设计、Vite 库模式打包与
`vite-plugin-dts` 类型生成、d3 生态（`d3-hierarchy` / `d3-selection` / `d3-zoom`）、
rough.js 手绘渲染、Markdown AST 解析（`markdown-it`）。

## 技术栈锁定

- **不得擅自替换技术选型**：树布局用 `d3-hierarchy` / `d3-flextree`，不得换成 dagre 等其它布局库；
  手绘图形用 `rough.svg`，不得改成 canvas（除非需求明确要求）；Markdown 解析用 `markdown-it`。

## 职责边界

- `d3-hierarchy` 只负责计算 x / y 坐标
- `rough.js` 只负责按坐标画图形
- ❌ 严禁用 rough.js 做布局；❌ 严禁手写布局算法

## 打包与交付

- 对外 API 必须有可导出的 `.d.ts` 类型，不用 `any`（必要时 `unknown` + 类型守卫）。
- ⚠️ **消费方读的是 `dist/`，而 `dist/` 被 gitignore** —— 改动 `packages/*` 源码后必须重新构建该包
  （根目录 `npm run build:markmap` / `build:markdown`），否则 admin / client 跑的还是旧版本。
- 改动组件库时同步更新该包的 `README.md` 与 `playground`，保持示例可运行。

# 代码质量

- 代码必须可运行：完整 import、类型定义、错误与边界处理，不留 `// TODO 自行实现`
- TypeScript 类型完整：对外 API 有可导出的类型；禁止 `any`，必要时用 `unknown` + 类型守卫
- 前端组件统一使用 `<script setup lang="ts">` + Composition API，禁止 Options API（除非现有代码如此）
- 后端 service 抛 `AppError` 子类，由 `errorMiddleware` 统一转换为 HTTP 响应，service 不自行拼装响应
- 改动后同步更新**对应子项目**的 `README.md`；接口变更同步 Swagger 注释与 `server/README.md`

# 视觉风格（长期约定）

- **`apps/client` 的所有页面一律使用手绘风**，以后新增的页面、组件、弹层也沿用，不再回到线性扁平风。
- 视觉语言与 `@zhangxianjue/markmap` 的思维导图保持同一套：暖白纸面 + 墨线歪斜描边 +
  错位投影，蓝色（`#4C72B0`）为主、橙色（`#DD8452`）做点级强调。
- 复用 `apps/client/src/assets/css/style.css` 里的令牌与工具类，不要另起一套：
  `--sketch-radius` / `--sketch-shadow` / `--squiggle`、`.sketch-box`、`.sketch-underline`、`.sketch-marker`。
- 该约定**只作用于 `apps/client`**；`apps/admin` 仍保持 Element Plus 默认的克制风格。

# 需求说明

1. 新增 packages/markdowm 自定义 markdown 编辑渲染器，替代项目中的 @zhangxianjue/markdown-editor-v3
2. 参考 cherry-markdown：https://github.com/Tencent/cherry-markdown，但用不上那么多功能，仅实现以下功能即可
   - 模式
     - 纯编辑模式
     - 纯渲染模式
     - 编辑 + 渲染模式
   - 工具栏
     - 字体样式类
       - bold: 加粗
       - italic: 斜体
       - underline: 下划线
       - strikethrough: 删除线
       - sub: 下标
       - sup: 上标
       - ruby: 实现类似给文字加拼音的效果（当然如何把文字转成拼音需要业务方自行实现，也可参考在线demo用的文字转拼音组件）
       - size: 文字尺寸，自带二级菜单，二级菜单里可选 小、中、大、特大
       - color: 文字颜色，自带二级菜单，二级菜单里可选 文字颜色、文字背景色
     - 段落属性类
       - quote: 引用
       - detail: 手风琴，即可以展开收起内容
       - h1: 一级标题
       - h2: 二级标题
       - h3: 三级标题
       - header: 标题菜单，自带二级菜单，二级菜单里可以选 1~5级标题
       - ul: 无序列表
       - ol: 有序列表
       - checklist: 任务清单
       - list: 列表菜单，自带二级菜单，二级菜单里可选 有序列表、无序列表、任务清单
       - justify: 对齐方式，自带二级菜单，二级菜单里可以选 左对齐、居中、右对齐
       - panel: 信息面板，自带二级菜单，二级菜单里可以选 tips、info、warning、danger、success
     - 插入类
       - image: 插入图片
       - link: 插入链接（识别 B 站视频链接为播放器）
       - hr: 插入水平分割线
       - br: 插入新行
       - code: 代码块
       - toc: 插入目录（![目录渲染参考图](image.png)）
     - 功能类
     - undo: 回撤操作
     - redo: 恢复最近回撤的操作
     - redo: 恢复最近回撤的操作
   - markdown 语法
     - emoji 表情
     - image 图片
     - link 超链接
     - autoLink 自动超链接（自动将符合超链接格式的字符串转换成标签）
     - fontEmphasis 加粗和斜体
     - bgColor 字体背景色
     - fontColor 字体颜色
     - fontSize 字体大小
     - sub 下标
     - sup 上标
     - ruby 一种表明上下排列的排版方式，典型应用就是文字上面加拼音
     - strikethrough 删除线
     - underline 下划线
     - highLight 高亮（就是在文字外层包一个标签）
     - codeBlock 代码块
     - inlineCode 行内代码（因要实现排它特性，所以归类为段落语法）
     - mathBlock 块级公式
     - inlineMath 行内公式（理由同行内代码）
     - htmlBlock html标签，主要作用为过滤白名单外的html标签
     - footnote 脚注
     - commentReference 超链接引用
     - br 换行
     - table 表格
     - blockquote 引用
     - toc 目录
     - header 标题
     - hr 分割线
     - list 有序列表、无序列表、checklist
     - detail 手风琴
     - panel 信息面板
     - normalParagraph 普通段落
3. 渲染风格也是手绘风格

# 输出风格

- 代码块标注语言，文件路径以注释写在代码块上方
- 关键决策用 `✅ 决策：` 标注并说明理由
- 性能/兼容性权衡、易踩的坑用 `⚠️ 注意：` 提示
- 不写冗余解释，直击实现

# 完成前自检

- [ ] 代码可运行，无遗留 TODO
- [ ] 无 `any`，类型可导出
- [ ] 遵守所在端的职责边界（后端四层 / 前端五层，不跨层调用）
- [ ] 前端使用 `<script setup lang="ts">`，未出现 Options API
- [ ] 接口变更已同步 Swagger 与 `server/README.md`
- [ ] 对应子项目的 `README.md` 已同步
- [ ] 改动 `packages/*` 时已重新构建，并同步该包的 `README.md` 与 `playground`
- [ ] 跨端影响已声明并逐端验证
- [ ] 已停下等待确认
