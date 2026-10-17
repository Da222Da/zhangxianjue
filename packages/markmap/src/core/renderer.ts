import rough from "roughjs";
import type { Drawable, Options as RoughOptions, PathInfo } from "roughjs/bin/core";
import type { RoughGenerator } from "roughjs/bin/generator";

import type {
  LayoutLink,
  LayoutNode,
  LayoutResult,
  MarkmapOptions,
  NodeImage,
  NodeMeasurer,
  NodeMetrics,
  NodeTextLayout,
  ResolvedMarkmapOptions,
  TreeNode,
} from "../types";
import { Animator } from "./animate";
import { computeLayout, createLinkD, getToggleBadge } from "./layout";
import { createNodeMeasurer } from "./measure";
import {
  getLineColor,
  getNodeColor,
  getNodeFill,
  resolveOptions,
} from "./options";
import { hashToSeed, lerp, raf, round2 } from "./utils";
import { ZoomController, type ContentBox } from "./zoom";
import type { ZoomTransform } from "d3-zoom";

const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

/** 标识文字的基线偏移系数，与导出侧保持同一套算法 */
const TOGGLE_BASELINE_RATIO = 0.35;
/** 命中区域在视觉尺寸外再放的余量，方便点中 */
const TOGGLE_HIT_PADDING = 4;

/**
 * 圆角矩形路径（胶囊）。
 *
 * rough 没有圆角矩形原语，`generator.rectangle()` 只能画直角，
 * 所以自己拼一条路径交给 `generator.path()` 描边成手绘线条。
 * 只用 L / C 命令，不依赖 rough 对 A（圆弧）的支持。
 */
function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const r = Math.min(width, height) / 2;
  const k = r * 0.5523; // 三次贝塞尔逼近四分之一圆弧
  const right = x + width;
  const bottom = y + height;
  const n = (value: number) => round2(value);
  // 圆角半径取短边的一半，长边方向才留有直边；短边方向的直边长度为 0，
  // 必须跳过 —— rough 会把零长度线段画成一个小墨点，胶囊上会多出一块凸起
  const horizontal = width > height;
  const vertical = height > width;

  const parts = [`M${n(x + r)},${n(y)}`];
  if (horizontal) parts.push(`L${n(right - r)},${n(y)}`);
  parts.push(
    `C${n(right - r + k)},${n(y)} ${n(right)},${n(y + r - k)} ${n(right)},${n(y + r)}`,
  );
  if (vertical) parts.push(`L${n(right)},${n(bottom - r)}`);
  parts.push(
    `C${n(right)},${n(bottom - r + k)} ${n(right - r + k)},${n(bottom)} ${n(right - r)},${n(bottom)}`,
  );
  if (horizontal) parts.push(`L${n(x + r)},${n(bottom)}`);
  parts.push(
    `C${n(x + r - k)},${n(bottom)} ${n(x)},${n(bottom - r + k)} ${n(x)},${n(bottom - r)}`,
  );
  if (vertical) parts.push(`L${n(x)},${n(y + r)}`);
  parts.push(
    `C${n(x)},${n(y + r - k)} ${n(x + r - k)},${n(y)} ${n(x + r)},${n(y)}`,
  );

  return parts.join(" ");
}

export interface SketchRendererEvents {
  onNodeClick?: (node: TreeNode, event: MouseEvent) => void;
  onToggle?: (node: TreeNode, folded: boolean) => void;
  onZoom?: (transform: ZoomTransform) => void;
  /**
   * 点了节点内的链接。
   * 监听方调用 `event.preventDefault()` 即可阻止默认跳转。
   */
  onLinkClick?: (node: TreeNode | undefined, href: string, event: MouseEvent) => void;
  /**
   * 点了节点内的图片。
   * 监听方调用 `event.preventDefault()` 即可阻止默认行为（打开内置查看器）。
   */
  onImageClick?: (
    node: TreeNode | undefined,
    image: NodeImage,
    event: MouseEvent,
  ) => void;
}

/**
 * 判定「拖拽」而非「点击」的位移阈值（px）。
 *
 * 链接一旦接收指针事件，用户在链接上按住拖动画布时，浏览器在抬起后仍会补一个
 * click，不拦就会变成「拖了一下画布结果页面跳走了」。
 */
const CLICK_DRAG_THRESHOLD = 4;

interface NodeState {
  x: number;
  y: number;
  opacity: number;
}

interface NodeView {
  id: string;
  data: TreeNode;
  /** 外层容器，负责 translate 动画 */
  g: SVGGElement;
  /** 手绘方框与命中区域 */
  shape: SVGGElement;
  hit: SVGRectElement;
  fo: SVGForeignObjectElement;
  body: HTMLElement;
  toggle: SVGGElement;
  toggleHit: SVGRectElement;
  /** 折叠时显示 `+N` 的文字元素 */
  toggleLabel: SVGTextElement;

