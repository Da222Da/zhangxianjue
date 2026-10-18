# zhangxianjue

个人站点 monorepo：一个后端服务、两个前端应用，外加内部组件库。

## 项目结构

| 目录                            | 定位                     | 技术栈                                                     | 说明                                            |
| :------------------------------ | :----------------------- | :--------------------------------------------------------- | :---------------------------------------------- |
| [`server`](./server/)           | 后端服务                 | Node.js + Express 5 + TypeScript + Sequelize 6 + MySQL      | 手机号认证 + 图形验证码、RBAC（用户 / 角色 / 权限）、书库（分卷 / 分类 / 标签 / 限免 / 游客可见）、会员申请、时间轴 / 文章 / 笔记 CRUD、分类、图片上传、Swagger 文档 |
| [`apps/admin`](./apps/admin/)   | 后台管理端               | Vue 3 + TS + Vite + Element Plus + Pinia                    | 登录后维护时间轴、文章、笔记、分类、书库（书籍 / 分卷 / 章节 / 分类 / 标签 / 限免 / 游客可见）与用户 / 会员申请 / 角色 / 权限 |
| [`apps/client`](./apps/client/) | 前台展示端               | Vue 3 + TS + Vite + Element Plus + Pinia                    | 手机号登录注册、找回密码、个人中心、书库阅读（分卷 / 限免 / VIP）、移动端导航、时间轴、攻略笔记（思维导图）与文章阅读 |
| [`packages/`](./packages/)      | 内部组件库               | —                                                           | markdown、markmap          |

## 快速开始

```bash
npm install                       # 根目录安装，workspaces 会处理所有子项目
```

### 1. 起后端

```bash
cp server/.env.example server/.env   # 然后填入 JWT_SECRET
npx sequelize-cli-ts-js db:migrate   # 在 server 目录执行
npm run dev:server                   # http://localhost:3000
```

环境变量、迁移、接口清单详见 [`server/README.md`](./server/README.md)。

### 2. 起前端

```bash
npm run dev:admin     # 后台管理端（登录后维护文章）
npm run dev:client    # 前台展示端（公开阅读）
```

两个前端都直连 `http://localhost:3000/api`，可用 `VITE_API_BASE_URL` 覆盖。

**本地免登录（可选）**：复制两个前端的 env 示例并填入管理员账号：

```bash
cp apps/client/.env.example apps/client/.env
cp apps/admin/.env.example apps/admin/.env
```

在两个前端 `.env` 里设置 `VITE_DEV_AUTO_LOGIN=true`，并填入
`VITE_DEV_AUTO_LOGIN_PHONE` / `VITE_DEV_AUTO_LOGIN_USERNAME` 与 `VITE_DEV_AUTO_LOGIN_PASSWORD`；
开发模式下打开登录页就会自动登录。账号密码留空时，会回退到 `server/.env` 的
`DEV_LOGIN_PHONE` / `DEV_LOGIN_PASSWORD`（同时需要 `DEV_LOGIN_ENABLED=true`）。
开发登录接口只接受本机回环地址。`.env` 已被 gitignore，**不要用于生产环境**。

### 3. 一次起全（后端 + 两个前端）

```bash
npm run dev          # concurrently 并行拉起三个，日志带 [server] / [admin] / [client] 前缀
```

Ctrl+C 会一起停掉三个。只想跑其中一两个，仍可用上面的 `dev:xxx` 单独启动。

