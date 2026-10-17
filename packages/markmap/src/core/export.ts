import type { NodeTextLayout, TextRun } from "../types";
import {
  CODE_FONT_RATIO,
  CODE_GAP,
  CODE_LINE_HEIGHT,
  CODE_PADDING,
  IMAGE_GAP,
} from "./measure";
import { parseInlineRuns, runsToText, splitRunsByLines } from "./richtext";
import { round2 } from "./utils";
import type { ContentBox } from "./zoom";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * 文本基线的经验偏移量（相对字号）。
 * 手算而不是用 dominant-baseline，是为了让导出结果在任何渲染器
 * （浏览器、Illustrator、Figma、resvg）里位置都一致。
 */
const BASELINE_RATIO = 0.35;

export interface ExportSvgOptions {
  /** 四周留白 */
  padding?: number;
  /** 背景色；留空表示透明 */
  backgroundColor?: string;
  /**
   * 图片 `src` → data URL 的映射。
   *
   * 提供了就只输出表里有的图片，抓取失败的会被跳过 —— 跨域图片会把 canvas 污染，
   * 留着它 `canvas.toBlob()` 会直接抛 SecurityError。
   * 不提供则保留原始 URL（导出物依赖网络，但 `exportSvg()` 能保持同步）。
   */
  imageData?: Map<string, string>;
  /**
   * 节点文本排版信息（`renderer.getTextLayouts()`）。
   *
   * 传了它，导出时会把 `<foreignObject>` 换成原生 `<text>` / `<tspan>`：
   * - 导出的 SVG 可以被设计工具直接打开
   * - 更重要的是，Chrome 把含 foreignObject 的 SVG 画进 canvas 时会污染画布，
   *   不换掉的话 `exportPng()` 会直接抛 SecurityError
   *
   * 不传则保留 foreignObject（视觉与屏幕完全一致，但无法导出 PNG）。
   */
  texts?: Map<string, NodeTextLayout>;
}

export interface ExportPngOptions extends Omit<ExportSvgOptions, "backgroundColor"> {
  /** 像素倍率，2 表示导出 2 倍图 */
  scale?: number;
  /** 图片 MIME 类型 */
  type?: string;
  /** 有损格式的质量，0~1 */
  quality?: number;
  /**
   * 背景色。缺省为白色 —— PNG 没有「继承页面背景」的概念，
   * 透明底贴进文档或预览器里通常看起来就是一张坏图。
   * 确实需要透明背景时显式传 `'transparent'`。
   */
  backgroundColor?: string;
}

interface SceneGeometry {
  width: number;
  height: number;
  viewBox: string;
}

function sceneGeometry(box: ContentBox, padding: number): SceneGeometry {
  // 布局的 x 是垂直方向、y 是水平方向，转换到 SVG 坐标系时两者互换
  const width = Math.max(round2(box.y1 - box.y0 + padding * 2), 1);
  const height = Math.max(round2(box.x1 - box.x0 + padding * 2), 1);
  return {
    width,
    height,
    viewBox: `${round2(box.y0 - padding)} ${round2(box.x0 - padding)} ${width} ${height}`,
  };
}

/**
 * 收集页面里所有与组件相关的 CSS 规则。
 * 导出的 SVG 脱离文档后不会带上外部样式表，几何样式（描边宽度、填充规则等）
 * 就会丢失，所以必须把规则内联进去。
 */
function collectComponentStyles(): string {
  if (typeof document === "undefined") return "";
  const chunks: string[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      // 跨域样式表读不到 cssRules，跳过
      continue;
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      const text = rule.cssText ?? "";
      // 只带与文本无关的几何样式，文本样式直接写在 <text> 属性上
      if (text.includes("mvs-link") || text.includes("mvs-node-shape")) {
        chunks.push(text);
      }
    }
  }
  return chunks.join("\n");
}

