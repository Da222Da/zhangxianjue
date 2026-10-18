# client —— 前台展示端

Vue 3 + TypeScript + Vite + Element Plus + Pinia。面向公众的展示端：时间轴首页、攻略笔记卡片墙（思维导图）、文章详情（markdown）、书库（书籍列表 + 分卷章节阅读），以及手机号登录注册、找回密码、个人中心与移动端响应式导航。

## 启动

```bash
npm run dev:client       # 仓库根目录
```

**需要后端在 3000 端口运行**（`npm run dev:server`）。大部分读接口是公开的；
书库列表与笔记列表游客也能看，但「VIP」标记的正文与个人中心需要登录 / 对应权益。

演示账号（`db:seed:all` 写入，统一密码 `abc123456`）：

| 手机号 | 用户名 | 角色 | 阅读 VIP 内容 |
| :--- | :--- | :--- | :--- |
| `13800000001` | 会员小雨 | 会员 | ✅ |
| `13800000002` | 朋友阿星 | 朋友 | ✅ |
| `13800000003` | 普通小林 | 普通用户 | ❌（限免内容可读，可申请会员） |

## 路由

| 路径            | 名称            | 说明                                             |
| :-------------- | :-------------- | :----------------------------------------------- |
| `/`             | —               | 重定向到 `/timeline`                             |
| `/login`        | Login           | **手机号登录**：独立整页卡片，图形验证码          |
| `/register`     | Register        | **注册**：手机号 + 图形验证码，成功即登录         |
| `/forgot-password` | ForgotPassword | **找回密码**：手机号 + 图形验证码 + 新密码      |
| `/account`      | Account         | **个人中心**：账号信息 / 修改密码 / 会员申请（需登录） |
| `/library`      | Library         | **书库**：书籍卡片墙（公开；VIP 书籍只展示卡片）  |
| `/library/:id`  | LibraryDetail   | **书籍阅读**：分卷章节导航 + Markdown 正文（限免公开，VIP 需 `library:view`） |
| `/timeline`     | Timeline        | **时间轴**：纵向、以年为单元的事件轴              |
| `/home`         | —               | 旧首页路径，重定向到 `/timeline`（兼容旧书签）   |
| `/notes`        | Notes           | **攻略笔记卡片墙**：卡片网格，点击进入详情        |
| `/notes/:id`    | NotesDetail     | **笔记详情**：只读渲染思维导图（markmap） |
| `/articles`     | ArticlesLibrary | **文章库**：搜索框 + 分类标签 + 结果列表            |
| `/articles/:id` | ArticlesDetail  | **文章详情**：只读渲染 markdown 正文              |

### 登录 / 注册 / 找回密码

页头右侧是账号入口（桌面端显示「登录 / 注册」，登录后变成头像 + 用户名下拉）：

- **手机号或用户名 + 密码 + 图形验证码**登录；注册使用「用户名 + 手机号 + 密码 + 图形验证码」。
- 登录框只有一个「手机号 / 用户名」输入：
  - 输入符合大陆手机号格式（`1[3-9]` 开头、11 位）→ 按 `phone` 提交；
  - 其它内容 → 按 `username` 提交；
  - 纯数字但不是合法手机号时直接提示「手机号格式不正确」，避免被当成用户名去试。
- 管理员账号已绑定手机号 `15826653490`，可用手机号或用户名登录 client；
  走正常页面登录时仍需要图形验证码（自动登录走下面的开发接口）。
- **本地开发自动登录**：`apps/client/.env` 设置 `VITE_DEV_AUTO_LOGIN=true`，
  并填入 `VITE_DEV_AUTO_LOGIN_PHONE` + `VITE_DEV_AUTO_LOGIN_PASSWORD`
  （也可留空，回退到 server/.env 的 `DEV_LOGIN_*`）。开发模式下打开登录页会自动登录。
  它调用 `/api/auth/dev/login`，接口只在本机回环地址可用，生产构建不会触发。
  退出登录后本次标签页不再自动登录。`.env` 已被 gitignore，**不要用于生产构建**。
- 图形验证码由 `GET /api/auth/captcha` 签发，`CaptchaField.vue` 只负责展示与输入；
  一次性的，提交失败后会自动换一张。
- 注册成功**直接建立会话**（服务端同时返回双令牌），不需要再登录一次。
- 找回密码走「手机号 + 图形验证码 + 新密码」；⚠️ 当前只靠图形验证码校验身份，
  仅适合演示环境，生产必须追加短信或其它二次验证。
- 登录 / 注册 / 找回密码都是**独立整页**（不套 `Layout`），切页时保留 `?redirect=`。
- 登录成功后跳回 `?redirect=` 指向的站内路径，缺省回 `/timeline`。
- ⚠️ `?redirect=` 只接受以单个 `/` 开头的站内路径，`//evil.com` 这类协议相对地址会被拒绝。
- 页头在移动端只保留汉堡按钮，导航与账号操作收进右侧抽屉。
- 登录态由 Pinia `store/auth.ts` 持久化（`pinia-plugin-persistedstate`），刷新页面保持登录。
- `services/axiosInstance.ts` 负责注入 `Authorization`、401 静默刷新与错误形态统一；
  ⚠️ client 的页面是公开的，令牌失效时**只清理会话、不强制跳登录页**，不打断阅读。

### 个人中心与会员

`/account`（需登录）包含三块：

| 区块 | 说明 |
| :--- | :--- |
| 账号信息 | 用户名、角色、手机号、会员到期、注册时间 |
| 会员与阅读权益 | 会员 / 管理员可直接阅读全部 VIP 内容；普通用户可**申请升级为会员**；待审核 / 被拒绝各有对应文案 |
| 修改密码 | 旧密码 + 新密码 + 确认，调用 `PUT /api/auth/password` |

