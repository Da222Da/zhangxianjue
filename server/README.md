# server

zhangxianjue 项目后端服务，基于 Express + Sequelize 提供 REST 接口与 Swagger 文档。

## 技术栈

| 类别   | 选型                                                                |
| :----- | :------------------------------------------------------------------ |
| 运行时 | Node.js ≥ 22.7（依赖 `--experimental-transform-types` 直接运行 TS） |
| 框架   | Express 5                                                           |
| 数据库 | MySQL + Sequelize 6 + mysql2                                        |
| 认证   | jsonwebtoken + bcryptjs                                             |
| 文档   | swagger-jsdoc + swagger-ui-express                                  |
| 其他   | dotenv、cors                                                        |

## 目录结构

```bash
src
├── config          # 配置
│   ├── config.json    # Sequelize-CLI 数据库配置，按 NODE_ENV 分组
│   ├── env.ts         # 环境变量唯一入口，必须最先 import
│   └── swagger.ts     # Swagger 装配
├── controllers     # 控制层：请求/响应处理、参数校验、调用 service
├── middlewares     # 中间件：authMiddleware 鉴权、errorMiddleware 统一错误处理
├── migrations      # Sequelize 迁移文件
├── models          # 数据层：模型定义与读写
│   ├── index.ts       # barrel，统一导出 sequelize 与各模型
│   ├── connection.ts  # Sequelize 实例
│   ├── article.ts     # 文章模型
│   ├── category.ts    # 分类模型（树形，parent_id 邻接表）
│   ├── note.ts        # 笔记模型（正文为思维导图 Markdown）
│   ├── timelineEvent.ts # 时间轴事件模型
│   └── users.ts       # 用户模型
├── seeders         # 种子数据（npx sequelize-cli-ts-js db:seed:all）
├── routes          # 路由层：路径映射
│   ├── index.ts       # 路由入口，挂载各子路由
│   ├── authRoutes.ts  # 认证接口
│   ├── articleRoutes.ts # 文章接口
│   ├── categoryRoutes.ts # 分类接口
│   ├── noteRoutes.ts  # 笔记接口
│   └── timelineRoutes.ts # 时间轴接口
├── services        # 服务层：业务逻辑与数据编排
├── utils           # 工具
│   ├── constants      # HttpStatusCode / ErrorCode 常量
│   ├── errors.ts      # AppError 异常体系
│   └── response.ts    # 响应封装
└── app.ts          # 应用入口
```

### 分层职责边界

| 层          | 可以                             | 禁止               |
| :---------- | :------------------------------- | :----------------- |
| routes      | 路径映射、挂载中间件             | 写业务逻辑、写 SQL |
| controllers | 参数校验、组装响应、调用 service | 直接操作数据库     |
| services    | 业务逻辑、编排数据操作           | 感知 `req` / `res` |
| models      | 数据定义与读写                   | 业务判断           |

**异常约定**：service 抛 `AppError` 子类（`BadRequestError` / `NotFoundError` 等），由 `errorMiddleware` 统一转换为 HTTP 响应；未识别异常统一兜底为 `520`。因此 service 层不必也不应自行拼装错误响应。

