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
├── middlewares     # 中间件：authMiddleware 鉴权、optionalAuthMiddleware 可选鉴权、permissionMiddleware 权限校验、errorMiddleware 统一错误处理
├── migrations      # Sequelize 迁移文件（RBAC 的角色 / 权限点也在这里初始化）
├── models          # 数据层：模型定义与读写
│   ├── index.ts       # barrel，统一导出 sequelize、各模型与关联
│   ├── connection.ts  # Sequelize 实例
│   ├── article.ts     # 文章模型
│   ├── book.ts        # 书籍模型（书库，含 is_free / guest_visible 开关）
│   ├── bookCategory.ts # 书籍分类（扁平，后台可增删改）
│   ├── bookTag.ts     # 书籍-标签关联表
│   ├── category.ts    # 分类模型（树形，parent_id 邻接表）
│   ├── chapter.ts     # 章节模型（Markdown 正文，归属分卷）
│   ├── volume.ts      # 分卷模型（书籍 → 分卷 → 章节）
│   ├── tag.ts         # 书籍标签（扁平，后台可增删改）
│   ├── membershipApplication.ts # 会员升级申请
│   ├── note.ts        # 笔记模型（正文为思维导图 Markdown）
│   ├── permission.ts  # 权限点模型
│   ├── role.ts        # 角色模型
│   ├── rolePermission.ts # 角色-权限关联（复合主键）
│   ├── timelineEvent.ts # 时间轴事件模型
│   └── users.ts       # 用户模型（phone / role_id / membership_expires_at / status）
├── seeders         # 示例数据（npx sequelize-cli-ts-js db:seed:all）
├── routes          # 路由层：路径映射
│   ├── index.ts       # 路由入口，挂载各子路由
│   ├── authRoutes.ts  # 注册 / 登录 / 验证码 / 密码管理
│   ├── articleRoutes.ts # 文章接口
│   ├── adminMembershipRoutes.ts # 会员申请审核
│   ├── bookRoutes.ts  # 后台书库管理
│   ├── categoryRoutes.ts # 分类接口
│   ├── libraryRoutes.ts # 书库阅读（client）
│   ├── membershipRoutes.ts # 会员申请（client）
│   ├── noteRoutes.ts  # 笔记接口
│   ├── permissionRoutes.ts # 权限点目录接口
│   ├── roleRoutes.ts  # 角色与权限分配接口
│   ├── timelineRoutes.ts # 时间轴接口
│   ├── uploadRoutes.ts # 图片上传接口
│   └── userRoutes.ts  # 用户管理接口
├── services        # 服务层：业务逻辑与数据编排
│   ├── accessService.ts   # 访客权益（VIP / 笔记管理员）判定
│   ├── authService.ts
│   ├── bookCategoryService.ts
│   ├── bookService.ts
│   ├── captchaService.ts
│   ├── membershipService.ts
│   ├── permissionService.ts
│   ├── roleService.ts
│   └── userService.ts
├── utils           # 工具
│   ├── constants      # HttpStatusCode / ErrorCode / permissions 常量
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
| `DEV_LOGIN_ENABLED`  | 否   | `false`       | 本地开发自动登录接口开关。仅 `NODE_ENV !== production` 且为 `true` 时挂载，且只接受本机请求 |
| `DEV_LOGIN_PHONE` / `DEV_LOGIN_USERNAME` | 否 | 无 | 开发自动登录账号，手机号与用户名二选一，手机号优先 |
| `DEV_LOGIN_PASSWORD` | 否   | 无            | 开发自动登录密码。与上面的账号一起供 `/api/auth/dev/login` 使用 |

### 2. 初始化数据库

```bash
npx sequelize-cli-ts-js db:migrate
npx sequelize-cli-ts-js db:seed:all   # 可选：注入示例分类树 + 笔记 + 文章 + 时间轴事件
```

> `db:migrate` 除了业务表，还会写入 RBAC 的**系统数据**：内置角色（管理员 / 普通用户）
> 与 9 个权限点，并给管理员角色分配全部权限。这些数据不能交给 seeder —— 中间件依赖它们。

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
> | `demo-users` | 按手机号或用户名判重，已存在则跳过 |
> | `demo-books` | 书籍按标题、章节按「书名 + 章节标题」判重 |
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
{
  "status": true,
  "statusCode": 200,
  "message": "登录成功",
  "data": { "token": "...", "refreshToken": "...", "user": { "id": 1, "role_name": "管理员", "permissions": ["admin:access"] } }
}

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

