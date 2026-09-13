# 接口设计

## 目录

[[toc]]

## 接口设计

### 认证 API

- POST /api/auth/register 用户注册
- POST /api/auth/login 用户登录，返回 JWT Token
- GET /api/auth/getUserInfo 获取用户信息（需登录）

### 用户管理 API

- GET /api/users 获取用户列表
- GET /api/users/:id 获取单个用户信息
- POST /api/users 创建新用户
- PUT /api/users/:id 更新用户信息
- DELETE /api/users/:id 删除用户

### 角色权限管理 API

- GET /api/roles 获取角色列表
- POST /api/roles 创建新角色
- PUT /api/roles/:id 更新角色
- DELETE /api/roles/:id 删除角色
- GET /api/roles/:id/permissions 获取角色的权限列表

## FAQ 常见问题

### 1. 如何配置 Express 接口？

1. 在 `routes` 目录下创建一个新的文件，例如 `authRoutes.js`。

   ```ts
   import express from "express";
   import { register } from "../controllers/authController.ts";

   const router = express.Router();

   router.post("/register", register);

   export default router;
   ```

2. 在 `routes/index.ts` 路由入口文件中，引入并使用该路由。

   ```ts
   // src/routes/index.ts
   import { Router } from "express";
   import authRoutes from "./authRoutes.ts";

   const router = Router();

   router.use("/", authRoutes);

   export default router;
   ```

3. 在 `app.ts` 中挂载路由

   ```ts
   import express from "express";
   import routes from "./routes/index.ts";

   const app = express();
   const PORT = process.env.PORT || 3000;

   // 集成路由
   app.use("/api", routes);

   app.listen(PORT, () => {
     console.log(`🚀 服务器启动在 http://localhost:${PORT}`);
   });
   ```
