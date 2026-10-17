import type { NodeImage, NodeImageLayout } from "../types";

/** MIME → 文件扩展名。下载时的扩展名优先看真实类型，而不是 URL 里的后缀 */
const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
  "image/tiff": "tiff",
};

/** 文件名里不能出现的字符，替换成下划线 */
const ILLEGAL_FILENAME = /[\\/:*?"<>|\u0000-\u001f]/g;

/**
 * 图片自然尺寸缓存。
 * 值是 `null` 表示加载失败 —— 不要反复重试，否则每帧都会发一次请求。
 */
const naturalSizes = new Map<string, { width: number; height: number } | null>();
/** 正在加载中的 src */
const pending = new Set<string>();

/** 图片还没加载完时的占位宽度上限 */
export const IMAGE_PLACEHOLDER_WIDTH = 180;
/** 占位高度按这个宽高比估算 */
export const IMAGE_PLACEHOLDER_RATIO = 0.6;

function probe(src: string, onResolved?: () => void): void {
  if (typeof Image === "undefined") {
    naturalSizes.set(src, null);
    pending.delete(src);
    return;
  }

  const image = new Image();
  // 刻意不设 crossOrigin：那会让服务端没开 CORS 的图片连显示都失败。
  // 跨域只在导出抓取时才是问题，放到 export.ts 里单独处理。
  image.onload = () => {
    pending.delete(src);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    naturalSizes.set(src, width > 0 && height > 0 ? { width, height } : null);
    onResolved?.();
  };
  image.onerror = () => {
    pending.delete(src);
    naturalSizes.set(src, null);
    onResolved?.();
  };
  image.src = src;
}

/** 取已探测到的自然尺寸，未加载返回 undefined，加载失败返回 null */
export function getNaturalSize(
  src: string,
): { width: number; height: number } | null | undefined {
  return naturalSizes.get(src);
}

/** 预置尺寸（测试或已知尺寸时用） */
export function setNaturalSize(
  src: string,
  size: { width: number; height: number } | null,
): void {
  naturalSizes.set(src, size);
  pending.delete(src);
}

/**
 * 算出图片在节点里的展示尺寸：等比缩放到 `maxWidth` 以内。
 *
 * 尺寸要等图片加载完才知道，而测量是同步的，所以先用占位尺寸排一次版，
 * 加载完成后通过 `onResolved` 通知调用方重新布局。
 */
export function resolveImageLayout(
  image: NodeImage,
  maxWidth: number,
  onResolved?: () => void,
): NodeImageLayout {
  const size = naturalSizes.get(image.src);

  if (size === undefined && !pending.has(image.src)) {
    pending.add(image.src);
    probe(image.src, onResolved);
  }

  if (!size) {
    const width = Math.min(maxWidth, IMAGE_PLACEHOLDER_WIDTH);
    return {
      ...image,
      width,
      height: Math.round(width * IMAGE_PLACEHOLDER_RATIO),
      ready: false,
    };
  }

  const scale = Math.min(1, maxWidth / size.width);
  return {
    ...image,
    width: Math.round(size.width * scale),
    height: Math.round(size.height * scale),
    ready: true,
  };
}

/** 从 URL 里取文件名；data URL 没有有意义的文件名，返回空串 */
function baseName(src: string): string {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return "";
  let path = src.split(/[?#]/)[0];
  try {
    path = new URL(src, "http://localhost").pathname;
  } catch {
    // 不是合法 URL，就用劈掉查询串的原串
  }
  const segment = path.slice(path.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * 猜一个下载用的文件名。
 *
 * 扩展名以 `mimeType`（抓取到的 blob 类型）为准：URL 里写 `.php` 或者干脆没有后缀、
 * 内容却是 PNG 的情况很常见，扩展名不对用户双击就打不开。
 * data URL 和 blob URL 拿不到名字，退回 `image.<ext>`。
 */
export function guessImageFilename(src: string, mimeType = ""): string {
  const mime = mimeType.split(";")[0].trim().toLowerCase();
  const extFromMime = MIME_EXTENSIONS[mime];
  const name = baseName(src);

  if (!name) return `image.${extFromMime ?? "png"}`;

  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extFromName = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const ext = extFromMime ?? extFromName ?? "png";
  const safe = stem.replace(ILLEGAL_FILENAME, "_").trim();
  return `${safe || "image"}.${ext || "png"}`;
}
