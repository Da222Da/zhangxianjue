import { select } from "d3-selection";
import {
  zoom as createZoom,
  zoomIdentity,
  type D3ZoomEvent,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3-zoom";
import { Animator } from "./animate";
import { clamp, lerp, round2 } from "./utils";

/** 布局坐标系下的包围盒：x 为垂直方向，y 为水平方向 */
export interface ContentBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ZoomControllerOptions {
  scaleExtent: [number, number];
  enableZoom: boolean;
  enablePan: boolean;
  /** 视图动画时长，复用折叠动画的 duration */
  duration: number;
  onZoom?: (transform: ZoomTransform) => void;
}

/**
 * d3-zoom 封装。
 *
 * 只把 transform 作用在外层 `<g>` 上，缩放平移期间不重绘任何图形，
 * 因此无论图有多大都能保持 60fps。
 */
export class ZoomController {
  private behavior: ZoomBehavior<SVGSVGElement, unknown>;
  private current: ZoomTransform = zoomIdentity;
  private animator = new Animator();
  private viewportWidth = 0;
  private viewportHeight = 0;

  constructor(
    private readonly svg: SVGSVGElement,
    private readonly content: SVGGElement,
    private options: ZoomControllerOptions,
  ) {
    this.behavior = createZoom<SVGSVGElement, unknown>()
      .scaleExtent(options.scaleExtent)
      // 强制挂上触摸监听。
      // d3-zoom 默认用 `navigator.maxTouchPoints || ("ontouchstart" in this)`
      // 在「绑定那一刻」探测一次，探测不到就永远不绑 —— 页面加载后才具备
      // 触摸能力的场景（二合一笔记本、WebView、DevTools 的设备模拟）
      // 会直接失效。这里改成始终绑定，具体放不放行由下面的 filter 决定。
      .touchable(true)
      .filter((event: Event) => {
        if (event.type === "wheel") return this.options.enableZoom;
        if (event.type.startsWith("touch")) {
          return this.options.enableZoom || this.options.enablePan;
        }
        return this.options.enablePan;
      })
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        // 用户操作优先：打断进行中的视图动画
        this.animator.cancel();
        this.apply(event.transform);
      });

    const selection = select(svg);
    // d3 的 ZoomBehavior 是「可被 selection.call 调用」的函数对象，
    // 类型定义在这里对不上，做一次显式转换
    type ZoomSelection = typeof selection;
    selection.call(this.behavior as unknown as (target: ZoomSelection) => void);
    selection.on("dblclick.zoom", null);
    this.resize();
  }

  /** 重新读取视口尺寸（容器尺寸变化后调用） */
  resize(): void {
    const rect = this.svg.getBoundingClientRect?.();
    const width = rect?.width || this.svg.clientWidth || 800;
    const height = rect?.height || this.svg.clientHeight || 600;
    if (width === this.viewportWidth && height === this.viewportHeight) return;

    const previousWidth = this.viewportWidth;
    const previousHeight = this.viewportHeight;
    this.viewportWidth = width;
    this.viewportHeight = height;

    // 视口尺寸变了（手机横竖屏切换、侧边栏收起等）就把内容按中心平移回去。
    // 不这么做的话 transform 还停留在旧尺寸的坐标系里，图会整个飘到屏幕外，
    // 用户得先盲拖才能找回来。
    if (previousWidth > 0 && previousHeight > 0) {
      this.commit(
        zoomIdentity
          .translate(
            this.current.x + (width - previousWidth) / 2,
            this.current.y + (height - previousHeight) / 2,
          )
          .scale(this.current.k),
      );
    }
  }

  get width(): number {
    return this.viewportWidth;
  }

  get height(): number {
    return this.viewportHeight;
  }

  getTransform(): ZoomTransform {
    return this.current;
  }

  setOptions(options: Partial<ZoomControllerOptions>): void {
    const next = { ...this.options, ...options };
    if (options.scaleExtent) {
      next.scaleExtent = [...options.scaleExtent] as [number, number];
    }
    this.options = next;
    this.behavior.scaleExtent(next.scaleExtent);
  }

  /** 程序化设置视图变换 */
  setTransform(target: ZoomTransform, animate = true): void {
    this.animator.cancel();
    if (!animate || this.options.duration <= 0) {
      this.commit(target);
      return;
    }
    const from = this.current;
    this.animator.run(this.options.duration, (progress) => {
      this.commit(this.interpolate(from, target, progress));
    });
  }

  /** 缩放到内容全部可见并居中 */
  fit(box: ContentBox, padding = 40, animate = true): void {
    const contentWidth = Math.max(box.y1 - box.y0, 1);
    const contentHeight = Math.max(box.x1 - box.x0, 1);
    const [minScale, maxScale] = this.options.scaleExtent;
    const scale = clamp(
      Math.min(
        (this.viewportWidth - padding * 2) / contentWidth,
        (this.viewportHeight - padding * 2) / contentHeight,
        1,
      ),
      minScale,
      maxScale,
    );
    this.centerOn(
      (box.y0 + box.y1) / 2,
      (box.x0 + box.x1) / 2,
      scale,
      animate,
    );
  }

  /**
   * 把内容坐标 (centerX, centerY) 移到视口中心。
   * 注意参数是屏幕语义：centerX 为水平方向（对应布局的 y），centerY 为垂直方向（对应布局的 x）。
   */
  centerOn(
    centerX: number,
    centerY: number,
    scale = this.current.k,
    animate = true,
  ): void {
    const [minScale, maxScale] = this.options.scaleExtent;
    const next = clamp(scale, minScale, maxScale);
    this.setTransform(
      zoomIdentity
        .translate(this.viewportWidth / 2 - next * centerX, this.viewportHeight / 2 - next * centerY)
        .scale(next),
      animate,
    );
  }

  /** 以视口中心为锚点按倍率缩放 */
  zoomBy(factor: number, animate = true): void {
    const { k, x, y } = this.current;
    const [minScale, maxScale] = this.options.scaleExtent;
    const next = clamp(k * factor, minScale, maxScale);
    const centerX = (this.viewportWidth / 2 - x) / k;
    const centerY = (this.viewportHeight / 2 - y) / k;
    this.centerOn(centerX, centerY, next, animate);
  }

  reset(animate = true): void {
    this.centerOn(0, 0, 1, animate);
  }

  destroy(): void {
    this.animator.cancel();
    select(this.svg).on(".zoom", null);
  }

  private commit(transform: ZoomTransform): void {
    // 同步 d3-zoom 的内部状态，保证滚轮缩放从当前位置继续
    (this.svg as unknown as { __zoom: ZoomTransform }).__zoom = transform;
    this.apply(transform);
  }

  private apply(transform: ZoomTransform): void {
    this.current = transform;
    this.content.setAttribute(
      "transform",
      `translate(${round2(transform.x)},${round2(transform.y)}) scale(${round2(transform.k)})`,
    );
    this.options.onZoom?.(transform);
  }

  /**
   * 视图动画的插值：线性插值缩放倍率与「视口中心对应的内容点」，
   * 比直接线性插值 x/y/k 的路径自然得多。
   */
  private interpolate(
    from: ZoomTransform,
    to: ZoomTransform,
    progress: number,
  ): ZoomTransform {
    const cx = this.viewportWidth / 2;
    const cy = this.viewportHeight / 2;
    const fromCenterX = (cx - from.x) / from.k;
    const fromCenterY = (cy - from.y) / from.k;
    const toCenterX = (cx - to.x) / to.k;
    const toCenterY = (cy - to.y) / to.k;

    const k = lerp(from.k, to.k, progress);
    const centerX = lerp(fromCenterX, toCenterX, progress);
    const centerY = lerp(fromCenterY, toCenterY, progress);
    return zoomIdentity
      .translate(cx - k * centerX, cy - k * centerY)
      .scale(k);
  }
}