| 方法 | 路径                     | 需登录 | 说明                                                              |
| :--- | :----------------------- | :----: | :---------------------------------------------------------------- |
| GET  | `/api/auth/captcha`      |   否   | 签发一次性图形验证码（SVG data URI）                              |
| POST | `/api/auth/register`     |   否   | 手机号注册，需图形验证码；成功后**直接返回双令牌**（等同登录）    |
| POST | `/api/auth/login`        |   否   | client 登录：手机号 / 用户名 + 密码 + 图形验证码，见下             |
| POST | `/api/auth/admin/login`  |   否   | 后台登录：手机号 / 用户名 + 密码，不要求验证码；校验 `admin:access` |
| POST | `/api/auth/dev/login`    |   否   | **仅本地开发**：跳过验证码，供两个前端的 `.env` 自动登录使用        |
| POST | `/api/auth/password/forgot` |  否 | 忘记密码：手机号 + 图形验证码 + 新密码                            |
| PUT  | `/api/auth/password`     |   是   | 已登录修改密码（校验旧密码）                                      |
| POST | `/api/auth/refresh`      |   否   | 用 `refreshToken` 换取新的 `accessToken`；账号被禁用时返回 403    |
| GET  | `/api/auth/getUserInfo`  |   是   | 获取当前登录用户信息（含角色名与权限编码）                        |

> ⚠️ 注册与登录的响应里都能拿到 `permissions` 数组，前端据此渲染菜单与按钮；
> 密码哈希永远不会出现在任何响应中。

### 手机号认证与图形验证码

- `Users.phone` 是账号的手机号（`VARCHAR(20)`，唯一索引，允许 NULL），
  client 与 admin 都可以用手机号或用户名登录；`Users.email` 已由迁移删除。
- **登录支持两种标识（`phone` / `username` 二选一）**：
  - client（`/api/auth/login`）：`{ phone | username, password, captchaId, captchaCode }`，
    `phone` 强制校验验证码；`username` 若带了验证码字段也会校验；
  - admin（`/api/auth/admin/login`）：`{ phone | username, password }`，不要求验证码，
    登录后校验账号是否具备 `admin:access`。
- **本地开发自动登录**（`/api/auth/dev/login`）：
  - 只有 `NODE_ENV !== production` 且 `DEV_LOGIN_ENABLED=true` 时才挂载；
  - 只接受 `127.0.0.1` / `::1` 回环地址，账号密码仍完整校验，仅跳过图形验证码；
  - 请求体可以带 `phone` / `username` + `password`，也可以完全省略；
    省略时使用 `server/.env` 的 `DEV_LOGIN_PHONE`（或 `DEV_LOGIN_USERNAME`）+
    `DEV_LOGIN_PASSWORD`；
  - 两个前端可以在自己的 `.env` 填 `VITE_DEV_AUTO_LOGIN_PHONE` +
    `VITE_DEV_AUTO_LOGIN_PASSWORD`；留空则自动回退到 server 的 `DEV_LOGIN_*`；
  - ⚠️ 这个接口能绕过验证码，只应在本机开发环境开启，生产环境必须保持关闭；
    `VITE_*` 变量在开发模式下会进入前端 bundle，`.env` 不要提交。
- **图形验证码**由服务端用 SVG 自绘（无第三方依赖）：
  - `GET /api/auth/captcha` 返回 `{ captchaId, image, expiresIn }`，`image` 是 data URI；
  - 有效期 5 分钟；**一次性**，无论校验成功还是失败都会失效；
  - ⚠️ 存在进程内存里：多实例部署需要换成 Redis 等共享存储。
- **注册直接签发令牌**：注册本身已校验过验证码，若再要求用户登录一次就得重新过一张验证码，
  因此注册成功即建立会话。
- **忘记密码只校验图形验证码**（需求确认的方案）：
  ⚠️ 生产环境必须追加短信验证码或其它二次验证，否则知道手机号即可重置密码。
- 修改密码不会让已签发的 accessToken 失效（令牌无状态）；需要强制下线时应引入
  `passwordChangedAt` / 令牌版本号。

### 令牌约定

