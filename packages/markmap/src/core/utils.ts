/**
 * 无依赖的小工具函数。
 */

/**
 * FNV-1a 32 位哈希，返回 base36 字符串。
 * 用途：把「节点路径」映射成稳定的数字种子 / id。
 */
export function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619，用移位避免超出 32 位精度
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** 把字符串散列成一个 32 位正整数，供 rough.js 的 seed 使用 */
export function hashToSeed(input: string): number {
  return parseInt(hashString(input), 36) || 1;
}

/** 数值夹取 */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** 三次缓入缓出，用于折叠展开与视图动画 */
export function easeCubicInOut(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 线性插值 */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** 下一帧；非浏览器环境退化为定时器 */
export function raf(callback: (time: number) => void): number {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(Date.now()), 16) as unknown as number;
}

/** 取消上一帧的调度 */
export function caf(handle: number): void {
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(handle);
  } else {
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  }
}

/** 把数值收敛到 2 位小数，减少 DOM 属性字符串的抖动 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 是否为全角 / 宽字符（中日韩、全角标点、假名等）。
 * 这类字符可以逐字断行，拉丁单词不行。
 */
export function isWideChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    (code >= 0x1100 && code <= 0x115f) || // 谚文字母
    (code >= 0x2e80 && code <= 0x303e) || // 部首扩展 / 康熙部首 / 中日韩符号
    (code >= 0x3041 && code <= 0x33ff) || // 假名 / 注音 / 兼容字符
    (code >= 0x3400 && code <= 0x4dbf) || // 扩展 A
    (code >= 0x4e00 && code <= 0x9fff) || // 基本汉字
    (code >= 0xa000 && code <= 0xa4cf) || // 彝文
    (code >= 0xac00 && code <= 0xd7a3) || // 谚文音节
    (code >= 0xf900 && code <= 0xfaff) || // 兼容汉字
    (code >= 0xfe30 && code <= 0xfe6f) || // 兼容标点
    (code >= 0xff00 && code <= 0xff60) || // 全角字符
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1faff) // emoji
  );
}

/** 转义 HTML 特殊字符 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
