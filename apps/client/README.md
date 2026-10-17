# client —— 前台展示端

Vue 3 + TypeScript + Vite + Element Plus。面向公众的展示端：时间轴首页、攻略笔记卡片墙（思维导图）与文章详情（markdown）。

## 启动

```bash
npm run dev:client       # 仓库根目录
```

**需要后端在 3000 端口运行**（`npm run dev:server`）。客户端的读接口是公开的，无需登录。

## 路由

| 路径            | 名称            | 说明                                             |
| :-------------- | :-------------- | :----------------------------------------------- |
| `/`             | —               | 重定向到 `/timeline`                             |
| `/timeline`     | Timeline        | **时间轴**：纵向、以年为单元的事件轴              |
| `/home`         | —               | 旧首页路径，重定向到 `/timeline`（兼容旧书签）   |
| `/notes`        | Notes           | **攻略笔记卡片墙**：卡片网格，点击进入详情        |
| `/notes/:id`    | NotesDetail     | **笔记详情**：只读渲染思维导图（markmap） |
| `/articles`     | ArticlesLibrary | **文章库**：搜索框 + 分类标签 + 结果列表            |
| `/articles/:id` | ArticlesDetail  | **文章详情**：只读渲染 markdown 正文              |

### 面包屑

没有硬编码的「首页」。面包屑的分区由**路由表里的 `meta.section`** 决定，格式统一为 `英文 / 中文`：

| 路由 | 面包屑 |
| :--- | :--- |
| `/timeline` | `■ TIMELINE / 时间轴` |
| `/notes` | `■ NOTES / 攻略笔记` |
| `/notes/:id` | `■ NOTES / 攻略笔记 › 笔记标题` |
| `/articles/:id` | `■ ARTICLES / 文章库 › 文章标题` |

- 分区落地页（`section.to === route.path`）不重复显示标题；详情页才追加。
- `section.to` 省略表示该分区没有列表页（文章目前只有详情页），此时分区名不可点击。
- 详情页的标题仍从 `?title=` 取，**不再需要 `?parent=`** —— 分区已经写在路由表里，
  从外部直接粘链接进来也能得到完整面包屑。
- 新增页面时在路由 meta 里补一个 `section` 即可，类型见 [`src/types/router.d.ts`](src/types/router.d.ts)。

### 顶部导航

导航项同样从路由表派生：`meta.section` 上带 `navOrder` 的路由会进入顶部导航（按 `navOrder` 升序排列），
文案取 `section.zh`，链接取 `section.to`。详情页共用所属分区的 `section` 但不带 `navOrder`，
所以不会混进导航。

- `/timeline`：`section.navOrder = 1`，文案「时间轴」
- `/notes`：`section.navOrder = 2`，文案「攻略笔记」
- `/articles`：`section.navOrder = 3`，文案「文章库」

> ⚠️ **选中态没有用 `router-link` 自带的 `.router-link-active`**。vue-router 的判定是
> 「链接目标的路由记录是否出现在当前 `currentRoute.matched` 里」；`/notes` 与 `/notes/:id`
> 是**兄弟**记录而不是父子，所以在详情页里 `/notes` 的链接不会被判定为 active。
> Header 改为按 `meta.section.en` 与导航项的 `section` 比对，详情页因此仍能正确高亮。

> ⚠️ 导航顺序必须由 `navOrder` 决定：`router.getRoutes()` 的返回顺序由匹配器决定，
> 与路由表声明顺序无关（动态参数路由会排在静态路由前面）。

### 时间轴

`/timeline` 是站点首页：**纵向、以年为单元**的事件轴。

- 数据源是 `GET /api/admin/timeline`（公开读接口，**不分页**）。服务端已按
  `year DESC, sort ASC, createdAt ASC` 排好，页面再用 `Map` 按年聚合并按年份倒序输出。
- 每一年的左侧是年份标签（宽屏下 `position: sticky` 吸顶），右侧是一列事件卡片；
  轴线上的橙色节点与卡片一一对应。
