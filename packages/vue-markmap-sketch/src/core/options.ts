import type {
  LinkIcons,
  MarkmapOptions,
  ResolvedMarkmapOptions,
  TreeNode,
} from "../types";
import { DEFAULT_LINK_ICONS } from "./markdown";

/**
 * 默认层级调色板。
 * 选用饱和度偏低、明度接近的一组颜色，配合手绘线条更耐看。
 */
export const DEFAULT_COLORS = [
  "#4C72B0",
  "#DD8452",
  "#55A868",
  "#C44E52",
  "#8172B3",
  "#937860",
  "#DA8BC3",
  "#8C8C8C",
  "#CCB974",
  "#64B5CD",
];

/** 根节点（depth 0）使用的颜色 */
export const ROOT_COLOR = "#2F3542";

export const DEFAULT_OPTIONS: ResolvedMarkmapOptions = {
  // rough.js
  roughness: 1.6,
  bowing: 1.4,
  seed: 42,
  fillStyle: "hachure",
  fillWeight: 1,
  hachureAngle: -41,
  hachureGap: 8,
  strokeWidth: 1.5,
  lineRoughness: 1.28,
  lineBowing: 1.4,

  // 颜色
  color: DEFAULT_COLORS,
  colorFreezeLevel: 0,
  nodeFill: "auto",
  nodeFillOpacity: 0.12,
  lineColor: "auto",
  backgroundColor: "transparent",

  // 文本
  fontFamily:
    '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, -apple-system, sans-serif',
  fontSize: 14,
  lineHeight: 1.4,
  maxWidth: 300,
  nodePadding: 8,

  // 布局
  spacingVertical: 12,
  spacingHorizontal: 80,
  // 默认只展开 3 层，更深的先收起来，免得大文档一上来就糊成一片
  initialExpandLevel: 3,

  // 交互
  duration: 500,
  zoom: true,
  pan: true,
  scaleExtent: [0.1, 8],
  toggleRadius: 5,
  showCollapsedCount: true,
  linkIcons: DEFAULT_LINK_ICONS,
  imageViewer: true,
  imageViewerDownload: true,
  imageViewerScaleExtent: [0.25, 8],
};

/** 只保留显式传入（非 undefined）的字段，避免把默认值覆盖成 undefined */
function definedOnly(source: MarkmapOptions): MarkmapOptions {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) result[key] = value;
  }
  return result as MarkmapOptions;
}

/**
 * 合并配置。
 * `lineRoughness` / `lineBowing` 未显式指定时由 `roughness` / `bowing` 派生，
 * 因此不能简单地用对象展开填充默认值。
 */
export function resolveOptions(
  partial: MarkmapOptions = {},
  base: ResolvedMarkmapOptions = DEFAULT_OPTIONS,
): ResolvedMarkmapOptions {
  const given = definedOnly(partial);
  // front-matter 里可能写成 `color: "#f00"`，统一成数组再参与颜色计算
  if (typeof given.color === "string") {
    given.color = [given.color as unknown as string];
  }
  const merged: ResolvedMarkmapOptions = {
    ...base,
    ...given,
    color: Array.isArray(given.color)
      ? [...given.color]
      : (given.color ?? base.color),
    // 嵌套对象要浅合并，直接展开会把默认图标整个盖掉
    linkIcons: {
      ...base.linkIcons,
      ...(given.linkIcons ?? {}),
    } as LinkIcons,
    // 区间类配置要复制一份：直接引用外部数组的话，
    // 调用方之后 push 一个值就会把已经解析好的配置改掉
    scaleExtent: [
      ...(given.scaleExtent ?? base.scaleExtent),
    ] as [number, number],
    imageViewerScaleExtent: [
      ...(given.imageViewerScaleExtent ?? base.imageViewerScaleExtent),
    ] as [number, number],
  } as ResolvedMarkmapOptions;

  if (given.lineRoughness === undefined) {
    merged.lineRoughness = merged.roughness * 0.8;
  }
  if (given.lineBowing === undefined) {
    merged.lineBowing = merged.bowing;
  }
  return merged;
}

/**
 * 取节点颜色。
 * `colorFreezeLevel` 表示从第几层开始颜色冻结：该层及其后代共用同一颜色。
 */
export function getNodeColor(
  node: Pick<TreeNode, "depth">,
  options: ResolvedMarkmapOptions,
): string {
  const { color, colorFreezeLevel } = options;
  if (typeof color === "function") {
    return color(node as TreeNode) || ROOT_COLOR;
  }
  const palette = color.length ? color : DEFAULT_COLORS;
  const level =
    colorFreezeLevel > 0 ? Math.min(node.depth, colorFreezeLevel) : node.depth;
  if (level <= 0) return ROOT_COLOR;
  return palette[(level - 1) % palette.length];
}

/** 取节点填充色 */
export function getNodeFill(
  node: Pick<TreeNode, "depth">,
  options: ResolvedMarkmapOptions,
): string | undefined {
  const { nodeFill } = options;
  if (nodeFill === "none" || !nodeFill) return undefined;
  if (nodeFill === "auto") {
    return withAlpha(getNodeColor(node, options), options.nodeFillOpacity);
  }
  return nodeFill;
}

/** 取连线颜色 */
export function getLineColor(
  child: Pick<TreeNode, "depth">,
  options: ResolvedMarkmapOptions,
): string {
  if (options.lineColor !== "auto") return options.lineColor;
  return getNodeColor(child, options);
}

/**
 * 给颜色附加透明度。
 * 支持 #rgb / #rrggbb / #rrggbbaa / rgb() / rgba()；
 * hsl()、CSS 变量等无法安全解析的形式原样返回。
 */
export function withAlpha(color: string, alpha: number): string {
  const value = color.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(value);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (rgb) {
    const parts = rgb[1].split(/[,/]/).map((s) => s.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  return color;
}

/** 允许写在 front-matter 里的配置项 */
const FRONTMATTER_OPTION_KEYS = new Set<keyof MarkmapOptions>([
  "roughness",
  "bowing",
  "seed",
  "fillStyle",
  "fillWeight",
  "hachureAngle",
  "hachureGap",
  "strokeWidth",
  "lineRoughness",
  "lineBowing",
  "color",
  "colorFreezeLevel",
  "nodeFill",
  "nodeFillOpacity",
  "lineColor",
  "backgroundColor",
  "fontFamily",
  "fontSize",
  "lineHeight",
  "maxWidth",
  "nodePadding",
  "spacingVertical",
  "spacingHorizontal",
  "initialExpandLevel",
  "duration",
  "zoom",
  "pan",
  "scaleExtent",
  "toggleRadius",
  "showCollapsedCount",
  "linkIcons",
  "imageViewer",
  "imageViewerDownload",
  "imageViewerScaleExtent",
]);

/**
 * 从 front-matter 中挑出可识别的配置项。
 * 同时支持顶层写法与 markmap 习惯的 `markmap:` 嵌套写法。
 */
export function pickOptionsFromFrontmatter(
  data: Record<string, unknown>,
): MarkmapOptions {
  const sources: Record<string, unknown>[] = [];
  if (data.markmap && typeof data.markmap === "object") {
    sources.push(data.markmap as Record<string, unknown>);
  }
  sources.push(data);

  const options: Record<string, unknown> = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (!FRONTMATTER_OPTION_KEYS.has(key as keyof MarkmapOptions)) continue;
      if (value === null || value === undefined) continue;
      options[key] = value;
    }
  }
  if (Array.isArray(options.color)) {
    options.color = (options.color as unknown[]).map(String);
  }
  return options as MarkmapOptions;
}