  from: NodeState;
  to: NodeState;
  current: NodeState;

  width: number;
  height: number;

  shapeKey: string;
  shapePaths: SVGPathElement[];
  toggleKey: string;
  togglePaths: SVGPathElement[];

  html: string;
  hasChildren: boolean;
  dying: boolean;
}

interface LineView {
  /** 以子节点 id 为键，一条连线唯一对应一个非根节点 */
  key: string;
  parentId: string;
  color: string;
  g: SVGGElement;
  paths: SVGPathElement[];
  cacheKey: string;
  dying: boolean;
}

/**
 * 手绘风格渲染器。
 *
 * 分工：d3-flextree 负责算坐标（layout.ts），rough.js 只根据坐标生成
 * 「怎么画」的路径数据，渲染器负责把路径写进 DOM 并做补间动画。
 *
 * 性能上的关键选择：
 * - 缩放/平移只改外层 `<g>` 的 transform，不重绘任何图形
 * - 节点方框按 `尺寸 + 颜色` 缓存，尺寸不变就不重新生成
 * - 连线路径按端点坐标（0.1px 量化）缓存，端点没动就跳过
 */
export class SketchRenderer {
  private readonly generator: RoughGenerator;
  private readonly animator = new Animator();
  private readonly zoomLayer: SVGGElement;
  private readonly linesLayer: SVGGElement;
  private readonly nodesLayer: SVGGElement;
  readonly zoom: ZoomController;

  private options: ResolvedMarkmapOptions;
  private measure: NodeMeasurer;
  private shapeToken = "";

  private tree: TreeNode | null = null;
  private layoutResult: LayoutResult | null = null;
  private readonly layoutNodes = new Map<string, LayoutNode>();
  private readonly nodeViews = new Map<string, NodeView>();
  private readonly lineViews = new Map<string, LineView>();

  private folded = new Set<string>();
  private knownIds = new Set<string>();
  private highlighted: string | null = null;
  private readonlyMode = false;
  /** 最近一次 pointerdown 的位置 */
  private pointerDownAt: { x: number; y: number } | null = null;
  /** 图片加载完成后的重排是否已排队 */
  private imageRelayoutQueued = false;

  private readonly handleClick: (event: MouseEvent) => void;
  private readonly handleOver: (event: MouseEvent) => void;
  private readonly handleOut: (event: MouseEvent) => void;

  constructor(
    private readonly svg: SVGSVGElement,
    options: MarkmapOptions = {},
    private readonly events: SketchRendererEvents = {},
  ) {
    this.options = resolveOptions(options);
    this.measure = createNodeMeasurer(this.options);
    this.generator = rough.generator();
    this.refreshShapeToken();

    this.zoomLayer = this.createElement("g", "mvs-zoom");
    this.linesLayer = this.createElement("g", "mvs-lines");
    this.nodesLayer = this.createElement("g", "mvs-nodes");
    this.zoomLayer.append(this.linesLayer, this.nodesLayer);
    this.svg.appendChild(this.zoomLayer);

    this.zoom = new ZoomController(svg, this.zoomLayer, {
      scaleExtent: this.options.scaleExtent,
      enableZoom: this.options.zoom,
      enablePan: this.options.pan,
      duration: this.options.duration,
      onZoom: (transform) => this.events.onZoom?.(transform),
    });

    this.handleClick = (event) => this.onClick(event);
    this.handleOver = (event) => this.onPointerOver(event);
    this.handleOut = (event) => this.onPointerOut(event);
    this.nodesLayer.addEventListener("click", this.handleClick);
    this.nodesLayer.addEventListener("mouseover", this.handleOver);
    this.nodesLayer.addEventListener("mouseout", this.handleOut);
    // 记在 svg 上而不是节点上：拖拽平移时指针可能移出节点
    svg.addEventListener("pointerdown", this.handlePointerDown);
  }

  // ------------------------------------------------------------------
  // 对外 API
  // ------------------------------------------------------------------