- 卡片内容：标题、描述，以及**可选的自定义按钮（可以有多个，最多 5 个）**。
  按钮来自接口的 `buttons` 数组，顺序即展示顺序：
  - 站内路径（以单个 `/` 开头）→ `router-link`，不整页刷新
  - 其他 → `<a target="_blank" rel="noopener noreferrer">`，新标签页打开
  - 按钮渲染在 `TimelineButtonLink.vue` 里，窄屏自动换行。
  - ⚠️ 协议白名单由**服务端**保证（只放行站内路径与 `http(s)`），前端只按路径形态分流，
    不重复做安全判断。
- 窄屏（≤768px）下年份移到卡片上方，轴线与节点保留。

> ⚠️ 原来的首页 `/home`（markmap 演示）已替换为时间轴，`views/Home.vue` 一并删除；
> 旧书签 `/home` 会重定向到 `/timeline`。

### 文章库

`/articles` 是一个搜索优先的列表页：大搜索框 + 分类标签 + 结果列表。

- **搜索**走 `GET /api/admin/article?keyword=` / `?category_id=`，单次最多 100 条（与 server 的 `MAX_PAGE_SIZE` 对齐）。
- **模糊匹配由服务端负责**：`keyword` 会被转义后包成 `LIKE %keyword%`，命中标题、描述、正文，
  所以输入 `移动端渲` 也能搜到《移动端渲染管线详解》。
- **输入即搜**：`@input` 后防抖 300ms 自动查询，不必回车；回车 / 点「搜索」会立即查询。
  清空输入框回到分类标签。
  - ⚠️ 用 `@input` 而不是 `watch(keyword)`：分类标签会以代码方式改写 `keyword`，
    用 watch 会连带触发一次自动搜索，还要额外处理时序。
  - 并发请求用请求序号去重，只采纳最后一次的响应，避免慢请求覆盖新结果。
- **命中高亮**：结果标题与描述中匹配关键词的片段用 `<mark class="hit">` 标出（大小写不敏感，
  正则元字符已转义）。按分类筛选时关键词为空，不做高亮。
- **分类标签**的数据源是 `GET /api/admin/category`（真实分类树），不硬编码，也不从文章里反推分类名。
  没有分类时显示「暂无分类」。
- **两级联动**：第一行是根分类；点击根分类会展开它的直接子分类（第二行，左侧竖线表示归属），
  更深层级**不在界面上渲染**。点击任意一级都按 `category_id` 筛选，
  服务端会**命中该分类及其全部子分类**，所以点根分类等价于「这个大类下的全部文章」。
  - 当前筛选的标签是实心主色；仅处于展开状态的根分类是浅色底，两者可以区分。
  - ⚠️ **分类筛选期间分类区不隐藏**（与关键词搜索不同）。否则点完根分类立刻切到结果页，
    第二行永远没机会被点到。关键词搜索仍然让位给结果列表。
  - 「返回」会同时收起展开状态，回到初始浏览态。
- 点击结果进入 `/articles/:id?title=<标题>`，详情页的面包屑据此显示标题。

### 文章详情页：前往笔记

文章表有可选的 `note_id`。**只有当文章关联了笔记时**，详情页标题上方才出现一个
「← 前往笔记」的主色文字链接（无边框，样式对齐参考站），点击进入 `/notes/:id`。

- 链接文案与目标都来自接口：`note_id` 决定是否显示，`note_title`（服务端由关联查出）作为
  `?title=` 传给笔记详情页，让面包屑直接显示笔记标题而不是「笔记详情」。
- `note_id` 为 `null`（未关联 / 关联的笔记已被删除）时整条链接不渲染。
  ⚠️ 外键是 `ON DELETE SET NULL`，删除笔记后文章不会失效，只是少一个入口。

> ⚠️ 历史搜索已按需求移除，`composables/useSearchHistory.ts` 一并删除。
> 若以后要加回来，注意它属于 composable 层，不要直接写进视图。

### 文章详情页：悬浮目录

