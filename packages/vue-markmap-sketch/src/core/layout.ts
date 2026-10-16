import { flextree } from "d3-flextree";
import type { FlextreeNode } from "d3-flextree";
import type {
  LayoutLink,
  LayoutNode,
  LayoutResult,
  NodeMeasurer,
  NodeMetrics,
  ResolvedMarkmapOptions,
  TreeNode,
} from "../types";
import { round2 } from "./utils";

/**
 * 折叠标识在节点右边缘外露出的距离，供包围盒与连线锚点使用。
 */
const TOGGLE_OVERHANG = 4;

/** 折叠标识里文字相对正文字号的缩放比例 */
export const TOGGLE_FONT_RATIO = 0.72;
/** 胶囊内文字两侧的额外留白 */
const TOGGLE_PADDING_X = 6;
/** 数量上限，超过则显示 `99+` */
const TOGGLE_COUNT_MAX = 99;

/** 折叠标识的几何与文案 */
export interface ToggleBadge {
  /** 标识上的文字：展开为 `−`，折叠为 `+N` */
  label: string;
  /** 标识整体宽度 */
  width: number;
  /** 标识整体高度 */
  height: number;
  /** 标识内文字的字号 */
  fontSize: number;
  /** 展开态画圆、折叠态画胶囊 */
  folded: boolean;
  /**
   * 左边缘相对节点右边缘的偏移（负值表示向左压住边框）。
   *
   * 标识**按左边缘对齐**而不是居中：居中时宽度增长会往左吃掉节点文本，
   * `+12` 这种两位数会盖住最后一个字。
   */
  offsetX: number;
}

/**
 * 计算折叠标识的尺寸与文案。
 *
 * 布局（包围盒）和渲染（画图形）都走这一个函数，避免两边各算一套对不上。
 * 折叠态用胶囊而不是圆：默认 `toggleRadius` 只有 5，直径 10px 的圆塞不下 `+12`，
 * 硬把圆撑到能放下三位数会很难看。
 *
 * ⚠️ 文字宽度是估算的（`0.62em / 字`），没有走 canvas 测量：
 * 标识最多三四个字符，几像素误差对视觉和包围盒都没有影响，
 * 换来的是布局层不必依赖文本量器。
 */
export function getToggleBadge(
  options: Pick<
    ResolvedMarkmapOptions,
    "toggleRadius" | "fontSize" | "showCollapsedCount"
  >,
  folded: boolean,
  childCount: number,
): ToggleBadge {
  const diameter = options.toggleRadius * 2;
  const fontSize = options.fontSize * TOGGLE_FONT_RATIO;
  // 左边缘比节点右边缘往左压一个半径，保留「骑在边框上」的手感
  const offsetX = -options.toggleRadius;

  if (!folded) {
    return {
      label: "−",
      width: diameter,
      height: diameter,
      fontSize,
      folded,
      offsetX,
    };
  }

  const label = options.showCollapsedCount
    ? `+${childCount > TOGGLE_COUNT_MAX ? `${TOGGLE_COUNT_MAX}+` : childCount}`
    : "+";

  return {
    label,
    width: label.length * fontSize * 0.62 + TOGGLE_PADDING_X * 2,
    height: Math.max(diameter, Math.round(options.fontSize * 1.15)),
    fontSize,
    folded,
    offsetX,
  };
}

export interface LayoutContext {
  options: ResolvedMarkmapOptions;
  measure: NodeMeasurer;
  /** 返回 true 表示该节点已折叠，其子树不参与布局 */
  isFolded?: (node: TreeNode) => boolean;
}

/** 节点右边缘到折叠标识外侧的距离，供包围盒使用 */
function toggleOverhang(node: LayoutNode, options: ResolvedMarkmapOptions): number {
  if (!node.hasChildren) return 0;
  const badge = getToggleBadge(
    options,
    node.hasHiddenChildren,
    node.data.children.length,
  );
  return badge.offsetX + badge.width + TOGGLE_OVERHANG;
}

/**
 * 用 d3-flextree 计算布局。
 *
 * 为什么是 flextree 而不是 d3.tree()：节点高度取决于文本行数，属于「变尺寸节点」
 * 布局；d3.tree() 只支持等尺寸节点，flextree 是 d3-hierarchy 生态里
 * 专为此设计的布局（markmap-view 同样使用它），无需自己手写布局算法。
 *
 * 坐标系沿用 d3 约定：`x` 为广度轴（此处的垂直方向，节点中心），
 * `y` 为深度轴（此处的水平方向，节点左边缘）。
 */