  /** 重新设置 Markdown 解析结果 */
  setData(root: TreeNode, options: { animate?: boolean } = {}): void {
    const animate = options.animate ?? true;
    const nextIds = new Set<string>();
    const collect = (node: TreeNode) => {
      nextIds.add(node.id);
      for (const child of node.children) collect(child);
    };
    collect(root);

    // 保留仍然存在的节点的折叠状态
    for (const id of [...this.folded]) {
      if (!nextIds.has(id)) this.folded.delete(id);
    }
    // 新出现的节点按 initialExpandLevel / fold 注释初始化。
    // 只有「有子节点」的节点才值得折叠，叶子的折叠是空操作 ——
    // 判定必须和 applyExpandLevel() 完全一致，否则两条路径算出的折叠集合不同
    const level = this.options.initialExpandLevel;
    const applyFold = (node: TreeNode) => {
      const isNew = !this.knownIds.has(node.id);
      if (isNew && node !== root) {
        const foldByLevel =
          level >= 0 && node.depth >= level && node.children.length > 0;
        if (node.fold || foldByLevel) {
          this.folded.add(node.id);
        } else {
          this.folded.delete(node.id);
        }
      }
      for (const child of node.children) applyFold(child);
    };
    applyFold(root);

    this.knownIds = nextIds;
    this.tree = root;
    this.relayout(animate);
  }

  /** 更新配置并重新渲染 */
  setOptions(options: MarkmapOptions, animate = true): void {
    this.applyOptions(options);
    this.relayout(animate);
  }

  /** 同时更新配置与数据，只做一次布局 */
  update(root: TreeNode, options: MarkmapOptions, animate = true): void {
    this.applyOptions(options);
    this.setData(root, { animate });
  }

  /** 只读模式：禁用折叠标识与交互光标（缩放平移仍可用） */
  setReadonly(value: boolean): void {
    this.readonlyMode = value;
    this.svg.classList.toggle("mvs-readonly", value);
  }

  getOptions(): ResolvedMarkmapOptions {
    return this.options;
  }

  /**
   * 图片加载完会让节点尺寸变化，需要重新布局。
   * 一屏可能同时有多张图加载完，合并到下一帧统一处理。
   */
  private scheduleImageRelayout(): void {
    if (this.imageRelayoutQueued) return;
    this.imageRelayoutQueued = true;
    raf(() => {
      this.imageRelayoutQueued = false;
      if (this.tree) this.relayout(true);
    });
  }

  private applyOptions(options: MarkmapOptions): void {
    const previousLevel = this.options.initialExpandLevel;
    this.options = resolveOptions(options);
    this.measure = createNodeMeasurer(this.options, () =>
      this.scheduleImageRelayout(),
    );
    this.refreshShapeToken();
    this.zoom.setOptions({
      scaleExtent: this.options.scaleExtent,
      enableZoom: this.options.zoom,
      enablePan: this.options.pan,
      duration: this.options.duration,
    });
    for (const view of this.nodeViews.values()) {
      view.shapeKey = "";
      view.toggleKey = "";
      // 字号 / 内边距会影响测量结果，必须和 CSS 保持同步
      this.applyBodyStyle(view.body);
      view.toggleLabel.setAttribute("font-family", this.options.fontFamily);
    }

    // 展开层数是个「只看前 N 层」的开关：运行时改动要立刻重新折叠，
    // 否则 setData 里只对新增节点生效，改了选项看起来毫无反应
    if (this.options.initialExpandLevel !== previousLevel) {
      this.applyExpandLevel(this.options.initialExpandLevel);
    }
  }

  /**
   * 按层级重设折叠状态，会覆盖用户手动展开/折叠的结果。
   * `level < 0` 表示全部展开。
   */
  applyExpandLevel(level: number): void {
    const tree = this.tree;
    if (!tree) return;

    const walk = (node: TreeNode) => {
      if (node !== tree) {
        const shouldFold =
          level >= 0 && node.depth >= level && node.children.length > 0;
        if (shouldFold) this.folded.add(node.id);
        else this.folded.delete(node.id);
      }
      for (const child of node.children) walk(child);
    };
    walk(tree);
  }

  /** 切换折叠状态，返回切换后的状态 */
  toggle(id: string, folded?: boolean): boolean {
    const node = this.layoutNodes.get(id);
    if (!node) return false;

    const next = folded ?? !this.folded.has(id);
    if (next) this.folded.add(id);
    else this.folded.delete(id);

    this.relayout(true);
    this.events.onToggle?.(node.data, next);
    return next;
  }

  /** 递归展开/折叠整棵子树（Alt + 点击折叠标识） */
  toggleSubtree(id: string, folded: boolean): void {
    const node = this.layoutNodes.get(id);
    if (!node) return;
    // 折叠时只收子节点，展开时把自己也展开
    if (!folded) this.folded.delete(node.id);
    const walk = (current: LayoutNode) => {
      if (current !== node) {
        if (folded) this.folded.add(current.id);
        else this.folded.delete(current.id);
      }
      for (const child of current.children) walk(child);
    };
    walk(node);
    this.relayout(true);
  }

  expandAll(): void {
    this.folded.clear();
    this.relayout(true);
  }

