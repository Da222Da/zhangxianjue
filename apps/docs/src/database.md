# 数据表

## 目录

[[toc]]

## 数据表设计

### User 用户表

| 字段名    | 类型    | 描述             |
| :-------- | :------ | :--------------- |
| id        | INTEGER | 主键，自增       |
| username  | STRING  | 用户名，唯一     |
| email     | STRING  | 电子邮件，唯一   |
| avatar    | STRING  | 头像URL，可选    |
| password  | STRING  | 加密后的密码     |
| role_id   | INTEGER | 关联角色表的外键 |
| createdAt | DATE    | 创建时间         |
| updatedAt | DATE    | 更新时间         |

1. 生成 User 模型文件与迁移文件：`npx sequelize-cli-ts-js model:generate --name User --attributes username:string,email:string,avatar:string,password:string,role_id:int`

2. 执行迁移文件: `npx sequelize-cli-ts-js db:migrate`

### Article 文章表

| 字段名      | 类型    | 描述       |
| :---------- | :------ | :--------- |
| id          | INTEGER | 主键，自增 |
| title       | STRING  | 标题，唯一 |
| content     | TEXT    | 内容，唯一 |
| cover       | TEXT    | 封面       |
| desctiption | TEXT    | 描述       |
| created_at  | DATE    | 创建时间   |
| updated_at  | DATE    | 更新时间   |

1.  生成 Articles 模型文件与迁移文件：`npx sequelize-cli-ts-js model:generate --name Article --attributes title:string,content:text`

2.  执行迁移文件: `npx sequelize-cli-ts-js db:migrate`

## FAQ 常见问题

### 1. 如何安装 MySQL 数据库？？

1. 安装 Docker Desktop，并启动它；

2. 在项目根目录下创建 docker-compose.yml 文件，并添加以下内容：

   ```yml
   version: "3.8"

   services:
   mysql:
   image: mysql:8.0 # 使用的镜像及版本
   container_name: mysql-server # 容器名称（相当于 --name）
   environment: # 环境变量（相当于 -e）
   MYSQL_ROOT_PASSWORD: 4890441 # root 用户密码（务必修改！）
   MYSQL_DATABASE: zhangxianjue_database # 容器启动时自动创建的数据库名（可选）
   ports: # 端口映射（相当于 -p）- "3306:3306" # 宿主机端口:容器端口，宿主机端口可改
   ```

3. 在Docker Desktop中，安装并启动 MySQL 数据库：docker-compose up -d

4. 在 MySQL 数据库可视化工具中，查看是否链接成功。

### 2. 如何链接 MySQL 数据库？

1. 安装依赖：

   ```bash
   npm i sequelize  mysql2
   npm i @types/sequelize
   npm i -g sequelize-cli sequelize-cli-ts-js
   ```

2. 使用 `npx sequelize-cli init` 指令: 生成 `config/config.json` 存放数据库连接信息、`models/connection.ts` 连接数据库文件

   > 由于 `sequelize-cli init` 无法生成 `.TS` 文件，因此需要使用 `sequelize-cli-ts-js init` 替代。

   ```json
   {
     "development": {
       "username": "root",
       "password": "4890441",
       "database": "zhangxianjue_development",
       "host": "127.0.0.1",
       "dialect": "mysql",
       "timezone": "+08:00"
     },
     "production": {
       "username": "root",
       "password": null,
       "database": "database_production",
       "host": "127.0.0.1",
       "dialect": "mysql"
     }
   }
   ```

   ```ts
   // models/connection.ts
   "use strict";
   import { Sequelize } from "sequelize";
   import { fileURLToPath } from "url";
   import { dirname, join } from "path";
   import { readFileSync } from "fs";

   const __filename = fileURLToPath(import.meta.url);
   const __dirname = dirname(__filename);
   const env = process.env.NODE_ENV || "development";
   const config = JSON.parse(
     readFileSync(join(__dirname, "..", "config", "config.json"), "utf-8"),
   )[env];
   const sequelizeConnection: Sequelize = new Sequelize(
     config.database,
     config.username,
     config.password,
     config,
   );

   export default sequelizeConnection;
   ```

### 3. 如何创建 MySQL 数据表？

> Models 模型文件，将数据表抽象成 JavaScript 类（包含表结构、增删改查方法、表间关系）。
> Migrations 迁移文件，将数据库的每一次建表、加字段、改类型，都变成可执行的代码文件。3. 使用 `npx

1. sequelize-cli-ts-js model:generate --name Article --attributes title:string,content:text`指令: 生成模型文件和执行文件

   ```ts
   "use strict";
   import { Model, DataTypes } from "sequelize";
   import sequelize from "./connection.ts";
   export interface ArticleAttributes {
     title: string;
     content: string;
   }
   class Article extends Model<ArticleAttributes> implements ArticleAttributes {
     title!: string;
     content!: string;
   }
   Article.init(
     {
       title: DataTypes.STRING,
       content: DataTypes.TEXT,
     },
     {
       sequelize,
       modelName: "Article",
     },
   );

   export default Article;
   ```

2. 执行迁移文件: `sequelize db:migrate`

### 4. .sequelizerc 配置文件是干嘛的？

> sequelize-cli 的配置文件，用于配置迁移文件路径、模型文件路径等。

```js
const path = require("path");

module.exports = {
  // 指定数据库配置文件路径
  config: path.resolve("src", "config", "config.json"),

  // 指定迁移文件存放路径
  "migrations-path": path.resolve("src", "migrations"),

  // 指定模型文件存放路径
  "models-path": path.resolve("src", "models"),

  // 指定种子文件存放路径
  "seeders-path": path.resolve("src", "seeders"),
};
```