> ⚠️ **不要**把 `npm run dev` 写成 `npm run dev:client && npm run dev:admin && npm run dev:server`（或把 `&&` 换成 `&`）。
> 这三个都是常驻进程，`&&` 等不到前一个退出；而 npm 在 Windows 上经 `cmd.exe` 执行脚本，`&` 同样只是**顺序**分隔符，
> 并非并行。两者都只会启动第一个然后卡住。并行必须交给 `concurrently` 这类工具。
>
> ⚠️ 端口占用时**两个前端都只会顺延、不会报错**：`apps/admin` 在 `vite.config.ts` 里写死 `8080`，
> `apps/client` 用 Vite 默认 `5173`，一旦被占（例如你已开着一份）就依次试 8081 / 5174……
> 已实测：admin 会打印 `Port 8080 is in use, trying another one...` 后落到 8081。
> 因此**以终端实际打印的 Local 地址为准**，别默认还是原来那个端口。
> 想让端口被占时直接报错（而不是顺延），给对应 `vite.config.ts` 的 `server` 加 `strictPort: true`。

## 常用命令

| 命令                                                    | 作用                        |
| :------------------------------------------------------ | :-------------------------- |
| `npm run dev`                                           | 并行启动后端 + 两个前端     |
| `npm run dev:server` / `dev:admin` / `dev:client`       | 分别启动各子项目            |
| `npm run build -w admin` / `-w client`                  | 构建前端                    |
| `npm run dev:markdown` / `build:markdown` / `test:markdown` | markdown 组件库的开发 / 构建 / 测试 |
| `npm run dev:markmap` / `build:markmap` / `test:markmap`    | markmap 组件库的开发 / 构建 / 测试  |

> ⚠️ 改动 `packages/*` 的源码后**必须重新构建该包**：消费方读的是 `dist/`，而 `dist/` 被 gitignore、未入库。

## 文档入口

| 文档                                          | 内容                                                       |
| :-------------------------------------------- | :--------------------------------------------------------- |
| [`Prompt.md`](./Prompt.md)                    | 开发约定与需求说明：分层职责、代码质量、输出风格、自检清单  |
| [`server/README.md`](./server/README.md)      | 后端环境变量、迁移、接口与参数约束                          |

**接口契约以 server 的 Swagger（`http://localhost:3000/api-docs`）为唯一权威。**
要改契约，先改 server（Swagger 注释与 README），再改消费端。

## 关键约定速览

- **分层不可跨层调用**：后端 routes / controllers / services / models 四层；前端 view / component / composable / store / api 五层。详见 [`Prompt.md`](./Prompt.md)。
- **响应体统一带 `status` 布尔标记**：成功 `true`、错误 `false`，前端拦截器据此判定。
- **权限是 RBAC**：`Roles` + `Permissions` + `RolePermissions`，写接口用 `requirePermission(...)` 校验编码；
  内置角色与权限点由**迁移**写入（不是 seeder）。前端只用同一套编码控制菜单与路由入口，真正的拦截在服务端。
- **登录统一用手机号或用户名**：client 走 `/api/auth/login`，带一次性图形验证码；
  admin 走 `/api/auth/admin/login`，不要求验证码但会校验 `admin:access`。
  两个前端可在本地 `.env` 中配置 `VITE_DEV_AUTO_LOGIN_*`，开发模式下自动登录；
  `.env` 已被 gitignore，**不要用于生产构建**。
- **书库 / 笔记按内容鉴权**：列表公开并显示「限免 / VIP」角标；`is_free` 内容游客可读，
  非限免内容需要 `library:view`（会员 / 朋友 / 管理员）。会员升级走「用户申请 → 管理员审核」，
  默认有效期 1 年，到期后服务端自动降级为普通用户。
- **游客可见是独立开关**：文章 / 笔记 / 书籍的 `guest_visible=false` 时，未登录游客在列表与详情中都看不到；
  登录后的普通用户即可正常访问，与 `is_free` 的 VIP 阅读权益互不影响。
- **图片存相对路径**（如 `/uploads/xxx.png`），展示前经各 app 的 `resolveAssetUrl()` 拼接口 origin。
- **共享包的类型由包自身 `types/index.d.ts` 提供**，消费端不各自写环境声明。
- **重型可视化组件局部引入**，不在 `main.ts` 全局注册，避免打进入口包。