## 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
```

`JWT_SECRET` 必填，可用以下命令生成：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ 环境变量由 `src/config/env.ts` 统一加载，而 dotenv 以 `process.cwd()` 为基准查找 `.env`，因此请从 `server` 目录启动服务（或用 `npm run dev -w server`）。

| 变量                 | 必填 | 默认          | 说明                                                                 |
| :------------------- | :--- | :------------ | :------------------------------------------------------------------- |
| `JWT_SECRET`         | 是   | 无            | JWT 签名密钥。未配置时登录接口会在 `jwt.sign` 处抛错                 |
| `PORT`               | 否   | `3000`        | 服务监听端口                                                         |
| `NODE_ENV`           | 否   | `development` | 决定 `config/config.json` 读取哪一组数据库配置                       |
| `JWT_EXPIRES_IN`     | 否   | `1h`          | Access Token 有效期。格式为数字 + `s/m/h/d`，填错格式会告警并回退默认值 |
| `JWT_REFRESH_EXPIRES_IN` | 否 | `7d`        | Refresh Token 有效期。到期后需重新登录（服务端无吊销机制）           |
| `UPLOAD_DIR`         | 否   | `uploads`     | 图片上传目录，相对路径以 `process.cwd()` 为基准解析（即 server 目录） |
| `UPLOAD_MAX_SIZE_MB` | 否   | `5`           | 单张图片大小上限（MB）                                               |

### 2. 初始化数据库

```bash
npx sequelize-cli-ts-js db:migrate
npx sequelize-cli-ts-js db:seed:all   # 可选：注入示例分类树 + 5 条笔记 + 3 篇文章 + 5 条时间轴事件
```

> ⚠️ **种子脚本必须自己保证幂等**：本项目没有配置 `seederStorage`，sequelize-cli 默认取 `none`
> —— 它**不记录哪些 seeder 已执行过，也不建 `SequelizeData` 表**，所以 `db:seed:all`
> 每次都会把所有 seeder 从头跑一遍。现有两个 seeder 的判重方式：
>
> | seeder | 判重方式 |
> | :--- | :--- |
> | `demo-categories` | `Categories` 表**完全为空**才写入，绝不改动已有分类 |
>
> ⚠️ `demo-categories` 之所以不按名称「补齐 / 纠正」，是因为那样会在用户改过分类名之后
> （例如把「引擎」改成「Unreal Engine」）把旧名字重新建出来、并把子分类挪过去，
> 相当于悄悄撤销用户编辑。代价是升级已有数据库时，迁移只会把历史文本分类升级成
> **平铺的根分类**，不会再自动整理成示例树。
> | `demo-notes` | `Notes` 表**完全为空**才写入（表里已有任何数据就整体跳过，避免污染真实数据） |
> | `demo-articles` | 按 `id` 逐条判重，只插入缺的那几条 |
> | `demo-timeline` | 按「年份 + 标题」逐条判重 |
>
> 新增 seeder 时请照此自行判重，否则重复执行会灌入重复行。
>
> 分类种子必须排在笔记 / 文章之前（文件名 `20261017000000`），
> 因为后两者会按名称把 `categoryName` 解析成 `category_id`。
>
> 两个业务 seeder 的 `id` 都是**写死**的：示例笔记的「延伸阅读」分支链接到
> `/articles/1`、`/articles/2`、`/articles/3`，id 一旦由自增分配就会错位、链接失效。
>
> 回滚用 `npx sequelize-cli-ts-js db:seed:undo:all`。
> ⚠️ 注意它同样依赖"顺序"：`demo-articles` 的 `down` 按 id 删除，`demo-notes` 的 `down` 按标题删除。

> ⚠️ **不要给 `server/package.json` 添加 `"type": "module"`。** 迁移文件是 `.ts`，而 `sequelize-cli` 底层的 `umzug` 用 `require()` 加载它们；一旦声明 `type: module`，Node 会把 `src` 下的 `.ts` 全部视作 ESM，`db:migrate` 会直接报
> `Must use import to load ES Module ... require() of ES modules is not supported`。
> 因此本项目**依赖「package.json 无 type 字段 + tsconfig 的 `module: nodenext`」这个组合**让迁移被编译为 CommonJS；同理也不要随意改 tsconfig 的 `module`。代价是 `tsc` 会对 `connection.ts` 的 `import.meta` 报一条 `TS1470`，属于可接受的已知项（运行时 Node 会按语法自动识别为 ESM，功能不受影响）。

### 3. 启动

```bash
npm run dev -w server   # 仓库根目录；或在 server 目录执行 npm run dev
```

服务启动于 `http://localhost:3000`。

> ⚠️ `npm run build` 对应的 `tsc` 在 `tsconfig.json` 中开启了 `noEmit`，目前只做类型检查、不产出 `dist`，如需产物请调整该配置。
>
> ⚠️ 该类型检查当前会报一条 `src/models/connection.ts` 的 `TS1470`（`import.meta` 与 CommonJS 输出不兼容），**这是为保住 `db:migrate` 而刻意接受的代价**，原因见上一节。除它之外应为 0 错误。

