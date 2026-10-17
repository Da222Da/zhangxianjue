/**
 * 极简 YAML front-matter 解析。
 *
 * 只实现思维导图配置真正会用到的子集：
 * - `key: value` 标量（字符串 / 数字 / 布尔 / null）
 * - `key: [a, b]` 行内数组
 * - 一层嵌套 map（markmap 习惯的 `markmap:` 写法）
 * - `#` 行内注释
 *
 * 不做锚点、多行字符串、复杂嵌套等完整 YAML 能力。
 */

const FRONTMATTER_RE = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** 拆出 front-matter 与正文 */
export function splitFrontmatter(source: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const match = FRONTMATTER_RE.exec(source ?? "");
  if (!match) return { data: {}, body: source ?? "" };
  return {
    data: parseYamlMap(match[1]),
    body: source.slice(match[0].length),
  };
}

function parseScalar(raw: string): unknown {
  let value = raw.trim();
  // 行内注释：要求 `#` 前有空白，避免误伤 `#ff0000` 这类色值
  const hashIndex = value.search(/\s#/);
  if (hashIndex > 0) value = value.slice(0, hashIndex).trim();
  if (!value) return "";

  const doubleQuoted = /^"(.*)"$/.exec(value);
  if (doubleQuoted) return doubleQuoted[1].replace(/\\"/g, '"');
  const singleQuoted = /^'(.*)'$/.exec(value);
  if (singleQuoted) return singleQuoted[1];

  if (/^(true|yes|on)$/i.test(value)) return true;
  if (/^(false|no|off)$/i.test(value)) return false;
  if (/^(null|~)$/i.test(value)) return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d*\.\d+$/.test(value)) return Number(value);

  const inlineArray = /^\[(.*)\]$/.exec(value);
  if (inlineArray) {
    const items = inlineArray[1]
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "");
    return items.map((item) => parseScalar(item));
  }
  return value;
}

function parseYamlMap(source: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentNested: Record<string, unknown> | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const indent = /^[ \t]*/.exec(rawLine)![0].length;
    const separator = line.indexOf(":");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();

    if (!rawValue) {
      // `key:` 后无值：一级缩进时视为嵌套 map 的开头
      if (indent === 0 && !/^\[/.test(key)) {
        const nested: Record<string, unknown> = {};
        result[key] = nested;
        currentNested = nested;
      }
      continue;
    }

    const value = parseScalar(rawValue);
    if (indent > 0 && currentNested) {
      currentNested[key] = value;
    } else {
      result[key] = value;
      currentNested = null;
    }
  }
  return result;
}

export { parseScalar as parseYamlScalar };