- 载荷为 `{ id, role_id, type }`，`type` 区分 `access` / `refresh`。
- ⚠️ **两种令牌不可互换**：`authMiddleware` 只接受 `access`，刷新接口只接受 `refresh`。
  缺少该标记的旧令牌一律无效，升级后需重新登录。
- **刷新不轮换 refreshToken**：服务端无状态存储，无法吊销已签发的令牌，
  轮换只会制造「旧令牌依然有效」的假象。refreshToken 到期即需重新登录。

## 权限（RBAC）

### 数据模型

| 表 | 说明 |
| :--- | :--- |
| `Roles` | 角色。内置 `admin` / `user` / `member`（会员）/ `friend`（朋友），`is_system = 1` 的角色不可删除 |
| `Permissions` | 权限点目录。由代码与迁移定义，后台不提供增删 |
| `RolePermissions` | 角色-权限关联，复合主键 `(role_id, permission_id)`，外键级联删除 |
| `Users.role_id` | 外键到 `Roles.id`（`ON DELETE RESTRICT`）；`Users.status` 为 1 启用 / 0 禁用 |
| `Users.membership_expires_at` | 会员到期时间；仅会员角色有值，到期后服务端自动降级为普通用户 |

> ✅ 决策：**内置角色与权限点在迁移里写入**，而不是 seeder。
> 中间件与注册接口都依赖它们存在，只执行 `db:migrate` 的部署环境也必须拿到完整目录。
> `db:seed:all` 只负责示例内容（分类 / 笔记 / 文章 / 时间轴 / 演示用户 / 示例书籍）。

内置角色的权限分配：

| 角色 | code | 权限 |
| :--- | :--- | :--- |
| 管理员 | `admin` | 全部 11 个权限（含 `library:view`、`book:manage`） |
| 普通用户 | `user` | 无（注册后的默认角色） |
| 会员 | `member` | `library:view`（会员申请审核通过后授予，默认有效期 1 年；到期自动降级） |
| 朋友 | `friend` | `library:view`（由管理员直接分配） |

### 权限点

| 编码 | 名称 | 分组 |
| :--- | :--- | :--- |
| `admin:access` | 后台访问 | 系统 |
| `user:manage` | 用户管理 | 系统 |
| `role:manage` | 角色管理 | 系统 |
| `permission:manage` | 权限管理 | 系统 |
| `article:manage` | 文章管理 | 内容 |
| `note:manage` | 笔记管理 | 内容 |
| `category:manage` | 分类管理 | 内容 |
| `timeline:manage` | 时间轴管理 | 内容 |
| `upload:manage` | 图片上传 | 内容 |
| `library:view` | VIP 阅读权益 | 内容 |
| `book:manage` | 书库管理 | 内容 |

编码常量在 `src/utils/constants/permissions.ts`，必须与
`src/migrations/20261017000009-create-permissions.ts`（前 9 个）和
`src/migrations/20261017000015-add-library-rbac.ts`（书库两个）中的种子保持一致。
`library:view` 的语义已由 `20261017000022-rename-library-permission.ts` 调整为
「VIP 阅读权益」：可阅读非限免的书籍、章节与笔记。

### 校验方式

请求经过 `authMiddleware`（校验 accessToken）后，由 `requirePermission(...codes)` 做授权：

- 每次请求都重新读取用户的当前角色、账号状态与角色权限 → **改权限 / 禁用账号立即生效**，
  不必等 accessToken 过期；
- 权限为 **OR** 语义：传入多个编码时命中任意一个即可；
- 未登录 / 令牌无效 → 401；已登录但缺少权限 → 403。

写接口的权限对应关系：文章 → `article:manage`、笔记 → `note:manage`、分类 → `category:manage`、
时间轴 → `timeline:manage`、上传 → `upload:manage`、用户 → `user:manage`、
角色 → `role:manage`、权限分配 → `permission:manage`、书库管理（含分类 / 标签）→ `book:manage`。
`library:view` 不再是书库入口的准入条件，而是**非限免内容**的阅读权益。

### 防锁死约束

| 约束 | 位置 |
| :--- | :--- |
| 内置角色不可删除 | `roleService.deleteRole` |
| 管理员角色必须保留 `admin:access` | `roleService.setRolePermissions` |
| 仍有成员的角色不可删除 | `roleService.deleteRole` |
| 不能禁用 / 删除自己、不能改自己的角色 | `userService.updateUser` / `deleteUser` |
| 最后一名启用状态的管理员不能被禁用、降级或删除 | `userService` |

