"use strict";
import { Sequelize } from "sequelize";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER, NODE_ENV } from "../config/env.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fileConfig = JSON.parse(readFileSync(join(__dirname, "..", "config", "config.json"), "utf-8"))[NODE_ENV];

/**
 * 数据库配置
 *
 * 本地开发继续读 config.json；生产部署时由 server/.env 提供 DB_*，
 * 覆盖入库配置中的连接信息，避免把生产密码写进版本库。
 */
const config = DB_NAME
  ? {
      ...fileConfig,
      username: DB_USER || fileConfig.username,
      password: DB_PASSWORD || fileConfig.password,
      database: DB_NAME,
      host: DB_HOST || fileConfig.host,
      ...(DB_PORT ? { port: DB_PORT } : {}),
    }
  : fileConfig;

const sequelizeConnection: Sequelize = new Sequelize(config.database, config.username, config.password, config);

export default sequelizeConnection;
