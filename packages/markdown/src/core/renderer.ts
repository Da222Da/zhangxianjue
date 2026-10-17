import MarkdownIt from "markdown-it";
import type { MarkdownIt as MarkdownItInstance } from "markdown-it";
import { full as emojiPlugin } from "markdown-it-emoji";
import footnotePlugin from "markdown-it-footnote";
import { sanitizeOutputHtml } from "./sanitize";
import { addInlineFormatting } from "./plugins/inline-formatting";
import { addMath } from "./plugins/math";
import { addDetail } from "./plugins/detail";
import { addPanel } from "./plugins/panel";
import { addToc } from "./plugins/toc";
import { addTaskList } from "./plugins/task-list";
import { addBilibili } from "./plugins/bilibili";
import type { RenderOptions } from "../types";

export type { RenderOptions } from "../types";

/**
 * 创建配置好的 markdown-it 实例
 *
 * 每次调用都会新建实例（插件不共享状态）；`renderMarkdown` 会按选项缓存，
 * 避免预览区每次输入都重新装配插件。
 */
export function createMarkdownRenderer(options: RenderOptions = {}): MarkdownItInstance {
  const md = new MarkdownIt({
    html: true,
    linkify: options.linkify ?? true,
    breaks: options.breaks ?? true,
    typographer: options.typographer ?? false,
  });

  md.use(emojiPlugin);
  md.use(footnotePlugin);

  addMath(md);
  addInlineFormatting(md);
  addDetail(md);
  addPanel(md);
  addTaskList(md);
  addBilibili(md);
  addToc(md);

  // 插件生成的 HTML 走自定义 token；原始 HTML 交给最终整篇清洗
  md.renderer.rules.md_html = (tokens, idx) => tokens[idx].content;

  md.renderer.rules.md_math_inline = (tokens, idx) => tokens[idx].content;
  md.renderer.rules.md_math_block = (tokens, idx) => `<div class="md-math-block">${tokens[idx].content}</div>\n`;

  // 外链统一新开标签页，并阻断 window.opener
  md.renderer.rules.link_open = (tokens, idx, renderOptions, _env, self) => {
    const href = String(tokens[idx].attrGet("href") ?? "");
    if (/^https?:\/\//i.test(href)) {
      tokens[idx].attrSet("target", "_blank");
      tokens[idx].attrSet("rel", "noopener noreferrer");
    }
    return self.renderToken(tokens, idx, renderOptions);
  };

  // 图片懒加载
  md.renderer.rules.image = (tokens, idx, renderOptions, _env, self) => {
    tokens[idx].attrSet("loading", "lazy");
    return self.renderToken(tokens, idx, renderOptions);
  };

  return md;
}

/** 按选项缓存实例：预览区高频调用，避免重复装配插件 */
const rendererCache = new Map<string, MarkdownItInstance>();

function getRenderer(options: RenderOptions): MarkdownItInstance {
  const key = JSON.stringify({
    breaks: options.breaks ?? true,
    linkify: options.linkify ?? true,
    typographer: options.typographer ?? false,
  });
  let md = rendererCache.get(key);
  if (!md) {
    md = createMarkdownRenderer(options);
    rendererCache.set(key, md);
  }
  return md;
}

/**
 * 把 markdown 渲染成 HTML
 *
 * `tocTitle` 只影响 `[TOC]` 的标题文案，不参与实例缓存。
 */
/** 匹配独占一行的 [TOC] 标记 */
const TOC_MARKER_RE = /^[ \t]*\[toc\][ \t]*$/im;

export function renderMarkdown(source: string, options: RenderOptions = {}): string {
  const md = getRenderer(options);
  const tocMode = options.tocMode ?? "marker";

  let markdown = source;
  if (tocMode === "off") {
    markdown = markdown.replace(/^[ \t]*\[toc\][ \t]*$/gim, "");
  } else if (tocMode === "auto" && !TOC_MARKER_RE.test(markdown)) {
    // 自动目录：没有 [TOC] 时补一个到最前面，交给同一个 TOC 插件渲染
    markdown = `[TOC]\n\n${markdown}`;
  }

  const html = md.render(markdown, {
    tocTitle: options.tocTitle ?? "目录",
  });
  return sanitizeOutputHtml(html);
}