/**
 * 决定导出时用哪个图片地址。
 *
 * - 没传 `imageData`（同步导出）：保留原 URL，导出物需要联网
 * - 传了 `imageData`：优先用抓到的 data URL；
 *   data URL 本身不会污染画布，直接留用；
 *   其余抓取失败的才跳过 —— 留着会让 `canvas.toBlob()` 抛 SecurityError
 */
function resolveImageSource(
  src: string,
  imageData?: Map<string, string>,
): string | undefined {
  if (!imageData) return src;
  return imageData.get(src) ?? (src.startsWith("data:") ? src : undefined);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyRunStyle(tspan: SVGElement, run: TextRun, baseColor: string): void {
  if (run.bold) tspan.setAttribute("font-weight", "700");
  if (run.italic) tspan.setAttribute("font-style", "italic");
  if (run.code) {
    tspan.setAttribute("font-family", "monospace");
    tspan.setAttribute("font-size", "0.92em");
  }
  if (run.href) {
    tspan.setAttribute("fill", baseColor);
    tspan.setAttribute("text-decoration", "underline");
  }
}

/**
 * 用原生 `<text>` / `<tspan>` 重建一个节点的文本。
 * 行位置与 measure.ts 的排版常量严格对齐，保证和屏幕上看到的一致。
 */
function buildNodeTextElements(
  layout: NodeTextLayout,
  width: number,
  height: number,
  color: string,
  imageData?: Map<string, string>,
): SVGElement[] {
  const elements: SVGElement[] = [];
  const { fontSize, lineHeight, padding } = layout;
  const lineHeightPx = fontSize * lineHeight;
  const textLines = layout.lines.filter((line, index) => line || index === 0);
  const hasCode = layout.codeLines.length > 0;
  const codeLineHeightPx = fontSize * CODE_FONT_RATIO * CODE_LINE_HEIGHT;
  const codeBlockHeight = hasCode
    ? layout.codeLines.length * codeLineHeightPx + CODE_PADDING * 2
    : 0;
  const imageHeight = layout.images.reduce(
    (sum, image) => sum + IMAGE_GAP + image.height,
    0,
  );

  // 顺序必须和 measure.ts 一致：文本 → 图片 → 代码块
  const contentHeight =
    textLines.length * lineHeightPx +
    imageHeight +
    (hasCode ? CODE_GAP + codeBlockHeight : 0);
  const contentTop = padding + (height - padding * 2 - contentHeight) / 2;

  // ---- 正文 ----
  if (textLines.length) {
    const runs = parseInlineRuns(layout.content, { linkIcons: layout.linkIcons });
    const plain = runsToText(runs);
    const styledLines = splitRunsByLines(runs, textLines, plain);

    styledLines.forEach((styledRuns, index) => {
      if (!styledRuns.length) return;
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", String(round2(padding)));
      text.setAttribute(
        "y",
        String(round2(contentTop + (index + 0.5) * lineHeightPx + fontSize * BASELINE_RATIO)),
      );
      text.setAttribute("font-family", layout.fontFamily);
      text.setAttribute("font-size", String(fontSize));
      text.setAttribute("fill", color);
      text.setAttribute("xml:space", "preserve");

      for (const run of styledRuns) {
        const tspan = document.createElementNS(SVG_NS, "tspan");
        tspan.textContent = run.text;
        applyRunStyle(tspan, run, color);
        text.appendChild(tspan);
      }
      elements.push(text);
    });
  }

  // ---- 图片 ----
  if (layout.images.length) {
    let top = contentTop + textLines.length * lineHeightPx;
    for (const image of layout.images) {
      top += IMAGE_GAP;
      const source = resolveImageSource(image.src, imageData);
      if (!source) {
        // 抓取失败：跳过而不是留原 URL，否则会把 canvas 拖脏
        top += image.height;
        continue;
      }
      const element = document.createElementNS(SVG_NS, "image");
      element.setAttribute("x", String(round2(padding)));
      element.setAttribute("y", String(round2(top)));
      element.setAttribute("width", String(round2(image.width)));
      element.setAttribute("height", String(round2(image.height)));
      element.setAttribute("preserveAspectRatio", "xMidYMid meet");
      element.setAttribute("href", source);
      // xlink:href 兼容老一点的设计工具
      element.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", source);
      elements.push(element);
      top += image.height;
    }
  }

  // ---- 代码块 ----
  if (hasCode) {
    const codeTop = contentTop + textLines.length * lineHeightPx + CODE_GAP;
    const background = document.createElementNS(SVG_NS, "rect");
    background.setAttribute("x", String(round2(padding)));
    background.setAttribute("y", String(round2(codeTop)));
    background.setAttribute("width", String(round2(Math.max(width - padding * 2, 1))));
    background.setAttribute("height", String(round2(codeBlockHeight)));
    background.setAttribute("rx", "4");
    background.setAttribute("fill", "rgba(47, 53, 66, 0.06)");
    elements.push(background);

    layout.codeLines.forEach((line, index) => {
      if (!line) return;
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", String(round2(padding + CODE_PADDING)));
      text.setAttribute(
        "y",
        String(
          round2(
            codeTop +
              CODE_PADDING +
              (index + 0.5) * codeLineHeightPx +
              fontSize * CODE_FONT_RATIO * BASELINE_RATIO,
          ),
        ),
      );
      text.setAttribute("font-family", "monospace");
      text.setAttribute("font-size", String(round2(fontSize * CODE_FONT_RATIO)));
      text.setAttribute("fill", color);
      text.setAttribute("xml:space", "preserve");
      text.textContent = line;
      elements.push(text);
    });
  }

  return elements;
}

/**
 * 把实时渲染的 SVG 序列化成可独立打开的 SVG 字符串。
 * 会重置视图变换，导出完整内容而不是当前可视区域。
 */
export function serializeSvg(
  svg: SVGSVGElement,
  box: ContentBox,
  options: ExportSvgOptions = {},
): string {
  const padding = options.padding ?? 24;
  const { width, height, viewBox } = sceneGeometry(box, padding);

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("viewBox", viewBox);

  // 导出完整内容：清掉缩放平移与 hover 高亮残留
  clone.querySelector(".mvs-zoom")?.setAttribute("transform", "");
  // 内联 display:none 的元素（叶子节点的折叠标识、展开态的数量文字）直接删掉，
  // 免得设计工具忽略内联样式后把它们渲染出来
  for (const element of Array.from(
    clone.querySelectorAll('[style*="display: none"]'),
  )) {
    element.remove();
  }
  clone.querySelector(".mvs-nodes")?.classList.remove("mvs-has-highlight");
  for (const element of Array.from(clone.querySelectorAll(".mvs-active"))) {
    element.classList.remove("mvs-active");
  }

  // foreignObject → 原生 <text>，同时避免 canvas 被污染
  const texts = options.texts;
  if (texts) {
    for (const nodeElement of Array.from(clone.querySelectorAll(".mvs-node"))) {
      const foreignObject = nodeElement.querySelector("foreignObject");
      if (!foreignObject) continue;
      const layout = texts.get(nodeElement.getAttribute("data-id") ?? "");
      if (!layout) continue;

      const nodeWidth = Number(foreignObject.getAttribute("width")) || 0;
      const nodeHeight = Number(foreignObject.getAttribute("height")) || 0;

      foreignObject.remove();
      for (const element of buildNodeTextElements(
        layout,
        nodeWidth,
        nodeHeight,
        layout.color,
        options.imageData,
      )) {
        nodeElement.appendChild(element);
      }
    }
  }

  // 背景与样式表插到最前面（createElementNS 保证序列化时命名空间正确）
  const styles = collectComponentStyles();
  if (styles) {
    const styleElement = document.createElementNS(SVG_NS, "style");
    styleElement.textContent = styles;
    clone.insertBefore(styleElement, clone.firstChild);
  }
  if (options.backgroundColor && options.backgroundColor !== "transparent") {
    const background = document.createElementNS(SVG_NS, "rect");
    background.setAttribute("x", String(round2(box.y0 - padding)));
    background.setAttribute("y", String(round2(box.x0 - padding)));
    background.setAttribute("width", String(width));
    background.setAttribute("height", String(height));
    background.setAttribute("fill", options.backgroundColor);
    clone.insertBefore(background, clone.firstChild);
  }

  const source = new XMLSerializer().serializeToString(clone);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${source}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(blob);
  });
}