  /** 折叠到指定层级：depth >= level 的节点收起 */
  collapseAll(level = 1): void {
    for (const node of this.layoutNodes.values()) {
      if (node.parent && node.depth >= level) this.folded.add(node.id);
    }
    this.relayout(true);
  }

  /** 展开某节点的全部祖先，使其可见 */
  revealNode(id: string): boolean {
    let node = this.layoutNodes.get(id);
    if (!node) return false;
    let changed = false;
    let parent = node.parent;
    while (parent) {
      if (this.folded.delete(parent.id)) changed = true;
      parent = parent.parent;
    }
    if (changed) this.relayout(true);
    return changed;
  }

  fit(padding = 40, animate = true): void {
    const box = this.getSceneBox();
    if (box) this.zoom.fit(box, padding, animate);
  }

  centerNode(id: string, animate = true): void {
    this.revealNode(id);
    const node = this.layoutNodes.get(id);
    if (!node) return;
    // 屏幕语义：水平方向对应布局的 y，垂直方向对应布局的 x
    this.zoom.centerOn(
      node.y + node.width / 2,
      node.x,
      Math.max(this.zoom.getTransform().k, 1),
      animate,
    );
  }

  zoomBy(factor: number): void {
    this.zoom.zoomBy(factor);
  }

  resetZoom(animate = true): void {
    this.zoom.reset(animate);
  }

  getLayout(): LayoutResult | null {
    return this.layoutResult;
  }

  getTree(): TreeNode | null {
    return this.tree;
  }

  getNode(id: string): TreeNode | undefined {
    return this.layoutNodes.get(id)?.data;
  }

  /** 全部可见内容的包围盒，导出时使用 */
  getSceneBox(): ContentBox | null {
    return this.layoutResult?.bbox ?? null;
  }

  /**
   * 每个可见节点的文本排版信息，导出时把 foreignObject 换成原生 `<text>` 用。
   * 文本颜色取实际计算样式，这样 CSS 变量改了导出结果也跟着变。
   */
  getTextLayouts(): Map<string, NodeTextLayout> {
    const o = this.options;
    const linkIcons = o.linkIcons;
    const layouts = new Map<string, NodeTextLayout>();
    for (const view of this.nodeViews.values()) {
      const metrics = this.measure(view.data);
      layouts.set(view.id, {
        content: view.data.content,
        lines: metrics.lines,
        codeLines: metrics.codeLines,
        images: metrics.images,
        fontSize: o.fontSize,
        fontFamily: o.fontFamily,
        lineHeight: o.lineHeight,
        padding: o.nodePadding,
        color: getComputedStyle(view.body).color || "#2f3542",
        linkIcons,
      });
    }
    return layouts;
  }

  getSvgElement(): SVGSVGElement {
    return this.svg;
  }

  isFolded(id: string): boolean {
    return this.folded.has(id);
  }

  /** hover 高亮：点亮该节点到根的整条路径 */
  setHighlight(id: string | null): void {
    if (this.highlighted === id) return;
    this.highlighted = id;

    const chain = new Set<string>();
    if (id) {
      let node = this.layoutNodes.get(id) ?? null;
      while (node) {
        chain.add(node.id);
        node = node.parent;
      }
    }

    this.nodesLayer.classList.toggle("mvs-has-highlight", Boolean(id));
    for (const [nodeId, view] of this.nodeViews) {
      view.g.classList.toggle("mvs-active", chain.has(nodeId));
    }
    for (const [childId, line] of this.lineViews) {
      line.g.classList.toggle("mvs-active", childId !== id && chain.has(childId));
    }
  }

  destroy(): void {
    this.animator.cancel();
    this.zoom.destroy();
    this.nodesLayer.removeEventListener("click", this.handleClick);
    this.nodesLayer.removeEventListener("mouseover", this.handleOver);
    this.nodesLayer.removeEventListener("mouseout", this.handleOut);
    this.svg.removeEventListener("pointerdown", this.handlePointerDown);
    this.zoomLayer.remove();
    this.nodeViews.clear();
    this.lineViews.clear();
    this.layoutNodes.clear();
    this.tree = null;
    this.layoutResult = null;
  }

  // ------------------------------------------------------------------
  // 渲染流程
  // ------------------------------------------------------------------

  private relayout(animate: boolean): void {
    if (!this.tree) return;
    const result = computeLayout(this.tree, {
      options: this.options,
      measure: this.measure,
      isFolded: (node) => this.folded.has(node.id),
    });
    this.layoutResult = result;
    this.sync(animate);
  }