export function computeLayout(
  root: TreeNode,
  context: LayoutContext,
): LayoutResult {
  const { options, measure, isFolded } = context;

  // 根节点也允许折叠（等价于「全部收起」），此时画面上只剩中心节点
  const childrenOf = (node: TreeNode): TreeNode[] | undefined =>
    isFolded?.(node) ? undefined : node.children;

  // 先统一测量，避免在布局访问器里产生副作用
  const metricsById = new Map<string, NodeMetrics>();
  const collectMetrics = (node: TreeNode) => {
    metricsById.set(node.id, measure(node));
    for (const child of childrenOf(node) ?? []) collectMetrics(child);
  };
  collectMetrics(root);

  const layout = flextree<TreeNode>({
    children: childrenOf,
    // nodeSize = [广度尺寸, 深度尺寸]；把间距直接算进尺寸里，
    // 相当于给每个节点套一个「节点 + 间距」的占位带，等价于统一间距。
    nodeSize: (node) => {
      const metrics = metricsById.get(node.data.id);
      const width = metrics?.width ?? 0;
      const height = metrics?.height ?? 0;
      return [height + options.spacingVertical, width + options.spacingHorizontal];
    },
    spacing: 0,
  });

  const hierarchy = layout.hierarchy(root);
  layout(hierarchy);

  const nodes: LayoutNode[] = [];
  const build = (
    source: FlextreeNode<TreeNode>,
    parent: LayoutNode | null,
  ): LayoutNode => {
    const metrics = metricsById.get(source.data.id);
    const width = metrics?.width ?? 0;
    const height = metrics?.height ?? 0;
    const folded =
      // 根节点同样可折叠（等价于「全部收起」），这里不能再排除它
      !!isFolded?.(source.data);

    const node: LayoutNode = {
      id: source.data.id,
      data: source.data,
      depth: source.depth,
      x: source.x,
      y: source.y,
      width,
      height,
      hasChildren: source.data.children.length > 0,
      hasHiddenChildren: folded && source.data.children.length > 0,
      parent,
      children: [],
    };

    // 布局坐标回写到 TreeNode，符合对外接口约定
    source.data.x = source.x;
    source.data.y = source.y;
    source.data.width = width;
    source.data.height = height;

    nodes.push(node);
    for (const child of source.children ?? []) {
      node.children.push(build(child, node));
    }
    return node;
  };

  const rootNode = build(hierarchy, null);

  const links: LayoutLink[] = [];
  for (const node of nodes) {
    if (node.parent) links.push({ source: node.parent, target: node });
  }

  // 包围盒：x 为垂直方向、y 为水平方向
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const node of nodes) {
    x0 = Math.min(x0, node.x - node.height / 2);
    x1 = Math.max(x1, node.x + node.height / 2);
    y0 = Math.min(y0, node.y);
    // 折叠标识以节点右边缘为中心，按它的半宽外扩，否则折叠后的数量胶囊会被 fit() 裁掉
    y1 = Math.max(y1, node.y + node.width + toggleOverhang(node, options));
  }

  if (!nodes.length) {
    x0 = x1 = y0 = y1 = 0;
  }

  return {
    root: rootNode,
    nodes,
    links,
    bbox: { x0, y0, x1, y1 },
  };
}

/** 节点的左侧锚点（屏幕坐标） */
export function leftAnchor(node: LayoutNode): [number, number] {
  return [node.y, node.x];
}

/** 节点的右侧锚点（屏幕坐标，折叠标识所在处） */
export function rightAnchor(node: LayoutNode): [number, number] {
  return [node.y + node.width, node.x];
}

/**
 * 父子连线的三次贝塞尔路径。
 * 控制点在水平方向按 45% / 55% 分配，形成 markmap 标志性的「斜向曲线」，
 * 而不是生硬的折线或直线。
 */
export function createLinkD(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const dx = x2 - x1;
  const c1 = x1 + dx * 0.45;
  const c2 = x1 + dx * 0.55;
  return `M${round2(x1)},${round2(y1)}C${round2(c1)},${round2(y1)} ${round2(c2)},${round2(y2)} ${round2(x2)},${round2(y2)}`;
}

export { TOGGLE_OVERHANG };