/**
 * 把图片抓成 data URL。
 *
 * 跨域图片只要服务端没给 CORS 头就抓不到，这里直接跳过 —— 留着原 URL 的话
 * 画进 canvas 会把画布污染，`toBlob()` 抛 SecurityError，整张 PNG 都导不出来。
 * 宁可少一张图，也不能让导出整个失败。
 */
export async function inlineImages(
  sources: Iterable<string>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [...new Set(sources)].filter(
    (src) => src && !src.startsWith("data:"),
  );

  await Promise.all(
    unique.map(async (src) => {
      try {
        const response = await fetch(src, { mode: "cors", credentials: "omit" });
        if (!response.ok) return;
        result.set(src, await blobToDataUrl(await response.blob()));
      } catch {
        // 跨域 / 网络失败：跳过
      }
    }),
  );
  return result;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("[@zhangxianjue/markmap] SVG 转换为图片失败"));
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("[@zhangxianjue/markmap] canvas 导出失败"));
      },
      type,
      quality,
    );
  });
}

/**
 * 导出 PNG。
 * 链路：SVG 字符串 → Blob URL → Image → canvas → Blob。
 *
 * 必须传 `texts`，否则 SVG 里的 foreignObject 会让 Chrome 污染画布，
 * `canvas.toBlob()` 会抛 SecurityError。
 */