  private sync(animate: boolean): void {
    const result = this.layoutResult;
    if (!result) return;

    const duration = animate ? this.options.duration : 0;

    this.layoutNodes.clear();
    const aliveNodes = new Set<string>();
    for (const node of result.nodes) {
      this.layoutNodes.set(node.id, node);
      aliveNodes.add(node.id);
      this.syncNode(node);
    }

    const aliveLinks = new Set<string>();
    for (const link of result.links) {
      aliveLinks.add(link.target.id);
      this.syncLine(link);
    }

    for (const [id, view] of this.nodeViews) {
      if (aliveNodes.has(id)) continue;
      if (duration > 0) {
        view.dying = true;
        view.from = { ...view.current };
        view.to = { ...view.current, opacity: 0 };
      } else {
        this.destroyNodeView(id);
      }
    }
    for (const [id, line] of this.lineViews) {
      if (aliveLinks.has(id)) continue;
      if (duration > 0) line.dying = true;
      else this.destroyLineView(id);
    }

    const finish = () => this.cleanupDead();
    if (duration > 0) {
      this.animator.run(duration, (progress) => this.applyState(progress), finish);
    } else {
      this.animator.cancel();
      this.applyState(1);
      finish();
    }
  }

  private syncNode(node: LayoutNode): void {
    const metrics = this.measure(node.data);
    let view = this.nodeViews.get(node.id);

    if (!view) {
      view = this.createNodeView(node, metrics);
      this.nodeViews.set(node.id, view);
      // 新节点原地淡入
      view.from = { x: node.x, y: node.y, opacity: 0 };
      view.current = { ...view.from };
    } else {
      view.dying = false;
      view.from = { ...view.current };
      view.data = node.data;
    }
    view.to = { x: node.x, y: node.y, opacity: 1 };
    view.hasChildren = node.hasChildren;

    view.width = metrics.width;
    view.height = metrics.height;

    if (view.html !== metrics.html) {
      view.html = metrics.html;
      view.body.innerHTML = metrics.html;
    }

    view.fo.setAttribute("width", String(metrics.width));
    view.fo.setAttribute("height", String(metrics.height));
    view.hit.setAttribute("width", String(metrics.width));
    view.hit.setAttribute("height", String(metrics.height));

    this.drawNodeShape(view);
    this.updateToggle(view, node);
  }

  private syncLine(link: LayoutLink): void {
    const key = link.target.id;
    let view = this.lineViews.get(key);
    const color = getLineColor(link.target.data, this.options);
    if (!view) {
      const g = this.createElement("g", "mvs-link");
      g.dataset.child = key;
      this.linesLayer.appendChild(g);
      view = {
        key,
        parentId: link.source.id,
        color,
        g,
        paths: [],
        cacheKey: "",
        dying: false,
      };
      this.lineViews.set(key, view);
    }
    view.dying = false;
    view.parentId = link.source.id;
    view.color = color;
    view.g.style.opacity = "";
  }

  private applyState(progress: number): void {
    for (const view of this.nodeViews.values()) {
      const { from, to } = view;
      view.current = {
        x: lerp(from.x, to.x, progress),
        y: lerp(from.y, to.y, progress),
        opacity: lerp(from.opacity, to.opacity, progress),
      };
      const { x, y, opacity } = view.current;
      view.g.setAttribute(
        "transform",
        `translate(${round2(y)},${round2(x - view.height / 2)})`,
      );
      if (opacity < 0.999) {
        view.g.setAttribute("opacity", String(round2(opacity)));
      } else {
        view.g.removeAttribute("opacity");
      }
    }
    this.updateLines();
  }

  private updateLines(): void {
    for (const [key, line] of this.lineViews) {
      const parent = this.nodeViews.get(line.parentId);
      const child = this.nodeViews.get(key);
      if (!parent || !child) continue;

      if (line.dying) {
        line.g.setAttribute("opacity", "0");
        continue;
      }
      if (child.current.opacity < 0.999) {
        line.g.setAttribute("opacity", String(round2(child.current.opacity)));
      } else {
        line.g.removeAttribute("opacity");
      }

      const x1 = parent.current.y + parent.width;
      const y1 = parent.current.x;
      const x2 = child.current.y;
      const y2 = child.current.x;

      // 端点按 0.1px 量化，端点没动就完全跳过重算
      const cacheKey = `${x1.toFixed(1)},${y1.toFixed(1)},${x2.toFixed(1)},${y2.toFixed(1)}`;
      if (cacheKey === line.cacheKey) continue;
      line.cacheKey = cacheKey;

      const drawable = this.generator.path(
        createLinkD(x1, y1, x2, y2),
        this.roughOptions(this.seedOf(`${line.parentId}->${key}`), line.color),
      );
      line.paths = this.writePaths(
        line.g,
        line.paths,
        this.generator.toPaths(drawable),
      );
    }
  }

