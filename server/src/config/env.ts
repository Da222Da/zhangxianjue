// src/config/env.ts
import { resolve } from "path";
import dotenv from "dotenv";
import type { SignOptions } from "jsonwebtoken";

// 本模块是应用读取环境变量的唯一入口，必须由入口文件最先 import。
// ESM 会在求值调用方之前先执行其依赖模块，因此把 dotenv.config() 收敛到这里，
// 即可保证 process.env 的填充早于 connection.ts 等模块的读取时机。
// 注意：dotenv 以 process.cwd() 为基准查找 .env，请确保从 server 目录启动（npm run dev -w server）。
dotenv.config();

/** 服务监听端口，未配置时回退 3000 */
export const PORT: number = Number(process.env.PORT) || 3000;

/** 运行环境，决定 src/config/config.json 读取哪一组数据库配置 */
export const NODE_ENV: string = process.env.NODE_ENV || "development";

/**
 * 是否启用本地开发自动登录接口
 *
 * 只允许在非 production 环境使用；即使误开，controller 也会限制回环地址。
 * 对应的 client 变量是 VITE_DEV_AUTO_LOGIN_*。
 */
export const DEV_LOGIN_ENABLED: boolean = process.env.DEV_LOGIN_ENABLED === "true";

/**
 * 开发自动登录使用的账号
 *
 * 凭据只放在 server/.env，前端 .env 只保留 VITE_DEV_AUTO_LOGIN=true 开关，
 * 避免密码被 Vite 打进前端产物。
 */
export const DEV_LOGIN_PHONE: string = process.env.DEV_LOGIN_PHONE?.trim() ?? "";
export const DEV_LOGIN_USERNAME: string = process.env.DEV_LOGIN_USERNAME?.trim() ?? "";
export const DEV_LOGIN_PASSWORD: string = process.env.DEV_LOGIN_PASSWORD ?? "";

/**
 * 校验有效期写法（如 30m / 1h / 7d），非法时回退默认值
 *
 * jsonwebtoken 的 expiresIn 只接受数字或 ms 库的时长字符串，
 * 此处做运行时校验并收窄类型，避免填错值（如 "1hour"）到调用时才炸。
 */
const parseDuration = (raw: string | undefined, fallback: "1h" | "7d"): SignOptions["expiresIn"] => {
  const value = raw?.trim();
  if (!value) {
    return fallback;
  }
  if (!/^\d+[smhd]$/.test(value)) {
    console.warn(`⚠️ 时长配置 "${value}" 格式不合法（应形如 30m / 1h / 7d），已回退为 ${fallback}`);
    return fallback;
  }
  return value as SignOptions["expiresIn"];
};

/** Access Token 有效期，缺省 1 小时 */
export const JWT_EXPIRES_IN: SignOptions["expiresIn"] = parseDuration(process.env.JWT_EXPIRES_IN, "1h");

/** Refresh Token 有效期，缺省 7 天 */
export const JWT_REFRESH_EXPIRES_IN: SignOptions["expiresIn"] = parseDuration(process.env.JWT_REFRESH_EXPIRES_IN, "7d");

/**
 * 上传文件存放目录的绝对路径
 *
 * 相对路径以 process.cwd() 为基准解析 —— 与 dotenv 查找 .env 的基准保持一致
 * （即要求从 server 目录启动）。此处刻意不用 import.meta.url：那会让本文件
 * 新增一条 TS1470 报错，而根因（package.json 不能设 type: module）无法消除，
 * 详见 server/README.md 的迁移章节。
 */
export const UPLOAD_DIR: string = resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads");

/** 单张图片大小上限（MB） */
export const UPLOAD_MAX_SIZE_MB: number = Number(process.env.UPLOAD_MAX_SIZE_MB) || 5;

/** 单张图片大小上限（字节），供 multer 的 limits 使用 */
export const UPLOAD_MAX_SIZE_BYTES: number = UPLOAD_MAX_SIZE_MB * 1024 * 1024;