export async function exportPng(
  svg: SVGSVGElement,
  box: ContentBox,
  options: ExportPngOptions = {},
): Promise<Blob> {
  if (!options.texts) {
    throw new Error(
      "[@zhangxianjue/markmap] exportPng 需要传入 texts（renderer.getTextLayouts()）：" +
        "含 foreignObject 的 SVG 会被 Chrome 判定为污染画布，无法导出 PNG",
    );
  }

  const scale = options.scale && options.scale > 0 ? options.scale : 2;
  const type = options.type ?? "image/png";
  const quality = options.quality ?? 1;
  const backgroundColor = options.backgroundColor ?? "#ffffff";

  const padding = options.padding ?? 24;
  const geometry = sceneGeometry(box, padding);

  // 图片必须先抓成 data URL：跨域图会把 canvas 污染，toBlob() 直接抛 SecurityError
  const sources = [...(options.texts?.values() ?? [])].flatMap((layout) =>
    layout.images.map((image) => image.src),
  );
  const imageData = sources.length
    ? await inlineImages(sources)
    : new Map<string, string>();

  // 背景色直接画在 canvas 上，避免 SVG 里再叠一层
  const source = serializeSvg(svg, box, {
    ...options,
    backgroundColor: "",
    imageData,
  });

  const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(Math.round(geometry.width * scale), 1);
    canvas.height = Math.max(Math.round(geometry.height * scale), 1);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("[@zhangxianjue/markmap] 无法获取 canvas 上下文");
    }
    context.scale(scale, scale);
    if (backgroundColor && backgroundColor !== "transparent") {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, geometry.width, geometry.height);
    }
    context.drawImage(image, 0, 0, geometry.width, geometry.height);

    return await canvasToBlob(canvas, type, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // 立刻回收会让部分浏览器来不及开始下载，延后释放
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