  private cleanupDead(): void {
    for (const [id, view] of [...this.nodeViews]) {
      if (view.dying && view.to.opacity === 0) this.destroyNodeView(id);
    }
    for (const [id, line] of [...this.lineViews]) {
      if (line.dying) this.destroyLineView(id);
    }
  }

  // ------------------------------------------------------------------
  // DOM 构建
  // ------------------------------------------------------------------

  private createElement<K extends keyof SVGElementTagNameMap>(
    tag: K,
    className: string,
  ): SVGElementTagNameMap[K] {
    const element = document.createElementNS(SVG_NS, tag);
    element.setAttribute("class", className);
    return element;
  }

  private createNodeView(node: LayoutNode, metrics: NodeMetrics): NodeView {
    const g = this.createElement("g", "mvs-node");
    g.dataset.id = node.id;

    const shape = this.createElement("g", "mvs-node-shape");
    const hit = this.createElement("rect", "mvs-node-hit");
    hit.setAttribute("fill", "transparent");
    shape.appendChild(hit);

    const fo = this.createElement("foreignObject", "mvs-node-fo");
    fo.setAttribute("width", String(metrics.width));
    fo.setAttribute("height", String(metrics.height));
    const body = document.createElementNS(XHTML_NS, "div") as HTMLElement;
    body.setAttribute("class", "mvs-node-body");
    this.applyBodyStyle(body);
    body.innerHTML = metrics.html;
    fo.appendChild(body);

    const toggle = this.createElement("g", "mvs-node-toggle");
    // 命中区域用矩形：展开态是圆、折叠态是胶囊，矩形两种都能覆盖
    const toggleHit = this.createElement("rect", "mvs-node-toggle-hit");
    toggleHit.setAttribute("fill", "transparent");
    toggle.appendChild(toggleHit);

    // 折叠时显示的数量文字。rough 不画字，只能叠 SVG <text>
    const toggleLabel = this.createElement("text", "mvs-node-toggle-label");
    toggleLabel.setAttribute("text-anchor", "middle");
    toggleLabel.setAttribute("fill", "#ffffff");
    toggleLabel.setAttribute("font-family", this.options.fontFamily);
    toggleLabel.setAttribute("pointer-events", "none");
    toggleLabel.style.display = "none";
    toggle.appendChild(toggleLabel);

    g.append(shape, fo, toggle);
    this.nodesLayer.appendChild(g);

    return {
      id: node.id,
      data: node.data,
      g,
      shape,
      hit,
      fo,
      body,
      toggle,
      toggleHit,
      toggleLabel,
      from: { x: node.x, y: node.y, opacity: 0 },
      to: { x: node.x, y: node.y, opacity: 1 },
      current: { x: node.x, y: node.y, opacity: 0 },
      width: metrics.width,
      height: metrics.height,
      shapeKey: "",
      shapePaths: [],
      toggleKey: "",
      togglePaths: [],
      html: metrics.html,
      hasChildren: node.hasChildren,
      dying: false,
    };
  }

  private destroyNodeView(id: string): void {
    const view = this.nodeViews.get(id);
    if (!view) return;
    view.g.remove();
    this.nodeViews.delete(id);
  }

  private destroyLineView(id: string): void {
    const line = this.lineViews.get(id);
    if (!line) return;
    line.g.remove();
    this.lineViews.delete(id);
  }

  /** 复用 / 增删 `<path>` 元素，避免每帧创建销毁 DOM */
  private writePaths(
    host: SVGGElement,
    cache: SVGPathElement[],
    infos: PathInfo[],
  ): SVGPathElement[] {
    while (cache.length > infos.length) {
      cache.pop()!.remove();
    }
    while (cache.length < infos.length) {
      const path = this.createElement("path", "");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-miterlimit", "2");
      host.appendChild(path);
      cache.push(path);
    }
    for (let i = 0; i < infos.length; i += 1) {
      const info = infos[i];
      const path = cache[i];
      path.setAttribute("d", info.d);
      path.setAttribute("stroke", info.stroke);
      path.setAttribute("stroke-width", String(info.strokeWidth));
      path.setAttribute("fill", info.fill || "none");
    }
    return cache;
  }

  private drawNodeShape(view: NodeView): void {
    const color = getNodeColor(view.data, this.options);
    const fill = getNodeFill(view.data, this.options);
    // 空内容的根节点画成圆点，避免出现一个空方框
    const isCenterDot = view.data.depth === 0 && view.data.content === "";
    const key = [
      Math.round(view.width),
      Math.round(view.height),
      color,
      fill ?? "",
      isCenterDot ? "dot" : "rect",
      this.shapeToken,
    ].join("|");
    if (key === view.shapeKey) return;
    view.shapeKey = key;

    const seed = this.seedOf(view.id);
    const options = this.roughOptions(seed, color, fill);
    const drawable = isCenterDot
      ? this.generator.circle(
          view.width / 2,
          view.height / 2,
          Math.min(view.width, view.height),
          options,
        )
      : this.generator.rectangle(0, 0, view.width, view.height, options);

    view.shapePaths = this.writePaths(
      view.shape,
      view.shapePaths,
      this.generator.toPaths(drawable),
    );
  }