## 接口文档

Swagger UI：`http://localhost:3000/api-docs`

文档由 `src/config/swagger.ts` 中的 `apis: ["./src/routes/*.ts"]` 扫描路由文件里的 `@swagger` 注释生成。**新增接口时把注释写在对应路由文件中即可**，无需改动 Swagger 配置。

## 响应体契约

全站统一以 `status` 布尔值标记成败：**所有**成功响应为 `true`，错误响应为 `false`。前端请求封装据此判定，不再依赖字段是否存在。

```jsonc
// 通用成功响应（认证等模块）—— sendSuccessResponse
{ "status": true, "statusCode": 200, "message": "登录成功", "data": { "token": "...", "refreshToken": "..." } }

// 通用错误响应 —— sendErrorResponse / errorMiddleware
{ "status": false, "statusCode": 404, "message": "文章不存在", "errorCode": null }
```

| 生成函数                | 用于                              | 响应体                                                                      |
| :---------------------- | :-------------------------------- | :-------------------------------------------------------------------------- |
| `sendSuccessResponse`   | 通用成功响应                      | `{ status: true, statusCode, message, data }`                                |
| `sendApiSuccessResponse`| 列表 / 详情等业务响应             | `{ status: true, data, message, total?, currentPage?, pageSize? }`           |
| `sendErrorResponse`     | 一切错误（含 `errorMiddleware` 兜底） | `{ status: false, statusCode, message, errorCode }`                       |

> ⚠️ `sendApiSuccessResponse` 不返回 `statusCode`，且分页字段与 `data` 同级展开 —— 这是为兼容 `apps/admin` 的既有前端契约。改动响应体结构前必须同步该消费端。

## 认证接口

| 方法 | 路径                     | 需登录 | 说明                                              |
| :--- | :----------------------- | :----: | :------------------------------------------------ |
| POST | `/api/auth/register`     |   否   | 注册，`role_id` 固定为 `2`（普通用户）            |
| POST | `/api/auth/login`        |   否   | 登录，返回 `token` 与 `refreshToken`              |
| POST | `/api/auth/refresh`      |   否   | 用 `refreshToken` 换取新的 `accessToken`          |
| GET  | `/api/auth/getUserInfo`  |   是   | 获取当前登录用户信息                              |

### 令牌约定

- 载荷为 `{ id, role_id, type }`，`type` 区分 `access` / `refresh`。
- ⚠️ **两种令牌不可互换**：`authMiddleware` 只接受 `access`，刷新接口只接受 `refresh`。
  缺少该标记的旧令牌一律无效，升级后需重新登录。
- **刷新不轮换 refreshToken**：服务端无状态存储，无法吊销已签发的令牌，
  轮换只会制造「旧令牌依然有效」的假象。refreshToken 到期即需重新登录。

### 角色约定

`Users.role_id` 是裸整数（当前没有独立角色表）：

| 值  | 含义     | 权限                             |
| :-- | :------- | :------------------------------- |
| `1` | 管理员   | 可读可写：文章增删改、图片上传   |
| `2` | 普通用户 | 只读（注册接口的默认值）         |

⚠️ 文章写接口与上传接口都挂了 `roleMiddleware(RoleId.ADMIN)`，非管理员调用返回 **403**。
要放宽到多角色，改 `src/routes/*.ts` 里的 `adminOnly` 即可。

## 分类接口

分类是**树形结构**（邻接表：`parent_id` 指向父分类，根分类的 `parent_id` 为 `null`），
文章与笔记通过 `category_id` 关联到分类。

| 方法   | 路径                      | 需登录 | 说明                                         |
| :----- | :------------------------ | :----: | :------------------------------------------- |
| GET    | `/api/admin/category`     |   否   | 查询完整分类树（根节点数组，`children` 递归） |
| POST   | `/api/admin/category`     |   是   | 创建分类                                     |
| PUT    | `/api/admin/category/:id` |   是   | 更新分类（名称 / 父分类 / 排序）             |
| DELETE | `/api/admin/category/:id` |   是   | 删除分类                                     |