- 会员申请提交后在 `MembershipApplications` 里进入 `pending`，由 admin 的「会员申请」页审核。
- 审核通过后角色变成 `member`，默认有效期 **1 年**，获得 `library:view`（VIP 阅读权益）；
  个人中心会显示到期时间。到期后服务端自动降级为普通用户，可重新提交申请。
- 管理员账号本身无需申请（也不能被降级成会员）。

### 书库

- `/library`：书籍卡片墙，展示封面 / 分类 / 标签 / 分卷数 / 章节数与简介；封面为空时使用手绘占位。
  未登录游客只会收到 `guest_visible=true` 的书籍；登录后可见全部书籍。
  标题下方是**分类单选按钮**：选项从当前书籍列表归纳（只显示真实存在的分类，有未分类书籍时补「未分类」），
  并额外提供「全部」；筛选在客户端完成，不额外请求接口。
  封面右上角有 `AccessBadge`：`is_free=true` 显示橙色「限免」，否则显示金色「VIP」。
- `/library/:id`：左侧「COURSE EXPLORER」展示章节（`00`、`01`… 全局编号），右侧章节正文：
  - 只有 1 个分卷时不显示卷名，章节平铺；分卷数 > 1 时才按「卷名 → 章节」分组，卷名同时出现在顶部「分卷名 · 第 X / N 节」；
  - 顶部显示第 X / N 节与进度条，绿色「本节内容」面板展示章节导读，正文用
    `@zhangxianjue/markdown` 只读渲染（`toc-mode="off"`，导航交给章节列表）。
- 上一节 / 下一节按跨分卷展平后的顺序移动；当前章节同步到 `?chapter=`，刷新页面、分享链接都能停在同一节。
- **访问控制**：书库列表公开，登录后能看到全部卡片；限免书籍正文公开，
  VIP 书籍的详情 / 章节由服务端返回 403，页面展示「本书为 VIP 专属」并提供会员申请入口。
- **游客可见**：`guest_visible=false` 的书籍 / 笔记 / 文章对未登录游客隐藏（列表不返回、详情 404）；
  登录后的普通用户即可正常看到，不需要是会员。
  `library:view` 分配给会员 / 朋友 / 管理员。
- ⚠️ 前端只负责展示与引导，真正的拦截在服务端；游客直接访问 VIP 书籍链接同样会被拒绝。
- 移动端：书籍卡片单列；阅读页的章节导航变成顶部的可滚动列表，正文在下方。

### 移动端响应式

- 页头断点 `768px`：隐藏主导航与桌面账号入口，显示汉堡按钮；抽屉从右侧滑入，锁定页面滚动，支持 Esc 关闭。
- 内容区 `Layout` 在窄屏收窄内边距；卡片网格、时间轴、文章库已有各自的 `auto-fill` / 媒体查询。
- 文章详情在 `≤768px` 时**默认收起悬浮目录**，避免 240px 宽的浮层盖住正文。

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
├── api             # 接口层：timelineService、articleService、noteService、categoryService、
│                   #         authService、captchaService、bookService、membershipService
├── components      # 组件层：Header（含移动端抽屉）、Layout、Breadcrumb、AuthShell、CaptchaField
├── composables     # 组合式层：useAuth（登录 / 注册 / 找回 / 改密）、useCaptcha、useMembership
├── constants       # 权限编码（与 server 保持一致）
├── router          # 路由与守卫（登录要求 / 权限不足跳个人中心）
├── services        # 请求基础设施：apiConfig / apiError / axiosInstance / http
├── store           # 状态层：auth（只存状态，不发请求，持久化到 localStorage）
├── types           # 类型声明
├── util            # 纯函数：formatDate、addParentToMarkdownLinks
└── views           # 视图层：Timeline、Notes（卡片墙）、NotesDetail（思维导图）、
                    #         ArticlesLibrary、Articles（详情）、Library、LibraryDetail、
                    #         Account、Auth（Login / Register / ForgotPassword）
```

## 数据来源

全部来自 server 的公开读接口（无需登录）：

| 用途         | 接口                                 |
| :----------- | :----------------------------------- |
| 图形验证码   | `GET /api/auth/captcha`              |
| 登录         | `POST /api/auth/login`               |
| 注册         | `POST /api/auth/register`            |
| 找回密码     | `POST /api/auth/password/forgot`     |
| 修改密码     | `PUT /api/auth/password`             |
| 当前用户     | `GET /api/auth/getUserInfo`          |
| 刷新令牌     | `POST /api/auth/refresh`             |
| 会员申请     | `POST /api/membership/apply`         |
| 申请状态     | `GET /api/membership/status`         |
| 书库列表     | `GET /api/library/book`（游客自动过滤 `guest_visible=false`） |
| 书籍详情     | `GET /api/library/book/:id`          |
| 章节正文     | `GET /api/library/book/:bookId/chapter/:chapterId` |
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

> 笔记与书籍一样带 `is_free`：列表返回全部笔记（含 VIP 专属），详情页对 VIP 笔记要求
> `library:view` 或 `note:manage`，否则展示「这篇笔记为 VIP 专属」的升级引导。
> 文章没有此限制，默认对所有人可见。

## 攻略笔记卡片墙

布局参考 cppgamedev.top/mainline：页头（绿色小方块 + 小字标签 + 大标题 + 副标题）+
自适应卡片网格。卡片自上而下是 16:9 封面（右上角有「限免 / VIP」角标）、`01 / 攻略笔记` 序号、
分类标签、标题、三行截断的描述，底部一条分隔线，左「更新于」右「查看笔记 →」。

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
