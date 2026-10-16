import type {
  NodeMeasurer,
  NodeMetrics,
  ResolvedMarkmapOptions,
  TextRun,
  TreeNode,
} from "../types";
import { getNaturalSize, resolveImageLayout } from "./images";
import { renderInline } from "./markdown";
import { parseInlineContent, runsToText, wrapRuns } from "./richtext";
import { escapeHtml, isWideChar } from "./utils";

/**
 * 排版常量，需要与 styles/index.css 保持一致。
 * 导出成原生 `<text>` 时也用同一组常量换算行位置（见 core/export.ts）。
 */
/** 代码块的字体缩放比例（`.mvs-node-code` 的 font-size） */
export const CODE_FONT_RATIO = 0.85;
export const CODE_LINE_HEIGHT = 1.4;
/** 正文与代码块之间的间距 */
export const CODE_GAP = 6;
/** 代码块自身的左右内边距 */
export const CODE_PADDING = 8;
/** 行内代码的字号比例（`.mvs-node-text code`） */
export const INLINE_CODE_FONT_RATIO = 0.92;
/** 行内代码的左右内边距（`.mvs-node-text code`） */
export const INLINE_CODE_PADDING = 3;
/** 文本 / 代码块 / 图片之间的纵向间距（`.mvs-node-image` 的 margin-top） */
export const IMAGE_GAP = 6;

/** 无 canvas 时的兜底字宽表（单位：em） */
function fallbackCharWidth(char: string): number {
  if (isWideChar(char)) return 1;
  if (char === " ") return 0.28;
  if (/[iIljtfr!.,;:|'`()[\]]/.test(char)) return 0.32;
  if (/[MWmw@%]/.test(char)) return 0.85;
  if (/[0-9]/.test(char)) return 0.56;
  if (/[A-Z]/.test(char)) return 0.68;
  return 0.56;
}

type MeasureFn = (text: string) => number;

/**
 * 每个字体一个独立的 canvas 上下文。
 *
 * 不能共用一个上下文：`ctx.font` 是上下文级状态，
 * 后创建的量器（代码块用的 monospace）会把先前量器的字体覆盖掉，
 * 结果正文全部按 monospace 小字号测量，节点框会系统性偏窄、文字被迫换行。
 */
const contextPool = new Map<string, CanvasRenderingContext2D | null>();

function getContextFor(font: string): CanvasRenderingContext2D | null {
  const cached = contextPool.get(font);
  if (cached !== undefined) return cached;

  let context: CanvasRenderingContext2D | null = null;
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    try {
      context = document.createElement("canvas").getContext("2d");
      if (context) {
        context.font = font;
        // 无法解析的 font 字符串会被静默忽略，此时视为不可用
        const size = font.slice(0, font.indexOf("px") + 2);
        if (!context.font || !context.font.startsWith(size)) context = null;
      }
    } catch {
      context = null;
    }
  }

  contextPool.set(font, context);
  return context;
}

/**
 * 创建一个文本宽度测量函数。
 * 浏览器里用 canvas 的真实字体度量；Node（单元测试）里退化为字宽估算。
 */
function createTextMeasure(font: string, fontSize: number): MeasureFn {
  const cache = new Map<string, number>();
  const context = getContextFor(font);

  const estimate: MeasureFn = (text) => {
    const cached = cache.get(text);
    if (cached !== undefined) return cached;
    let width = 0;
    for (const char of text) width += fallbackCharWidth(char);
    const result = width * fontSize;
    cache.set(text, result);
    return result;
  };

  if (!context) return estimate;

  return (text) => {
    const cached = cache.get(text);
    if (cached !== undefined) return cached;
    const width = context.measureText(text).width;
    cache.set(text, width);
    return width;
  };
}

/**
 * 把文本按最大宽度切成多行。
 * 中日韩字符逐个可断行，拉丁单词整体不可断。
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: MeasureFn,
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const token of tokenize(paragraph)) {
      if (!line) {
        if (/^\s+$/.test(token)) continue;
        line = token;
        continue;
      }
      const candidate = line + token;
      if (measure(candidate) > maxWidth) {
        lines.push(line.replace(/\s+$/, ""));
        line = /^\s+$/.test(token) ? "" : token;
      } else {
        line = candidate;
      }
    }
    lines.push(line.replace(/\s+$/, ""));
  }

  return lines.length ? lines : [""];
}

/** 切成断行单元：全角字符与空白各自成 token，拉丁单词整体成 token */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer) {
      tokens.push(buffer);
      buffer = "";
    }
  };

  for (const char of text) {
    if (isWideChar(char) || /\s/.test(char)) {
      flush();
      tokens.push(char);
    } else {
      buffer += char;
    }
  }
  flush();
  return tokens;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity);
}

/**
 * 创建节点测量器。
 * 结果按「内容 + 代码块」缓存，Markdown 反复编辑时命中率高。
 */
