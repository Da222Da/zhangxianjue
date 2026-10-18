// src/services/captchaService.ts
import { randomInt, randomUUID } from "node:crypto";
import { BadRequestError } from "../utils/errors.ts";

/** 图形验证码有效期 */
const CAPTCHA_TTL_MS = 5 * 60 * 1000;
/** 验证码字符数 */
const CAPTCHA_LENGTH = 4;
/** 去掉了 0/O/1/I 等易混字符 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

interface CaptchaEntry {
  code: string;
  expiresAt: number;
}

/**
 * 图形验证码存储
 *
 * ⚠️ 进程内内存：多实例部署时，签发与校验必须落在同一个实例上。
 * 需要横向扩展时应换成 Redis 一类的共享存储。
 */
const store = new Map<string, CaptchaEntry>();

/** 清掉过期项，避免 Map 无限增长 */
const sweepExpired = (): void => {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(id);
    }
  }
};

/** 生成随机验证码文本 */
const createCode = (): string =>
  Array.from({ length: CAPTCHA_LENGTH }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join("");

/** SVG 里只出现字母数字，仍统一转义，避免以后改字符集时引入注入 */
const escapeXml = (text: string): string =>
  text.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });

/** 画一张带干扰线与噪点的验证码 SVG */
const renderSvg = (code: string): string => {
  const chars = [...code]
    .map((char, index) => {
      const x = 14 + index * 26 + randomInt(-2, 3);
      const y = 28 + randomInt(-4, 5);
      const rotate = randomInt(-18, 19);
      const color = `hsl(${randomInt(200, 260)} 35% ${randomInt(25, 40)}%)`;
      const fontSize = randomInt(22, 27);
      return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" font-family="monospace" font-size="${fontSize}" font-weight="700" fill="${color}">${escapeXml(char)}</text>`;
    })
    .join("");

  const lines = Array.from(
    { length: 4 },
    () =>
      `<line x1="${randomInt(0, 120)}" y1="${randomInt(0, 40)}" x2="${randomInt(0, 120)}" y2="${randomInt(0, 40)}" stroke="hsl(${randomInt(190, 270)} 30% 55%)" stroke-width="1" opacity="0.5"/>`,
  ).join("");

  const dots = Array.from(
    { length: 18 },
    () =>
      `<circle cx="${randomInt(0, 120)}" cy="${randomInt(0, 40)}" r="1" fill="hsl(${randomInt(190, 270)} 30% 55%)" opacity="0.5"/>`,
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><rect width="120" height="40" fill="#f7f4ea"/>${lines}${dots}${chars}</svg>`;
};

export interface CaptchaResult {
  captchaId: string;
  /** data URI，可直接放进 <img src> */
  image: string;
  /** 有效期（秒） */
  expiresIn: number;
}

/** 签发一张新的图形验证码 */
export const createCaptcha = (): CaptchaResult => {
  sweepExpired();

  const code = createCode();
  const captchaId = randomUUID();
  store.set(captchaId, { code, expiresAt: Date.now() + CAPTCHA_TTL_MS });

  const svg = renderSvg(code);
  return {
    captchaId,
    image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    expiresIn: CAPTCHA_TTL_MS / 1000,
  };
};

/**
 * 校验图形验证码
 *
 * ⚠️ 一次性：无论成功还是失败都会从存储里移除，
 * 避免拿着同一个 captchaId 反复暴力尝试。
 * @throws {BadRequestError} 参数缺失 / 已过期 / 不匹配
 */
export const assertCaptcha = (captchaId: unknown, captchaCode: unknown): void => {
  if (typeof captchaId !== "string" || !captchaId || typeof captchaCode !== "string" || !captchaCode.trim()) {
    throw new BadRequestError("请填写图形验证码");
  }

  const entry = store.get(captchaId);
  if (entry) {
    store.delete(captchaId);
  }

  if (!entry || entry.expiresAt <= Date.now()) {
    throw new BadRequestError("图形验证码已过期，请刷新后重试");
  }

  if (entry.code !== captchaCode.trim().toUpperCase()) {
    throw new BadRequestError("图形验证码错误");
  }
};