## 用户 / 角色 / 权限接口

| 方法 | 路径 | 所需权限 | 说明 |
| :--- | :--- | :--- | :--- |
| GET | `/api/admin/user` | `user:manage` | 分页列表，支持 `keyword` / `role_id` / `status` / `page` / `pageSize` |
| GET | `/api/admin/user/:id` | `user:manage` | 用户详情 |
| POST | `/api/admin/user` | `user:manage` | 创建用户 |
| PUT | `/api/admin/user/:id` | `user:manage` | 更新用户名 / 手机号 / 头像 / 角色 / 会员到期 / 状态 |
| PUT | `/api/admin/user/:id/password` | `user:manage` | 重置密码（不校验旧密码） |
| DELETE | `/api/admin/user/:id` | `user:manage` | 删除用户 |
| GET | `/api/admin/role` | `role:manage` / `user:manage` / `permission:manage` | 角色列表（含权限与成员数） |
| POST | `/api/admin/role` | `role:manage` | 创建自定义角色（`code` 由服务端生成） |
| PUT | `/api/admin/role/:id` | `role:manage` | 更新角色名与描述 |
| DELETE | `/api/admin/role/:id` | `role:manage` | 删除角色 |
| PUT | `/api/admin/role/:id/permissions` | `permission:manage` | 重设角色权限（整体替换） |
| GET | `/api/admin/permission` | `role:manage` / `permission:manage` | 权限点目录 |

> 角色列表对 `user:manage` 与 `permission:manage` 也开放：用户管理页的角色下拉与
> 权限管理页的角色切换都需要这份参考数据，避免为读一行角色名额外授予 `role:manage`。

**会员到期**：创建 / 更新用户时可传 `membership_expires_at`（ISO 日期时间）。
会员角色不传默认当前时间 + 1 年；非会员角色统一存 `null`。
会员到期后，登录、鉴权、读取用户资料与后台用户列表都会惰性把角色降级为 `user`。

## 书库接口

书库是「书籍 → 分卷 → 章节」三级结构，书籍再挂一个分类与多个标签：

| 表 | 说明 |
| :--- | :--- |
| `Books` | 书名 / 封面 / 描述 / `category_id` / `is_free` / `guest_visible` / 排序；已删除旧 `category` 与 `level`（难度）字段 |
| `Volumes` | 所属书籍 + 分卷名称 / 排序；`book_id` 外键 `ON DELETE CASCADE` |
| `Chapters` | 所属书籍 + 所属分卷 + 章节标题 / 导读 / Markdown 正文 / 排序；`book_id` 与 `volume_id` 外键均为 `ON DELETE CASCADE` |
| `BookCategories` | 扁平分类，后台可增删改；迁移内置 教程 / 善书 / 工具书 / 真实故事 |
| `Tags` | 扁平标签，后台可增删改；迁移内置 道藏 / 佛经 / 易经 / 真实故事 |
| `BookTags` | 书籍 ↔ 标签多对多关联；删书或删标签时关联行级联清理 |

> 迁移 `20261018000003-create-volumes` 会为已有章节自动创建「默认分卷」并归入，
> 因此升级后旧数据不会丢失；之后可以在 admin 里改名、拆分或新增分卷。

### client 阅读接口（列表公开，非限免需 `library:view`）

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| GET | `/api/library/book` | **公开**。游客只返回 `guest_visible=true` 的书籍；登录用户返回全部。带 `category` / `tags` / `is_free` / `guest_visible` / `volume_count` / `chapter_count` |
| GET | `/api/library/book/:id` | 游客不可见的书返回 404；限免书籍公开；VIP 专属书籍需登录且具备 `library:view`，否则 403。返回按分卷组织的章节列表，不含正文 |
| GET | `/api/library/book/:bookId/chapter/:chapterId` | 章节正文；按所属书籍的 `guest_visible` 与 `is_free` 做同样的判定 |