**树形相关的约定**：

- **同级名称唯一**由 service 层保证。⚠️ 不建数据库唯一索引是因为 MySQL 把 `NULL` 视为互不相等，
  根分类（`parent_id = NULL`）之间无法被 `UNIQUE(parent_id, name)` 约束住。
- **移动分类不允许成环**：`PUT` 时新的父分类不能是自己或自己的子孙，否则返回 400。
- **删除会被拒绝（400）**：只要还有子分类，或仍被文章 / 笔记引用。
  这是刻意的 —— 一次误删不应连带清空子树或把引用方的分类静默置空。
- **按分类筛选时包含子分类**：`?category_id=4` 会命中该分类自身及其全部子孙的文章/笔记。

> ⚠️ 早期的 `/api/admin/article/categories` 与 `/api/admin/note/categories`（从文本列反推分类名）
> 已随本次改造**移除**。分类的唯一数据源是 `Categories` 表，请改用 `GET /api/admin/category`。

## 文章管理接口

| 方法   | 路径                                | 需登录 | 说明                                                              |
| :----- | :---------------------------------- | :----: | :---------------------------------------------------------------- |
| GET    | `/api/admin/article`                |   否   | 分页查询列表，支持 `keyword` / `category_id` / `page` / `pageSize` |
| GET    | `/api/admin/article/:id`            |   否   | 查询文章详情                                                      |
| POST   | `/api/admin/article`                |   是   | 创建文章（**只写元数据**，`content` 落库为空串）                  |
| PUT    | `/api/admin/article/:id`            |   是   | 更新元数据（**不触碰正文**）                                      |
| PUT    | `/api/admin/article/:id/content`    |   是   | 只更新正文                                                        |
| DELETE | `/api/admin/article/:id`            |   是   | 删除文章                                                          |

写操作（POST / PUT / DELETE）需在请求头携带 `Authorization: Bearer <token>`，且**仅管理员角色**可调用；
token 由 `POST /api/auth/login` 获取，过期后用 `POST /api/auth/refresh` 静默续期。读接口公开。

**列表排序规则**：`ORDER BY sort ASC, createdAt DESC` —— 先按排序号升序，同序号按创建时间倒序。

**分类字段**：响应里同时返回 `category_id`（分类主键，用于编辑）与 `category`（分类名，由关联查出，只读）。
`category_id` 为 `null` 表示未分类。

**关联笔记字段**：`note_id`（笔记主键）与 `note_title`（由关联查出，只读）。
`note_id` 为 `null` 表示未关联；外键是 `ON DELETE SET NULL`，**删除笔记不会被文章卡住**，
删除后引用方的 `note_id` 自动置空。client 据此决定是否显示「前往笔记」入口。

> ✅ **决策：元数据与正文拆成两个写接口**（与笔记完全一致）。
> admin 的「新增 / 更新」弹窗只管元数据，「编辑内容」弹窗只管正文，接口与 UI 一一对应；
> 若继续用一个 `PUT` 全量提交，任一弹窗保存时都会用陈旧值覆盖另一半字段。

### 响应体示例

```jsonc
// 列表：分页字段与 data 同级
{ "status": true, "data": [], "total": 0, "currentPage": 1, "pageSize": 10, "message": "Articles fetched successfully" }

// 详情 / 创建 / 更新
{ "status": true, "data": { "id": 1, "title": "...", "content": "..." }, "message": "Article fetched successfully" }

// 删除：不含 data 字段
{ "status": true, "message": "Article deleted successfully" }
```

