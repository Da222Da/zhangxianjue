# admin —— 后台管理端

Vue 3 + TypeScript + Vite + Element Plus + Pinia。登录后维护时间轴事件、文章（标题、正文、封面、分类、关联笔记、游客可见、排序）、笔记（封面、标题、描述、分类、访问权限、游客可见、排序、思维导图正文）、树形分类、书库（书籍 → 分卷 → 章节、分类与标签、限免 / 游客可见开关），以及用户、角色、权限与会员申请。

## 启动

```bash
npm run dev:admin        # 仓库根目录
```

默认端口 **8080**（见 `vite.config.ts`）。**需要后端在 3000 端口运行**：

```bash
npm run dev:server       # 另开一个终端
```

首次使用需先有具备 `admin:access` 权限的账号（内置「管理员」角色）。
⚠️ 注册创建的账号自动分配「普通用户」角色，**没有后台访问权限**，
在后台登录会被拒绝；需要由管理员在「用户管理」里把它改成具备权限的角色。

`db:seed:all` 会写入 3 个演示账号（会员小雨 / 朋友阿星 / 普通小林，密码 `abc123456`），
详见 [`server/README.md`](../../server/README.md#演示账号dbseedall-写入)。

## 路由

| 路径        | 名称      | 所需权限 | 说明                          |
| :---------- | :-------- | :------- | :---------------------------- |
| `/login`    | Login     | 否（公开） | 登录页                      |
| `/`         | Dashboard | `admin:access` | 仪表盘（内容待补齐，当前为空页） |
| `/timeline` | Timeline  | `timeline:manage` | 时间轴管理：列表 + 新增/更新弹窗 |
| `/articles` | Articles  | `article:manage` | 文章管理：列表 + 元数据弹窗 + 内容弹窗 |
| `/notes`    | Notes     | `note:manage` | 笔记管理：列表 + 元数据弹窗 + 内容弹窗 |
| `/books`    | Books     | `book:manage` | 书库管理：书籍列表 + 元数据弹窗 + 分卷/章节弹窗 |
| `/users`    | Users     | `user:manage` | 用户管理：搜索 / 筛选 / 增删改 / 重置密码 / 启停 |
| `/membership` | Membership | `user:manage` | 会员申请：审核会员升级申请 |
| `/roles`    | Roles     | `role:manage` | 角色管理：增删改（内置角色不可删） |
| `/permissions` | Permissions | `permission:manage` | 权限管理：按角色勾选权限点 |
| `/403`      | Forbidden | `admin:access` | 权限不足页面 |
| `/*`        | NotFound  |   是   | 404                           |

守卫采用**默认受保护**策略：只有显式标 `meta.public` 的路由才允许未登录访问。
新增页面忘记加标记时会被拦到登录页，而不是直接暴露。

权限校验分两层：

1. **路由守卫**：先补齐用户信息，再比对 `meta.permission`；不足时进入 `/403`，不静默跳首页。
2. **侧边栏**：按同一份权限编码过滤菜单项（只是「不给入口」，真正的拦截在服务端）。

权限编码常量在 `src/constants/permissions.ts`，必须与 server 侧保持一致。

## 目录结构

```bash
src
├── api             # 接口层：articleService、noteService、categoryService、authService、
│                   #         userService、roleService、permissionService、bookService、membershipService
├── components      # 组件层：Layouts（Header / Sidebar / SidebarMenu / 移动端抽屉）
├── composables     # 组合式层：useAuth（登录编排）、useArticleCover（封面上传）
├── constants       # 权限编码（与 server 保持一致）、client 站内路径
├── router          # 路由与导航守卫（含权限校验）
├── services        # 请求基础设施
│   ├── apiConfig.ts      # API_BASE_URL 唯一来源 + resolveAssetUrl
│   ├── apiError.ts       # ApiError 与错误体类型守卫
│   ├── axiosInstance.ts  # axios 实例 + 请求/响应拦截器
│   └── apiClient.ts      # 解包封装
├── store           # 状态层：auth（只存状态，不发请求）
├── types           # 类型声明
├── util            # 通用工具：clipboard（复制到剪贴板，含非安全上下文兜底）、markdown（生成行内链接）
└── views           # 视图层：login、dashboard、timeline、articles、notes、categories、
                    #         books、users、membership、roles、permissions、errorPage
```

## 响应式与移动端

全站按三档断点处理，页面本身不再各自维护一套布局：

| 断点 | 行为 |
| :--- | :--- |
| `≤768px` | 侧栏隐藏，Header 出现汉堡按钮，点开 `el-drawer` 导航；弹窗统一 `92vw`；表格取消固定列，改为内部横向滚动；分页居中换行并隐藏每页条数选择器 |
| `≤600px` | 弹窗表单标签从右对齐改为上下结构；搜索框 / 下拉筛选保持整行可点；权限页、章节管理弹窗改为纵向布局 |
| `≤480px` | Header 隐藏用户名只留头像；登录卡片最大宽度 360px 且随视口收缩 |

- 导航菜单抽成 `SidebarMenu.vue`：桌面侧栏与移动端抽屉复用同一份权限过滤后的菜单，点击抽屉菜单后自动关闭。
- ⚠️ **窄屏取消固定列**：操作列已经排在最前，继续 sticky 会占满手机宽度；在 `global.css` 里用媒体查询把 `el-table-fixed-column--left/right` 改回普通列，表格在自身容器内横向滚动。
- 全局弹窗宽度 / 表单标签 / 分页的响应式规则集中在 [`assets/styles/global.css`](src/assets/styles/global.css)，各业务弹窗只补充自己的局部布局（如章节列表改纵向、编辑器高度收缩）。

## 表格操作列顺序

除分类管理弹窗外，所有数据表格的**操作列都在最左侧**：

- 文章 / 笔记 / 书籍：行首「选中」radio → 操作
- 用户 / 会员申请 / 角色 / 时间轴：操作 → 其余列
- 书籍的「标签管理」弹窗：操作 → 标签 / 分类 → 排序
- ⚠️ **分类管理是例外**：它使用 Element Plus 树形表格，展开箭头固定在第一列，因此「名称」必须留在最前，顺序为「名称 → 排序 → 操作」。把操作列提前会让树形层级失去缩进。

## 时间轴管理页

`/timeline` 维护 client 首页的时间轴事件（`TimelineEvents` 表）。

- 工具栏「新增 / 更新」：更新作用于表格中选中的那一行（`highlight-current-row`），操作列只有「删除」。
- 弹窗字段：年份（1900–2100）/ 标题 / 描述 / 排序 / **自定义按钮（可多个，最多 5 个）**。
- 每个按钮都由「文案 + 链接」组成，两项都必填；整行为空的按钮在保存时自动丢弃。
  链接只接受站内路径（`/notes/1`）或 `http(s)` 地址，其它协议（如 `javascript:`）一律拒绝。
- ⚠️ 按钮行拆成了子组件 `TimelineButtonRow.vue`：vue-tsc 3.3 在「`v-for` 里放带事件的组件」
  时会丢失循环别名的作用域，拆开后绕过了这个推断问题。
- 同一年内按「排序」升序，`0` 表示按录入顺序；年份之间始终倒序（新的在上）。

## 文章管理页 / 笔记管理页

两页采用**同一套交互**，都是「元数据与正文分开」：

0. **顶部搜索框**：关键词交给服务端做 `LIKE` 模糊匹配，并与分类筛选按 AND 叠加。
   文章命中标题 / 正文，笔记命中标题 / 描述 / 正文；回车、点「搜索」、点清空都会重新查询。
   关键词中的 `%` / `_` / `\` 由服务端转义，不会被当成通配符。

1. **元数据与正文分成两个弹窗**
   - 工具栏「新增 / 更新」→ `ArticleMetaDialog` / `NoteMetaDialog`，只管元数据
     （文章：标题 / 描述 / 分类 / 关联笔记 / 游客可见 / 排序 / 封面；笔记：标题 / 描述 / 分类 / 访问（限免 / VIP）/ 游客可见 / 排序 / 封面）
   - 操作列「编辑内容」→ `ArticleContentDialog`（`@zhangxianjue/markdown`）/
     `NoteContentDialog`（`@zhangxianjue/markmap` 的 `MarkmapEditor`）
   - 服务端对应 `PUT /admin/{article,note}/:id` 与 `PUT /admin/{article,note}/:id/content`，两端互不覆盖。

2. **工具栏「更新」作用于表格中选中的那一行**
   表格开了 `highlight-current-row`，行首另有一列 radio 显示当前选中项；
   点 radio 与点行共用同一个 `currentRow`。未选中时点「更新」只提示不弹窗。
   刷新列表后会按 id 把选中行换成新对象，避免拿陈旧数据提交。

3. **操作列固定在最左侧**，工具栏按钮顺序统一为「新增 → 更新」。
   操作列还有「复制应用地址」：复制带标题的 Markdown 行内链接
   （文章 `[标题](/articles/{id})`、笔记 `[标题](/notes/{id})`），可直接粘进正文。
   标题中的方括号与反斜杠会自动转义。路径统一由 `constants/clientRoutes.ts` 生成，换域名不影响复制结果。

> ✅ **决策：新增时不再编辑正文**。正文只在内容弹窗里维护，两个入口各管一半字段，
> 避免新增弹窗被迫加载 markdown 编辑器（markdown-it / katex），也避免「元数据保存」把正文覆盖成空。

> ⚠️ **笔记**列表接口**不返回 `content`**（思维导图动辄数 KB）。因此列表项的类型是 `NoteListItem` 而非 `Note` ——
> 类型系统会直接拦住「在列表里读 `row.content`」。内容弹窗每次打开都单独调 `GET /admin/note/:id` 取最新正文。
> 文章的列表本来就不含 `content`，内容弹窗同样按 id 重新拉一次，避免用陈旧快照覆盖。

> ⚠️ 封面复用了 `composables/useArticleCover.ts`。名字带 Article，但实现与文章无关（选文件 → 本地预览 → 提交时上传），
> 且上传接口 `/admin/upload` 是全局共用的。不重命名是为了避免牵连 articles 页。

## 分类管理入口

分类管理不再单独占一个导航页，而是并入「文章管理」与「笔记管理」的工具栏：

- 两个页面都有「分类管理」按钮，打开同一个 `CategoryManageDialog.vue`。
- 弹窗内用树形表格展示分类，每行提供「新增子分类 / 编辑 / 删除」。
- 「上级分类」用 `el-tree-select`，`check-strictly` 允许选任意层级（不限于叶子）。
- ⚠️ **编辑时必须把「自己及自己的子孙」从上级候选项里剔除**：否则用户能选出一个环。
  服务端也会拦（400），但界面上先挡一道，避免无谓的报错。
- 删除会先弹确认框；服务端拒绝时（有子分类 / 仍被引用）直接把它的文案透出来。
- 分类变更后弹窗会发 `change`，父页面刷新筛选树与元数据弹窗的分类选项。
- `/categories` 旧路径重定向到 `/articles`，旧书签不会 404。

## 书库管理页

`/books` 维护书库的「书籍 → 分卷 → 章节」三级内容，并管理书籍分类与标签：

- 列表列：选中 radio、**操作**、封面、书名、分类、标签、访问（限免 / VIP）、游客可见、分卷数、章节数、排序、更新时间；
  顶部搜索框按书名做服务端 `LIKE` 模糊匹配（回车 / 点「搜索」/ 清空都会重新查询）。
  radio 与行点击共用 `currentRow`，仅标记当前选中项；操作列的「复制应用地址」复制带书名的
  Markdown 链接 `[书名](/library/{id})`。
- **书籍元数据弹窗**（`BookMetaDialog.vue`）：书名 / 描述 / 分类 / 标签 / 访问（限免开关）/ 游客可见 / 排序 / 封面。
  - 分类与标签都来自服务端维护的扁平列表，不再自由输入；
  - 标签支持多选；`is_free` 开启后游客与普通用户也能阅读，关闭则仅会员 / 朋友 / 管理员可读；
  - `guest_visible` 关闭后未登录游客在书库列表与阅读页都看不到。
- **分类管理 / 标签管理**：工具栏两个按钮分别打开 `TaxonomyDialog.vue`，弹窗内完成新增、编辑、删除。
  分类被删除后相关书籍自动变为未分类；标签被删除后关联行一并清理。
- **分卷与章节弹窗**（`BookChaptersDialog.vue`）：
  - 左侧按「分卷 → 章节」分组：卷头显示名称与章节数，提供「编辑 / 删除」；
  - 顶部「新增分卷」打开嵌套表单（名称 / 排序），「新增章节」在当前选中的分卷下创建；
  - 右侧编辑章节时，第一个下拉框就是所属分卷，可以直接把章节移动到其它分卷；
  - 正文使用 `@zhangxianjue/markdown` 的 `edit&preview` 模式，局部引入、随弹窗懒加载；
  - 每次选中章节都按 id 拉一次最新正文，避免用陈旧快照覆盖。
- ⚠️ 删除分卷会**连同该卷下的全部章节一起删除**，确认框会明确提示章节数量。
- ⚠️ 删除书籍会**级联删除**该书籍的全部分卷与章节（两个外键均为 `ON DELETE CASCADE`），
  书籍与标签的关联（`BookTags`）也会一并清理。
- 封面与正文插图复用全局上传接口 `/api/admin/upload`。

## 游客可见开关

文章、笔记、书籍的元数据弹窗都有「游客可见」开关，列表用「游客」列显示当前状态：

- 开启（默认）：所有人都能看到该内容。
- 关闭：**仅未登录游客**在列表中被过滤、详情接口返回 404；登录后的普通用户 / 会员 / 朋友 / 管理员仍可正常访问。
- 它与 `is_free`（限免 / VIP 阅读权益）是两个独立开关：`guest_visible` 控制「是否存在」，
  `is_free` 控制「登录后是否有权阅读正文」。
- 真正的过滤在服务端完成：请求携带有效 token 时返回全部内容，未携带时只返回 `guest_visible=true` 的内容。

## 会员申请页

`/membership` 审核 client 提交的会员升级申请：

- 操作列在最左侧；支持按状态筛选（待审核 / 已通过 / 已拒绝）与分页。
- 待审核行提供「通过 / 拒绝」；通过后用户角色立即变成「会员」，默认有效期 **1 年**，并自动获得 VIP 阅读权益（`library:view`）。
- 会员到期后由服务端自动降级为普通用户，可重新提交申请。
- 拒绝只标记状态，用户可以重新提交申请。
- ⚠️ 审核通过**不需要用户重新登录**：服务端的 `requirePermission` 每次请求都重新读取角色权限。
- 会员申请接口需要 `user:manage` 权限。

## 用户管理页

`/users` 维护账号（`Users` 表），行为对齐服务端 `userService` 的约束：

- 操作列在最左侧；支持按「用户名 / 手机号关键词 + 角色 + 状态」筛选，服务端分页（默认 10 / 页，最大 100）。
- 工具栏「新增用户」：用户名 / 手机号 / 密码 / 角色 / 会员到期 / 状态；密码只在新增时填写。
- **手机号**是账号的联系方式，也是 client / admin 的登录标识之一，唯一且可选。
  邮箱字段已从表结构与界面中移除。
- **会员到期**：选择「会员」角色时出现，默认一年后；可手动修改延长。
  到期后服务端会自动把角色降级为普通用户，不再享有 VIP 阅读权益。列表中的「会员到期」列展示当前值。
- 行内操作：编辑 / 重置密码 / 删除；状态列用 `el-switch` 直接启用或禁用。
- ⚠️ 不能禁用或删除当前登录账号；不能修改自己的角色；最后一名启用状态的管理员不能被禁用、降级或删除。
  前端把这些按钮置灰，服务端仍会再校验一次。
- 编辑的是当前登录账号时，保存后会调用 `useAuth().loadUser()` 刷新 Header 里的用户名。
- 服务端列表与详情都**不返回密码哈希**。

## 角色管理页

`/roles` 维护角色（`Roles` 表）。操作列在最左侧；表格显示角色名、编码、描述、成员数、权限数与类型：

- 「新增角色」只填名称与描述；`code` 由服务端生成，不开放填写（内置角色之外 code 没有业务含义）。
- ⚠️ 系统内置角色（`admin` / `user`）不能删除；仍有成员的角色也不能删除，需先把用户改到其它角色。
- 权限不在这里分配 —— 统一在「权限管理」页勾选，避免同一个字段两个入口。

## 权限管理页

`/permissions` 是**角色 → 权限点**的分配界面：

- 左侧选角色，右侧按 `group_name`（系统 / 内容）分组勾选权限点，保存为整体替换语义。
- 权限点目录来自 `GET /admin/permission`，由服务端代码与迁移定义，后台不提供增删。
- ⚠️ 管理员角色的 `admin:access` 复选框被锁定：取消它会让后台彻底失去入口（服务端也会拒绝）。
- 保存后服务端立即生效，不需要用户重新登录（`requirePermission` 每次请求都重新读角色权限）。

## 登录态

- **登录标识**：登录页接受「手机号 / 用户名」，按输入内容自动判断；
  走后台专用接口 `/api/auth/admin/login`，不要求图形验证码。
- **状态**：Pinia `store/auth.ts`，经 `pinia-plugin-persistedstate` 持久化到 localStorage
- **注入**：`axiosInstance` 请求拦截器自动加 `Authorization: Bearer <token>`
- **失效**：响应拦截器遇 401 会清理会话并跳登录页，同时带上 `?redirect=`
- **编排**：登录/退出/补拉用户信息的流程在 `composables/useAuth.ts`，store 不调接口
- **后台准入**：后台登录接口本身只允许具备 `admin:access` 的账号登录；
  `useAuth.login` 还会再检查一次，缺少权限时清空会话并提示，不会进入后台。
- **本地自动登录**：`apps/admin/.env` 设置 `VITE_DEV_AUTO_LOGIN=true`，
  并填入 `VITE_DEV_AUTO_LOGIN_PHONE` + `VITE_DEV_AUTO_LOGIN_PASSWORD`
  （也可留空，回退到 server/.env 的 `DEV_LOGIN_*`）。开发模式下打开登录页会自动登录；
  退出登录后本次标签页不再自动登录。`.env` 已被 gitignore，**不要用于生产构建**。
- **权限**：`store/auth.ts` 暴露 `permissions` 与 `hasPermission(code)`，路由守卫与侧边栏共用

> ⚠️ store 刻意不发请求：若 store 直接调 service，会形成
> `axiosInstance → store → authService → apiClient → axiosInstance` 的循环依赖。

## 构建

```bash
npm run build -w admin   # vue-tsc -b && vite build
```

> 注意 `tsconfig.app.json` 中的 `paths` 必须与 `vite.config.ts` 的 `resolve.alias` 保持一致，
> 缺了它 TypeScript 无法解析 `@/` 导入。
