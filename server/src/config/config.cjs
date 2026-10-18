// src/config/config.cjs
// Sequelize CLI 的配置入口：与运行时 models/connection.ts 使用同一套 DB_* 覆盖规则。
// CLI 不会自动读取 server/.env，这里显式加载，保证迁移与线上连接指向同一个库。
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const configs = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const env = process.env.NODE_ENV || "development";

if (process.env.DB_NAME) {
  configs[env] = {
    ...configs[env],
    username: process.env.DB_USER || configs[env].username,
    password: process.env.DB_PASSWORD || configs[env].password,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || configs[env].host,
    ...(Number(process.env.DB_PORT) ? { port: Number(process.env.DB_PORT) } : {}),
  };
}

module.exports = configs;