> ✅ 决策：列表对登录用户返回全部书籍，前端按 `is_free` 打「限免 / VIP」角标；
> 真正的正文拦截发生在详情与章节接口。这样登录后的普通用户能看到 VIP 卡片并知道升级后能读什么。
> `library:view` 只分配给管理员、会员和朋友；普通用户访问 VIP 正文返回 403。
>
> **游客可见（`guest_visible`）**：关闭后仅未登录游客看不到该内容（列表过滤 + 详情 404）；
> 登录后的普通用户、会员、朋友、管理员都不受影响。它与 `is_free`（阅读权益）是两个独立开关。

### 后台管理接口（需登录 + `book:manage`）

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| GET | `/api/admin/book` | 书籍列表，支持 `keyword` 命中书名 |
| POST | `/api/admin/book` | 创建书籍 |
| GET | `/api/admin/book/:id` | 书籍详情 + 分卷与章节列表 |
| PUT | `/api/admin/book/:id` | 更新书籍元数据（含 `guest_visible`） |
| DELETE | `/api/admin/book/:id` | 删除书籍（分卷、章节与标签关联级联删除） |
| POST | `/api/admin/book/:id/volume` | 新增分卷 |
| PUT | `/api/admin/book/:id/volume/:volumeId` | 更新分卷名称 / 排序 |
| DELETE | `/api/admin/book/:id/volume/:volumeId` | 删除分卷（**该卷下章节一并删除**） |
| POST | `/api/admin/book/:id/chapter` | 新增章节；`volume_id` 必填且必须属于该书 |
| GET | `/api/admin/book/:id/chapter/:chapterId` | 章节正文 |
| PUT | `/api/admin/book/:id/chapter/:chapterId` | 更新章节；传 `volume_id` 可移动到另一分卷 |
| DELETE | `/api/admin/book/:id/chapter/:chapterId` | 删除章节 |
| GET / POST | `/api/admin/book/category` | 分类列表 / 新增分类 |
| PUT / DELETE | `/api/admin/book/category/:id` | 编辑 / 删除分类（删后书籍 `category_id` 置空） |
| GET / POST | `/api/admin/book/tag` | 标签列表 / 新增标签 |
| PUT / DELETE | `/api/admin/book/tag/:id` | 编辑 / 删除标签（删后关联行级联清理） |

参数约束：书籍 `title` / 分卷 `title` / 章节 `title` 必填且不超过 255 字符；
`description` / `summary` / `content` / `cover` 为 TEXT，上限 65535 字节；`sort` 为非负整数；
`category_id` 为可选正整数或 `null`；`tag_ids` 为标签 id 数组（**整体替换**语义，空数组表示清空）；
`is_free` 与 `guest_visible` 为布尔值。分类 / 标签名称最长 100 字符且全局唯一。
分卷按 `sort ASC, id ASC` 排序，章节在各自分卷内同样按 `sort ASC, id ASC` 排序。
`volume_id` 在创建章节时必填；更新章节时可选，传入即移动到该分卷。

`db:seed:all` 会写入 3 本示例书（SDL 与太空战机 / 模块化编程与幽灵逃生 / 分层架构与阳光岛），
按「书名 + 章节标题」判重，可重复执行；新建时分别挂上分类与标签、写入「默认分卷」，并让第 1、3 本为限免。

## 会员申请接口

会员升级采用「用户申请 → 管理员审核」流程：

| 方法 | 路径 | 所需权限 | 说明 |
| :--- | :--- | :--- | :--- |
| POST | `/api/membership/apply` | 登录 | 提交申请；管理员 / 未到期会员 / 已有 pending 申请会被拒绝；已过期会员会先自动降级，可重新申请 |
| GET | `/api/membership/status` | 登录 | 查询最近一次状态：`none` / `pending` / `approved` / `rejected` |
| GET | `/api/admin/membership` | `user:manage` | 分页查询申请（可按 status 过滤） |
| PUT | `/api/admin/membership/:id` | `user:manage` | `{ approve: true/false }` 审核；通过后把角色改为 `member`，有效期默认 1 年 |

- 申请记录在 `MembershipApplications` 表（`user_id` 外键 `ON DELETE CASCADE`）。
- 审核通过后角色立即变成会员，并写入默认 1 年后的 `membership_expires_at`；
  `requirePermission` 每次请求都读库，所以**不需要用户重新登录**。
- 会员到期后由登录 / 鉴权 / 用户资料 / 后台用户列表惰性降级为普通用户；
  降级后可以重新提交会员申请。
- 拒绝只标记状态，用户可以再次提交。
- 管理员账号不能申请（避免把管理员降级成会员）。