均由 `utils/response.ts` 的 `sendApiSuccessResponse` 生成，通用约定见上文[响应体契约](#响应体契约)。

### 参数约束

| 参数          | 约束                                                                        |
| :------------ | :-------------------------------------------------------------------------- |
| `title`       | 必填，字符串，去除首尾空白后非空，最长 255 字符                             |
| `content`     | **仅正文接口**：必填，字符串，最长 65535 字节（UTF-8，中文 3 字节/字），空串表示清空 |
| `cover`       | 可选字符串，最长 65535 字节。更新时不传则保持原值                           |
| `description` | 可选字符串，最长 65535 字节。更新时不传则保持原值                           |
| `category_id` | 可选正整数。创建时不传则为未分类；更新时不传则保持原值，传 `null` 表示移到未分类 |
| `note_id`     | 可选正整数。创建时不传则为未关联；更新时不传则保持原值，传 `null` 表示解除关联 |
| `sort`        | 可选非负整数。创建时不传取默认值 `0`；更新时不传则保持原值                  |
| `page`        | 可选正整数，默认 1                                                          |
| `pageSize`    | 可选正整数，默认 10，最大 100                                               |
| `keyword`     | 可选字符串，模糊匹配 `title` 与 `content`，输入中的 `%` 与 `_` 按字面量匹配 |
| `category_id`（查询） | 可选正整数，按分类筛选并**包含其全部子分类**；空串视为不筛选      |

## 笔记接口

与文章接口结构对称，差别在于**正文是思维导图**（`markmap` 直接消费的 Markdown 文本），
且**元数据与正文拆成两个写接口**。

| 方法   | 路径                                 | 需登录 | 说明                                                          |
| :----- | :----------------------------------- | :----: | :------------------------------------------------------------ |
| GET    | `/api/admin/note`                    |   否   | 分页查询列表，支持 `keyword` / `category_id` / `page` / `pageSize` |
| GET    | `/api/admin/note/:id`                |   否   | 查询笔记详情（**含 `content`**）                              |
| POST   | `/api/admin/note`                    |   是   | 创建笔记，只写元数据，`content` 落库为空串                    |
| PUT    | `/api/admin/note/:id`                |   是   | 更新元数据（封面 / 标题 / 描述 / 分类 / 排序），**不触碰正文** |
| PUT    | `/api/admin/note/:id/content`        |   是   | **只**更新正文，请求体中的其它字段一律忽略                    |
| DELETE | `/api/admin/note/:id`                |   是   | 删除笔记                                                      |

> ⚠️ **列表接口不返回 `content` 字段**（文章列表同样如此）：正文动辄数 KB，
> 而卡片页与表格页都只用元数据，整列返回纯属浪费带宽。需要正文调用方走 `GET /:id`。
> 消费端请勿假设列表元素含 `content`。

> ⚠️ 分成两个写接口是为了与 admin 的两个弹窗一一对应（元数据弹窗 / 内容弹窗各管一半字段），
> 避免"部分更新"语义下两边互相覆盖。正文接口传空串表示清空正文。

**列表排序规则**：与文章一致，`ORDER BY sort ASC, createdAt DESC`。

**关键词检索**：命中 `title`、`description`、`content` 三个字段 —— 正文虽不在列表响应里，但作为可检索字段覆盖"记得写过、想不起标题"的场景。

### 参数约束

| 参数          | 约束                                                                        |
| :------------ | :-------------------------------------------------------------------------- |
| `title`       | 必填，字符串，去除首尾空白后非空，最长 255 字符                             |
| `content`     | 仅正文接口：必填（**类型上**），最长 65535 字节；传空串表示清空             |
| `cover`       | 可选字符串，最长 65535 字节。更新时不传则保持原值                           |
| `description` | 可选字符串，最长 65535 字节。更新时不传则保持原值                           |
| `category_id` | 可选正整数。创建时不传则为未分类；更新时不传则保持原值，传 `null` 表示移到未分类 |
| `sort`        | 可选非负整数。创建时不传取默认值 `0`；更新时不传则保持原值                  |
| `keyword` / `category_id`（查询）/ `page` / `pageSize` | 与文章接口完全一致                                        |

> ⚠️ `content` 列在库中是 **NOT NULL**，但**不能带默认值** —— MySQL 不允许 TEXT 列设默认值
> （报错 1101 `BLOB, TEXT, GEOMETRY or JSON column can't have a default value`）。
> 因此空内容的兜底放在 `noteService.createNote` 里完成，模型与迁移都只声明 `NOT NULL`。

## 时间轴接口

client 首页的纵向时间轴，数据表为 `TimelineEvents`：每行一个事件，按 `year` 分组展示。

| 方法   | 路径                         | 需登录 | 说明                                                          |
| :----- | :--------------------------- | :----: | :------------------------------------------------------------ |
| GET    | `/api/admin/timeline`        |   否   | 查询全部事件（**不分页**），按 `year DESC, sort ASC, createdAt ASC` |
| POST   | `/api/admin/timeline`        |   是   | 创建事件                                                      |
| PUT    | `/api/admin/timeline/:id`    |   是   | 更新事件                                                      |
| DELETE | `/api/admin/timeline/:id`    |   是   | 删除事件                                                      |

**参数约束**：

| 参数          | 约束                                                                 |
| :------------ | :------------------------------------------------------------------- |
| `year`        | 必填整数，范围 1900–2100                                              |
| `title`       | 必填，去除首尾空白后非空，最长 255 字符                               |
| `description` | 可选文本，最长 65535 字节。更新时不传则保持原值                       |
| `buttons`     | 可选数组，最多 5 个，每项 `{ text, url }` 两个字段都必填；**整体替换**语义，传空数组或 `null` 表示清空 |
| `sort`        | 可选非负整数。创建时不传取默认值 `0`；更新时不传则保持原值             |

> ✅ **决策：列表不分页。** 时间轴是一份逐年记录的个人履历，规模天然很小；
> 分页反而会让 client 需要额外拉取多年数据，增加复杂度。

> ✅ **决策：按钮存成 `buttons` JSON 数组，不另建子表。** 按钮是事件的值对象
> —— 没有独立生命周期、不需要按按钮查询、永远与事件一起读写。JSON 列让
> 「读事件 = 拿到全部按钮」「存事件 = 整体替换按钮」都保持单条 SQL。
>
> ⚠️ **`buttons[].url` 的协议白名单是安全边界**：它会直接渲染成 client 的 `<a href>`，
> 放行 `javascript:` 等协议等于给后台留了一个存储型 XSS。服务端只放行站内路径与 `http(s)`，
> 前端只按「是否站内路径」分流，不重复做安全判断。

## 文件上传接口

| 方法 | 路径                 | 需登录 | 说明                        |
| :--- | :------------------- | :----: | :-------------------------- |
| POST | `/api/admin/upload`  | 仅管理员 | 上传单张图片，返回访问路径 |

请求为 `multipart/form-data`，字段名固定为 `file`；响应返回**相对路径**：

```jsonc
// 201
{
  "status": true,
  "data": {
    "url": "/uploads/3f2a1c9e-8b7d-4e5f-9a0b-1c2d3e4f5a6b.png",
    "filename": "3f2a1c9e-8b7d-4e5f-9a0b-1c2d3e4f5a6b.png",
    "size": 204800,
    "mimetype": "image/png"
  },
  "message": "图片上传成功"
}
```

该路径可直接写入 `Article.cover`，也可用于 markdown 正文插图 —— 需要多张就调用多次。

### 安全约束

| 项       | 策略                                                                     |
| :------- | :----------------------------------------------------------------------- |
| 类型     | 白名单 `image/jpeg`、`image/png`、`image/gif`、`image/webp`              |
| SVG      | **明确拒绝**。SVG 是可内嵌脚本的 XML，从同源 `/uploads` 提供会构成存储型 XSS |
| 文件名   | 服务端生成 `UUID + 白名单推导的扩展名`，**不采信客户端文件名**（防路径穿越与覆盖） |
| 大小     | 单张不超过 `UPLOAD_MAX_SIZE_MB`（默认 5 MB）                             |
| 数量     | 单次单文件，`files: 1`                                                   |
| 访问     | `express.static` 挂在 `/uploads`，`dotfiles: deny`、`index: false`，UUID 文件名可安全长缓存 |

> ⚠️ 部署提示：上传文件落在 `UPLOAD_DIR`（默认 `server/uploads/`，已被 `.gitignore` 忽略）。容器化部署时该目录需要挂载持久卷，否则重建即丢失。