  /**
   * 重绘折叠标识。
   *
   * 展开态是实心圆 + 白色减号；折叠态是实心胶囊 + 白色 `+N`（N 为直接子节点数）。
   * 胶囊而不是圆，是因为默认 toggleRadius 只有 5，直径 10px 塞不下多位数。
   */
  private updateToggle(view: NodeView, node: LayoutNode): void {
    if (!view.hasChildren) {
      view.toggle.style.display = "none";
      return;
    }
    view.toggle.style.display = "";

    const badge = getToggleBadge(
      this.options,
      this.folded.has(node.id),
      node.data.children.length,
    );
    const cx = view.width;
    const cy = view.height / 2;
    // 缓存键必须带上 label：折叠数量变了（或开关翻转）就得重绘
    const key = [
      badge.label,
      Math.round(badge.width),
      Math.round(badge.height),
      view.width,
      view.height,
      this.shapeToken,
    ].join("|");
    if (key === view.toggleKey) return;
    view.toggleKey = key;

    const color = getNodeColor(view.data, this.options);
    const seed = this.seedOf(`${view.id}#toggle`);
    const left = cx + badge.offsetX;
    const top = cy - badge.height / 2;
    // 标识只有十几像素，必须压住手绘抖动、并且关掉 rough 的双描边：
    // 两条各偏 2px 的线重叠在一起会把小图形糊成一坨
    const fill = {
      fillStyle: "solid" as const,
      strokeWidth: 1,
      roughness: Math.min(this.options.roughness, 1.2),
      bowing: Math.min(this.options.bowing, 0.8),
      maxRandomnessOffset: 1,
      disableMultiStroke: true,
    };

    // 轮廓：展开画圆，折叠画圆角胶囊（都是手绘线条）
    const outline = badge.folded
      ? this.generator.path(
          roundedRectPath(left, top, badge.width, badge.height),
          this.roughOptions(seed, color, color, fill),
        )
      : this.generator.circle(
          cx,
          cy,
          badge.height,
          this.roughOptions(seed, color, color, fill),
        );

    const drawables: Drawable[] = [outline];

    if (badge.folded) {
      // 数字用 SVG <text> 叠加（rough 不画字）
      view.toggleLabel.textContent = badge.label;
      view.toggleLabel.setAttribute("x", String(left + badge.width / 2));
      view.toggleLabel.setAttribute(
        "y",
        String(cy + badge.fontSize * TOGGLE_BASELINE_RATIO),
      );
      view.toggleLabel.setAttribute("font-size", String(badge.fontSize));
      view.toggleLabel.style.display = "";
    } else {
      // 展开态画一条白色减号
      view.toggleLabel.style.display = "none";
      drawables.push(
        this.generator.line(
          cx - this.options.toggleRadius * 0.5,
          cy,
          cx + this.options.toggleRadius * 0.5,
          cy,
          this.roughOptions(seed + 1, "#ffffff", undefined, {
            roughness: 0.6,
            bowing: 0.4,
            strokeWidth: 1.4,
          }),
        ),
      );
    }

    const infos: PathInfo[] = [];
    for (const drawable of drawables) {
      infos.push(...this.generator.toPaths(drawable));
    }
    view.togglePaths = this.writePaths(view.toggle, view.togglePaths, infos);
    // writePaths 是往后追加的，这里把文字挪到末尾，否则会被轮廓盖住
    view.toggle.appendChild(view.toggleLabel);

    // 命中区域跟随标识实际尺寸，胶囊变宽后点击范围才不会错位
    view.toggleHit.setAttribute("x", String(left - TOGGLE_HIT_PADDING));
    view.toggleHit.setAttribute("y", String(top - TOGGLE_HIT_PADDING));
    view.toggleHit.setAttribute("width", String(badge.width + TOGGLE_HIT_PADDING * 2));
    view.toggleHit.setAttribute("height", String(badge.height + TOGGLE_HIT_PADDING * 2));
  }

  // ------------------------------------------------------------------
  // 内部工具
  // ------------------------------------------------------------------

  /**
   * 把影响文本排版的样式写成内联样式。
   * 这些值必须和 measure.ts 里的测量参数一致，否则节点尺寸会和实际渲染对不上。
   */
  private applyBodyStyle(body: HTMLElement): void {
    const o = this.options;
    const { style } = body;
    style.padding = `${o.nodePadding}px`;
    style.fontFamily = o.fontFamily;
    style.fontSize = `${o.fontSize}px`;
    style.lineHeight = String(o.lineHeight);
  }