文章正文用 `<Markdown ... mode="previewOnly" toc-mode="auto" />` 渲染：**即使内容里没有
`[TOC]`，也会根据 H1–H6 自动生成目录**。

- 正文列最大 `820px` 并水平居中。
- 目录固定在预览区左侧（`left: 0`，相对预览区而非浏览器视口）、垂直居中
  （`top: 50%`），是半透明磨砂浮层，覆盖在正文之上但不挤占正文；页面滚动时保持不动。
- 分栏编辑时目录相对预览面板定位，不会跑到左侧源码编辑区。
- 点 `«` 收起后变成左侧垂直居中的小列表按钮，再点展开。
- 点击目录项平滑滚动到对应标题，滚动时自动高亮当前标题。
- 标题锚点由渲染器统一生成（`md-heading-*` 前缀），不会和页面已有 id 冲突。
- 内容里已经写了 `[TOC]` 时按标记位置渲染，`auto` 不会再插一份。
- 需要关闭自动目录时改用 `toc-mode="marker"`；目录样式由
  [`@zhangxianjue/markdown`](../../packages/markdown/) 提供，client 只覆盖手绘外框。

### 笔记详情页：节点内链接

思维导图的节点支持 Markdown 链接，点击即可跳转：

```md
# UE5 移动端优化

- [渲染管线](/notes/2)
  - [使用 Mobile HDR 关闭](/notes/3)
- **延伸阅读**
  - [移动端渲染管线详解](/articles/1)
```

站内链接可以指向任意已注册路由，所以**笔记 → 笔记**（`/notes/:id`）和
**笔记 → 文章**（`/articles/:id`）用的是同一套机制，不需要额外代码。

- 组件会把链接渲染成真实的 `<a href>`，站内链接的文本前会带 `→`、外链后带 `↗`（见 `linkIcons` 选项）。
- `NotesDetail` 接管了 `link-click`：**站内链接**用 `router.push` 跳转，不会整页刷新；
  **外链**（`http(s)://`、`//`）、`mailto:`、`#锚点` 保留浏览器默认行为。
- ⚠️ 站内链接必须写成 `/notes/2` 这样的**绝对路径**。写成 `notes/2` 会被 vue-router
  按相对路径解析成 `/notes/notes/2`。
- ⚠️ 目标路由不存在时只弹提示、不跳转 —— client 没有兜底 404 路由，跳过去会让 `router-view` 白屏。

## 视觉风格：手绘风

全站统一为手绘风，视觉语言与 `@zhangxianjue/markmap` 的思维导图同源
（参考 `packages/markmap/image.png`）：

- **色板**：暖白纸面 + 深墨 `#2F3542` 描边；蓝色 `#4C72B0` 为主色，橙色 `#DD8452` 只做点级强调
  （分类标签、面包屑方块、摘要左侧笔触、搜索命中高亮）。
- **笔触**：边框用八向不等半径 `--sketch-radius` 模拟手画的歪斜矩形，配 `4px 4px 0` 的错位投影；
  标题下划线与顶部导航选中态是 SVG 波浪线（`--squiggle`，用 `mask` 上色，深浅色自动适配）。
- **纸面**：`body` 用极淡的点阵底（`radial-gradient`），不额外加载图片。
- **品牌图标**：[`public/favicon.svg`](public/favicon.svg) 同时用作浏览器 favicon 与顶部品牌图标
  —— 一枚「柑橘生命周期环」（腐烂 → 干枯 → 种子 → 发芽 → 开花 → 青果 → 黄果 → 熟果），
  8 个阶段顺时针排列、墨线描边。改一处，标签页与页头同时生效。

### 复用入口

全部令牌与工具类在 [`src/assets/css/style.css`](src/assets/css/style.css)：

| 名称 | 用途 |
| :--- | :--- |
| `--sketch-radius` / `--sketch-radius-sm` | 手绘描边的圆角 |
| `--sketch-shadow` | 错位投影颜色 |
| `--squiggle` | 手绘波浪线（作为 `mask` 使用） |
| `.sketch-box` | 一块歪斜的纸片（卡片 / 输入框 / 图片容器） |
| `.sketch-underline` | 标题下的蓝色波浪线 |
| `.sketch-marker` | 小标题前的橙色手绘方块 |

