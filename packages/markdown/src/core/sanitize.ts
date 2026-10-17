import DOMPurify from "dompurify";

/**
 * 渲染结果的标签白名单
 *
 * 这里同时覆盖两类内容：
 *   1. markdown-it 生成的常规标签；
 *   2. 扩展语法 / 插件生成的标签（details、ruby、iframe、KaTeX 的 span 等）。
 *
 * ⚠️ 白名单只决定「保留什么」，不负责脚本防护 —— 事件属性、javascript: 协议
 *    由 DOMPurify 自己拦。iframe 只允许出现在最终 HTML 里，且 src 由插件用
 *    正则校验过的 BV/av 号拼出来，原始 HTML 里的 iframe 也会被 DOMPurify
 *    按 URI 规则检查。
 */
const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "button",
  "caption",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "iframe",
  "img",
  "input",
  "kbd",
  "li",
  "mark",
  "nav",
  "ol",
  "p",
  "pre",
  "rp",
  "rt",
  "ruby",
  "s",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

const ALLOWED_ATTR = [
  "align",
  "allowfullscreen",
  "alt",
  "aria-hidden",
  "aria-label",
  "checked",
  "class",
  "colspan",
  "disabled",
  "frameborder",
  "framespacing",
  "height",
  "href",
  "id",
  "loading",
  "open",
  "rel",
  "role",
  "rowspan",
  "scrolling",
  "src",
  "start",
  "style",
  "target",
  "title",
  "type",
  "width",
];

/**
 * 清洗最终 HTML
 *
 * 挂在整篇渲染结果上，而不是逐个 html_inline token —— 单个 `<u>` 标签
 * 被 DOMPurify 当成未闭合片段会补成 `<u></u>`，把行内原始 HTML 拆坏。
 *
 * 没有 window 的环境（SSR / 纯 Node）直接转义：宁可显示源码，也不放行未清洗的 HTML。
 */
export function sanitizeOutputHtml(html: string): string {
  if (typeof window === "undefined") {
    return escapeHtml(html);
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // data-* / aria-* 不允许用户伪造；aria-hidden 是 KaTeX 需要的，已显式列出
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}

/** 转义文本节点 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 转义 HTML 属性值 */
export function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/`/g, "&#96;");
}