export function createNodeMeasurer(
  options: ResolvedMarkmapOptions,
  /** 图片加载完、尺寸发生变化时回调，调用方据此重新布局 */
  onImageResolved?: () => void,
): NodeMeasurer {
  const { fontSize, fontFamily } = options;
  // 每种行内样式一个量器：加粗、斜体和 monospace 行内代码的宽度都不一样
  const regular = createTextMeasure(`${fontSize}px ${fontFamily}`, fontSize);
  const bold = createTextMeasure(`bold ${fontSize}px ${fontFamily}`, fontSize);
  const italic = createTextMeasure(
    `italic ${fontSize}px ${fontFamily}`,
    fontSize,
  );
  const boldItalic = createTextMeasure(
    `bold italic ${fontSize}px ${fontFamily}`,
    fontSize,
  );
  const inlineCode = createTextMeasure(
    `${fontSize * INLINE_CODE_FONT_RATIO}px monospace`,
    fontSize * INLINE_CODE_FONT_RATIO,
  );
  const codeMeasure = createTextMeasure(
    `${fontSize * CODE_FONT_RATIO}px monospace`,
    fontSize * CODE_FONT_RATIO,
  );
  const cache = new Map<string, NodeMetrics>();
  const lineHeightPx = options.fontSize * options.lineHeight;
  const padding = options.nodePadding;

  /** 按片段自身的样式选字体测量；行内代码还要算上左右内边距 */
  const measureRun = (text: string, run: TextRun): number => {
    if (run.code) {
      return inlineCode(text) + INLINE_CODE_PADDING * 2;
    }
    if (run.bold && run.italic) return boldItalic(text);
    if (run.bold) return bold(text);
    if (run.italic) return italic(text);
    return regular(text);
  };

  const renderEnv = { linkIcons: options.linkIcons, omitImages: true };

  return (node: TreeNode): NodeMetrics => {
    const code = node.payload?.lines ?? "";
    const content = node.content;
    // 图片尺寸要等加载完才知道，缓存键里带上尺寸/就绪状态，
    // 加载完成后键自然变化，不用额外暴露清缓存的方法
    const imageSignature = parseInlineContent(content, renderEnv).images
      .map((image) => {
        const size = getNaturalSize(image.src);
        return size ? `${size.width}x${size.height}` : size === null ? "failed" : "pending";
      })
      .join(",");
    const key = `${content}\u0000${code}\u0000${imageSignature}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const rendered = renderInline(content, renderEnv);
    const { runs, images } = parseInlineContent(content, renderEnv);
    const text = runsToText(runs) || stripTags(rendered);
    const imageLayouts = images.map((image) =>
      resolveImageLayout(image, options.maxWidth, onImageResolved),
    );

    // 空节点（多根文档的中心点）给一个圆形尺寸，而不是一条空白文本行
    if (!text.trim() && !code && !imageLayouts.length) {
      const size = Math.round(padding * 2 + 8);
      const emptyMetrics: NodeMetrics = {
        html: `<div class="mvs-node-text"></div>`,
        text: "",
        lines: [],
        codeLines: [],
        images: [],
        width: size,
        height: size,
      };
      cache.set(key, emptyMetrics);
      return emptyMetrics;
    }

    const wrapped = wrapRuns(runs, options.maxWidth, measureRun);
    // 只有图片没有文字时不要保留一条空行，否则白白多出一行高度
    const lines = text.trim() ? wrapped.lines : [];
    // 逐段用各自的字体测量完之后，再留一点余量避免文字贴边
    let contentWidth = text.trim() ? wrapped.width * 1.02 : 0;
    let contentHeight = lines.length * lineHeightPx;

    // 图片排在文本下方，按文档顺序依次堆叠
    let imageHtml = "";
    if (imageLayouts.length) {
      imageHtml = imageLayouts
        .map(
          (image) =>
            `<img class="mvs-node-image" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}" draggable="false" />`,
        )
        .join("");
      contentHeight += imageLayouts.reduce(
        (sum, image) => sum + IMAGE_GAP + image.height,
        0,
      );
      contentWidth = Math.max(
        contentWidth,
        ...imageLayouts.map((image) => image.width),
      );
    }

    let codeHtml = "";
    let codeLines: string[] = [];
    if (code) {
      codeLines = code.split("\n");
      let codeWidth = 0;
      for (const line of codeLines) {
        codeWidth = Math.max(codeWidth, codeMeasure(line));
      }
      // <pre> 是 flex 子项会被拉伸到容器宽度，所以这里只按最长的一行决定节点要多宽
      contentWidth = Math.max(contentWidth, codeWidth);
      contentHeight +=
        CODE_GAP + codeLines.length * options.fontSize * CODE_FONT_RATIO * CODE_LINE_HEIGHT;
      codeHtml = `<pre class="mvs-node-code"><code>${escapeHtml(code)}</code></pre>`;
    }

    contentWidth = Math.min(contentWidth, options.maxWidth);

    const metrics: NodeMetrics = {
      html: `<div class="mvs-node-text">${rendered}</div>${imageHtml}${codeHtml}`,
      text,
      lines,
      codeLines,
      images: imageLayouts,
      width: Math.round(contentWidth + padding * 2),
      height: Math.round(contentHeight + padding * 2),
    };
    cache.set(key, metrics);
    return metrics;
  };
}