> ⚠️ **`style.css` 必须晚于 Element Plus 引入**（见 `main.ts`）。文件里的 `:root` 覆盖了 EP 的
> `--el-color-primary` 等主题变量，引入顺序反了会被 EP 自己的样式盖回去，手绘风整体失效。

> ⚠️ 该约定**只作用于 client**；`apps/admin` 仍保持 Element Plus 默认的克制风格。

## 目录结构

```bash
src
├── api             # 接口层：timelineService、articleService、noteService、categoryService
├── components      # 组件层：Header、Layout、Breadcrumb
├── router
├── services        # 请求基础设施：apiConfig / apiError / http
├── types           # 类型声明
├── util            # 纯函数：formatDate、addParentToMarkdownLinks
└── views           # 视图层：Timeline、Notes（卡片墙）、NotesDetail（思维导图）、ArticlesLibrary、Articles（详情）
```

## 数据来源

全部来自 server 的公开读接口（无需登录）：

| 用途         | 接口                                 |
| :----------- | :----------------------------------- |
| 时间轴       | `GET /api/admin/timeline`            |
| 文章列表     | `GET /api/admin/article`             |
| 分类树       | `GET /api/admin/category`            |
| 文章详情     | `GET /api/admin/article/:id`         |
| 笔记列表     | `GET /api/admin/note`                |
| 笔记详情     | `GET /api/admin/note/:id`            |

> ⚠️ 读接口目前挂在 `/admin/...` 前缀下（与管理端共用），语义上不够贴切。
> 若要拆出独立的公共读接口，需要同时改 server 的路由挂载与 Swagger 注释，并回归 admin 与 client 两个消费端。

> ⚠️ **笔记列表接口不返回 `content`**（思维导图正文动辄数 KB），卡片页只用元数据字段。
> 因此列表项的类型是 `NoteListItem` 而非 `Note`，类型系统会拦住「在列表里读正文」的写法；
> 正文由详情页按 id 单独拉取。

## 攻略笔记卡片墙

布局参考 cppgamedev.top/mainline：页头（绿色小方块 + 小字标签 + 大标题 + 副标题）+
自适应卡片网格。卡片自上而下是 16:9 封面、`01 / 攻略笔记` 序号、分类标签、标题、
三行截断的描述，底部一条分隔线，左「更新于」右「查看笔记 →」。

- 网格用 `repeat(auto-fill, minmax(260px, 1fr))`，列数随容器宽度自适应，无需 media query。
  client 的 `Layout.vue` 把页面放在 `el-col :sm="16"`（2/3 宽）里，所以列数不能写死。
- 配色走全局的 `--brand-*` 与手绘令牌（见「视觉风格」），页面内只做别名，避免影响其它页面。

> ⚠️ 详情页的思维导图容器**必须给确定高度**（`65vh`）——`MarkmapSketch` 内部按 `height: 100%`
> 计算画布，父级没有高度时画布会塌成 0。这与文章详情页「markdown 不给固定高度」的结论相反：
> markdown 是文档流随页面滚动，思维导图是画布式组件。

## 两个体积相关的约定

- **重型可视化组件一律局部引入，不在 `main.ts` 全局注册**。markmap（含 d3 / rough.js）与
  markdown 编辑器（含 markdown-it / katex / dompurify）都是如此，否则会被打进入口包
  —— 入口包曾因此达到 6.3 MB，改为懒加载后降到约 1.0 MB。
- 图片地址（文章封面）以相对路径存储，展示前必须经 `services/apiConfig.ts` 的
  `resolveAssetUrl()` 拼接接口 origin。

## 构建

```bash
npm run build -w client  # vue-tsc -b && vite build
```

> 注意 `tsconfig.app.json` 中的 `paths` 必须与 `vite.config.ts` 的 `resolve.alias` 保持一致。