  private refreshShapeToken(): void {
    const o = this.options;
    this.shapeToken = [
      o.roughness,
      o.bowing,
      o.fillStyle,
      o.fillWeight,
      o.hachureAngle,
      o.hachureGap,
      o.strokeWidth,
      o.seed,
    ].join(",");
  }

  /**
   * 每个图形独立的 rough 种子。
   * 由「节点 id + 全局 seed」派生，保证同一节点每次重绘形状完全一致，不会闪烁。
   */
  private seedOf(key: string): number {
    return ((hashToSeed(key) ^ (this.options.seed | 0)) >>> 0) || 1;
  }

  private roughOptions(
    seed: number,
    stroke: string,
    fill?: string,
    overrides: RoughOptions = {},
  ): RoughOptions {
    const o = this.options;
    return {
      seed,
      roughness: o.roughness,
      bowing: o.bowing,
      stroke,
      strokeWidth: o.strokeWidth,
      fill,
      fillStyle: o.fillStyle,
      fillWeight: o.fillWeight,
      hachureAngle: o.hachureAngle,
      hachureGap: o.hachureGap,
      curveFitting: 0.95,
      ...overrides,
    };
  }

  private closestNodeElement(target: EventTarget | null): SVGGElement | null {
    if (!(target instanceof Element)) return null;
    const element = target.closest("g.mvs-node");
    return element instanceof SVGGElement ? element : null;
  }

  /** 这次 click 之前指针是否位移过（即拖拽平移，而不是点击） */
  private isDragged(event: MouseEvent): boolean {
    const down = this.pointerDownAt;
    if (!down) return false;
    return (
      Math.hypot(event.clientX - down.x, event.clientY - down.y) >
      CLICK_DRAG_THRESHOLD
    );
  }

  private onClick(event: MouseEvent): void {
    const group = this.closestNodeElement(event.target);
    if (!group) return;
    const id = group.dataset.id;
    if (!id) return;
    const node = this.layoutNodes.get(id);
    if (!node) return;

    // 节点内的链接优先：拖拽过就别当点击，否则拖画布会误触发跳转
    const anchor = (event.target as Element | null)?.closest?.("a[href]");
    if (anchor) {
      if (this.isDragged(event)) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      const href = anchor.getAttribute("href") ?? "";
      this.events.onLinkClick?.(node.data, href, event);
      // 没有 preventDefault 的话，交给浏览器按 <a> 自己的 href/target 跳转
      return;
    }

    // 图片必须排在链接之后：`[![图](a.png)](https://…)` 这种嵌套里，
    // 点图应当跟链接走，而不是打开查看器
    const image = (event.target as Element | null)?.closest?.("img.mvs-node-image");
    if (image) {
      if (this.isDragged(event)) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      this.events.onImageClick?.(
        node.data,
        {
          // 读原始属性而不是 `img.src`：后者会被浏览器补成绝对地址，
          // 换成 data URL 展示时也对不上内联映射表
          src: image.getAttribute("src") ?? "",
          alt: image.getAttribute("alt") ?? "",
        },
        event,
      );
      return;
    }

    const toggle = (event.target as Element | null)?.closest?.(".mvs-node-toggle");
    if (toggle) {
      if (this.readonlyMode) return;
      event.stopPropagation();
      if (event.altKey) {
        this.toggleSubtree(id, !this.folded.has(id));
      } else {
        this.toggle(id);
      }
      return;
    }

    if (this.isDragged(event)) return;
    this.events.onNodeClick?.(node.data, event);
  }

  /** 记录指针按下位置，用于区分「点击」和「拖拽平移」 */
  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerDownAt = { x: event.clientX, y: event.clientY };
  };

  private onPointerOver(event: MouseEvent): void {
    const group = this.closestNodeElement(event.target);
    if (!group?.dataset.id) return;

    /*
     * 含链接的节点不触发 hover 高亮。
     *
     * 指针停在链接上通常是要点击，而高亮会把其余节点压到 opacity 0.22 ——
     * 整张图看起来像盖了一层蒙版，反而看不清自己要点的是哪条。
     * 普通节点的高亮路径行为保持不变。
     */
    if (group.querySelector("a")) {
      this.setHighlight(null);
      return;
    }

    this.setHighlight(group.dataset.id);
  }

  private onPointerOut(event: MouseEvent): void {
    const group = this.closestNodeElement(event.target);
    if (!group?.dataset.id) return;
    const related = this.closestNodeElement(event.relatedTarget);
    if (related?.dataset.id === group.dataset.id) return;
    this.setHighlight(null);
  }
}
