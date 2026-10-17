# admin —— 后台管理端

Vue 3 + TypeScript + Vite + Element Plus + Pinia。登录后维护时间轴事件、文章（标题、正文、封面、分类、关联笔记、排序）、笔记（封面、标题、描述、分类、排序、思维导图正文）与树形分类。

## 启动

```bash
npm run dev:admin        # 仓库根目录
```

默认端口 **8080**（见 `vite.config.ts`）。**需要后端在 3000 端口运行**：

```bash
npm run dev:server       # 另开一个终端
```

首次使用需先有账号。⚠️ `POST /api/auth/register` 创建的账号 `role_id` 固定为 **2（普通用户）**，
只能读文章与笔记；要维护数据需把该账号的 `role_id` 提为 **1（管理员）**，否则写操作一律 **403**。

## 路由

| 路径        | 名称      | 需登录 | 说明                          |
| :---------- | :-------- | :----: | :---------------------------- |
| `/login`    | Login     |   否   | 登录页                        |
| `/`         | Dashboard |   是   | 仪表盘（内容待补齐，当前为空页） |
| `/timeline` | Timeline  |   是   | 时间轴管理：列表 + 新增/更新弹窗 |
| `/articles` | Articles  |   是   | 文章管理：列表 + 元数据弹窗 + 内容弹窗 |
| `/notes`    | Notes     |   是   | 笔记管理：列表 + 元数据弹窗 + 内容弹窗 |
| `/categories` | Categories |  是   | 分类管理：树形表格 + 增删改弹窗 |
| `/*`        | NotFound  |   是   | 404                           |

守卫采用**默认受保护**策略：只有显式标 `meta.public` 的路由才允许未登录访问。
新增页面忘记加标记时会被拦到登录页，而不是直接暴露。

## 目录结构

```bash
src
├── api             # 接口层：articleService、noteService、categoryService、authService
├── components      # 组件层：Layouts（Header / Sidebar）
├── composables     # 组合式层：useAuth（登录编排）、useArticleCover（封面上传）
├── router          # 路由与导航守卫
├── services        # 请求基础设施
│   ├── apiConfig.ts      # API_BASE_URL 唯一来源 + resolveAssetUrl
│   ├── apiError.ts       # ApiError 与错误体类型守卫
│   ├── axiosInstance.ts  # axios 实例 + 请求/响应拦截器
│   └── apiClient.ts      # 解包封装
├── store           # 状态层：auth（只存状态，不发请求）
├── types           # 类型声明
├── util
└── views           # 视图层：login、dashboard、timeline、articles、notes、categories、errorPage
```

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

1. **元数据与正文分成两个弹窗**
   - 工具栏「新增 / 更新」→ `ArticleMetaDialog` / `NoteMetaDialog`，只管元数据
     （文章：标题 / 描述 / 分类 / 关联笔记 / 排序 / 封面；笔记：标题 / 描述 / 分类 / 排序 / 封面）
   - 操作列「编辑内容」→ `ArticleContentDialog`（`@zhangxianjue/markdown`）/
     `NoteContentDialog`（`@zhangxianjue/markmap` 的 `MarkmapEditor`）
   - 服务端对应 `PUT /admin/{article,note}/:id` 与 `PUT /admin/{article,note}/:id/content`，两端互不覆盖。

2. **工具栏「更新」作用于表格中选中的那一行**
   表格开了 `highlight-current-row`，未选中时点「更新」只提示不弹窗。
   刷新列表后会按 id 把选中行换成新对象，避免拿陈旧数据提交。

3. **操作列固定在最左侧**，工具栏按钮顺序统一为「新增 → 更新」。

> ✅ **决策：新增时不再编辑正文**。正文只在内容弹窗里维护，两个入口各管一半字段，
> 避免新增弹窗被迫加载 markdown 编辑器（markdown-it / katex），也避免「元数据保存」把正文覆盖成空。

> ⚠️ **笔记**列表接口**不返回 `content`**（思维导图动辄数 KB）。因此列表项的类型是 `NoteListItem` 而非 `Note` ——
> 类型系统会直接拦住「在列表里读 `row.content`」。内容弹窗每次打开都单独调 `GET /admin/note/:id` 取最新正文。
> 文章的列表本来就不含 `content`，内容弹窗同样按 id 重新拉一次，避免用陈旧快照覆盖。

> ⚠️ 封面复用了 `composables/useArticleCover.ts`。名字带 Article，但实现与文章无关（选文件 → 本地预览 → 提交时上传），
> 且上传接口 `/admin/upload` 是全局共用的。不重命名是为了避免牵连 articles 页。

## 分类管理页

`/categories` 用 `el-table` 的树形模式（`row-key="id"` + `:tree-props="{ children: 'children' }"` + `default-expand-all`）展示分类树，
每行提供「新增子分类 / 编辑 / 删除」。

- 弹窗里的「上级分类」是 `el-tree-select`，`check-strictly` 允许选任意层级（不限于叶子）。
- ⚠️ **编辑时必须把「自己及自己的子孙」从上级候选项里剔除**：否则用户能选出一个环。
  服务端也会拦（400），但界面上先挡一道，避免无谓的报错。
- 删除会先弹确认框；服务端拒绝时（有子分类 / 仍被引用）直接把它的文案透出来。
- 文章与笔记的弹窗同样用 `el-tree-select` 选分类，值为 `category_id`；清空即未分类。

## 登录态

- **状态**：Pinia `store/auth.ts`，经 `pinia-plugin-persistedstate` 持久化到 localStorage
- **注入**：`axiosInstance` 请求拦截器自动加 `Authorization: Bearer <token>`
- **失效**：响应拦截器遇 401 会清理会话并跳登录页，同时带上 `?redirect=`
- **编排**：登录/退出/补拉用户信息的流程在 `composables/useAuth.ts`，store 不调接口

> ⚠️ store 刻意不发请求：若 store 直接调 service，会形成
> `axiosInstance → store → authService → apiClient → axiosInstance` 的循环依赖。

## 构建

```bash
npm run build -w admin   # vue-tsc -b && vite build
```

> 注意 `tsconfig.app.json` 中的 `paths` 必须与 `vite.config.ts` 的 `resolve.alias` 保持一致，
> 缺了它 TypeScript 无法解析 `@/` 导入。