### 演示账号（`db:seed:all` 写入）

| 手机号 | 用户名 | 角色 | 能否阅读 VIP 内容 |
| :--- | :--- | :--- | :--- |
| `13800000001` | 会员小雨 | 会员 | ✅ |
| `13800000002` | 朋友阿星 | 朋友 | ✅ |
| `13800000003` | 普通小林 | 普通用户 | ❌（限免内容可读，可走会员申请流程） |

统一密码：`abc123456`。管理员账号的手机号为 `15826653490`（用户名 `zhangxianjue`），
可用手机号或用户名登录 admin 与 client；密码只保存在本地数据库 / `.env`，不写入仓库。
管理员角色已具备 `library:view`，可以阅读全部内容。

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
| GET    | `/api/admin/article`                |   否   | 分页查询列表，支持 `keyword` / `category_id` / `page` / `pageSize`；游客只返回 `guest_visible=true` 的文章 |
| GET    | `/api/admin/article/:id`            |   否   | 查询文章详情；游客不可见返回 404                                  |
| POST   | `/api/admin/article`                |   是   | 创建文章（**只写元数据**，`content` 落库为空串）                  |
| PUT    | `/api/admin/article/:id`            |   是   | 更新元数据（**不触碰正文**）                                      |
| PUT    | `/api/admin/article/:id/content`    |   是   | 只更新正文                                                        |
| DELETE | `/api/admin/article/:id`            |   是   | 删除文章                                                          |

写操作（POST / PUT / DELETE）需在请求头携带 `Authorization: Bearer <token>`，且角色必须具备 `article:manage` 权限；
token 由 `POST /api/auth/login` 获取，过期后用 `POST /api/auth/refresh` 静默续期。读接口公开，
但未登录游客只返回 `guest_visible=true` 的文章（详情接口对隐藏文章返回 404）；
携带有效 token 的登录用户可读取全部文章。

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
| `guest_visible` | 可选布尔值。创建时不传默认 `true`（游客可见）；更新时不传则保持原值        |
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
| GET    | `/api/admin/note`                    |   否   | 分页查询列表，支持 `keyword` / `category_id` / `page` / `pageSize`；游客只返回 `guest_visible=true` 的笔记，登录用户返回全部 |
| GET    | `/api/admin/note/:id`                |   否   | 查询笔记详情（**含 `content`**）；游客不可见返回 404；VIP 专属笔记需 `library:view` 或 `note:manage`，否则 403 |
| POST   | `/api/admin/note`                    |   是   | 创建笔记，只写元数据，`content` 落库为空串；`is_free` 默认 `false` |
| PUT    | `/api/admin/note/:id`                |   是   | 更新元数据（封面 / 标题 / 描述 / 分类 / 访问 / 排序），**不触碰正文** |
| PUT    | `/api/admin/note/:id/content`        |   是   | **只**更新正文，请求体中的其它字段一律忽略                    |
| DELETE | `/api/admin/note/:id`                |   是   | 删除笔记                                                      |

> ⚠️ **列表接口不返回 `content` 字段**（文章列表同样如此）：正文动辄数 KB，
> 而卡片页与表格页都只用元数据，整列返回纯属浪费带宽。需要正文调用方走 `GET /:id`。
> 消费端请勿假设列表元素含 `content`。

> ⚠️ 分成两个写接口是为了与 admin 的两个弹窗一一对应（元数据弹窗 / 内容弹窗各管一半字段），
> 避免"部分更新"语义下两边互相覆盖。正文接口传空串表示清空正文。

> ✅ 决策：笔记与书籍都带 `is_free` 限免开关，文章 / 笔记 / 书籍都带 `guest_visible` 游客可见开关。
> 列表对登录用户返回全部内容供前端打「限免 / VIP」角标；游客与普通用户打开 VIP 笔记详情时由服务端返回 403。
> `guest_visible=false` 的内容对未登录游客在列表中被过滤、详情返回 404，登录用户不受影响。

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
| `is_free`     | 可选布尔值。创建时不传默认 `false`（VIP 专属）；更新时不传则保持原值        |
| `guest_visible` | 可选布尔值。创建时不传默认 `true`（游客可见）；更新时不传则保持原值        |
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
| POST | `/api/admin/upload`  | `upload:manage` | 上传单张图片，返回访问路径 |

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
