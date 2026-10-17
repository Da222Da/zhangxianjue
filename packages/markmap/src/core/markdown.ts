import MarkdownIt, { type Env, type Token } from "markdown-it";
import type { LinkIcons } from "../types";

/** 内 / 外链接的跳转图标 */
export const DEFAULT_LINK_ICONS: LinkIcons = {
  internal: "→",
  external: "↗",
};

/** 渲染时可以带上的环境参数 */
export interface RenderEnv extends Env {
  /** 链接图标；传空字符串可以关掉 */
  linkIcons?: Partial<LinkIcons>;
  /**
   * 渲染文本时丢掉 `<img>`。
   * 图片在节点里是块级元素（要按 maxWidth 等比缩放，会和行高打架），
   * 由 measure.ts 单独生成 `<img>` 标签，文本流里不能再出现一份。
   */
  omitImages?: boolean;
}

/**
 * 是否外链接。按需求定义：以 http / https 开头即为外链接，其余都算内链接
 * （含 `#锚点`、相对路径、`mailto:` 等）。
 *
 * 参数放宽到 unknown：markdown-it v15 的 `attrGet` 返回 `string | number | null`。
 */
export function isExternalHref(href: unknown): boolean {
  return /^https?:\/\//i.test(href === null || href === undefined ? "" : String(href));
}

/**
 * 全库共用的 markdown-it 实例。
 *
 * `html: false` 是刻意的安全选择：节点文本最终通过 `innerHTML` 注入
 * foreignObject，关闭内联 HTML 后原始标签会被转义，避免 XSS。
 * 链接协议由 markdown-it 内置的 validateLink 过滤（javascript: 等会被丢弃）。
 */
const md = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: false,
  typographer: false,
});

/**
 * 把跳转图标作为**文本 token** 插进链接内部。
 *
 * 为什么要在 token 流里插字符，而不是用 CSS `::before` / `::after` 画图标：
 * 图标会占宽度，而节点框的尺寸来自 measure.ts 的文本测量、导出时的行切分来自
 * richtext.ts 的 token 遍历。三处都读同一份 token 流才能保证宽度、换行、
 * 导出文本完全一致；纯 CSS 方案会让节点框比实际内容窄，图标也会在导出的
 * SVG 里凭空消失（导出用的是原生 `<text>`，不认伪元素）。
 */
function insertLinkIcons(
  children: Token[],
  icons: LinkIcons,
  // markdown-it 的 Token 是 `export type`，只能从 state 上取构造函数
  TokenCtor: typeof Token,
): void {
  const pairs: Array<{ open: number; close: number }> = [];
  const stack: number[] = [];

  children.forEach((token, index) => {
    if (token.type === "link_open") {
      stack.push(index);
    } else if (token.type === "link_close" && stack.length) {
      pairs.push({ open: stack.pop() as number, close: index });
    }
  });

  // 倒序处理：插入 token 会让后面的下标失效
  for (const { open, close } of pairs.reverse()) {
    const external = isExternalHref(children[open].attrGet("href"));
    const icon = external ? icons.external : icons.internal;
    if (!icon) continue;

    const token = new TokenCtor("text", "", 0);
    token.content = icon;
    // 外链接图标放文本后面，内链接放前面
    children.splice(external ? close : open + 1, 0, token);
  }
}

md.core.ruler.push("mvs_link_icon", (state) => {
  const env = (state.env ?? {}) as RenderEnv;
  const icons: LinkIcons = { ...DEFAULT_LINK_ICONS, ...env.linkIcons };

  for (const token of state.tokens) {
    if (token.type !== "inline" || !token.children) continue;
    insertLinkIcons(token.children, icons, state.Token);
  }
  return true;
});

/**
 * 放开 `data:image/svg+xml`。
 *
 * markdown-it 默认的 validateLink 出于安全考虑拦掉所有 `data:` 协议，
 * 只放行 gif / png / jpeg / webp —— SVG 因为「可能带脚本」被排除在外。
 * 但 SVG 恰恰是思维导图里最常用的图片格式（图标、示意图、手绘稿）。
 *
 * 这里放行是安全的：图片最终渲染成 `<img src="...">`，
 * 而 `<img>` 里的 SVG 处于沙箱上下文，脚本不会执行、外部资源也不会加载。
 * 链接仍然走原有的白名单，不受影响。
 */
const baseValidateLink = md.validateLink.bind(md);
md.validateLink = (url: string): boolean =>
  baseValidateLink(url) || /^data:image\/svg\+xml[;,]/i.test(url.trim());

// 图片按块级单独渲染，文本流里默认省略
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  if ((env as RenderEnv | undefined)?.omitImages) return "";
  return self.renderToken(tokens, idx, options);
};

// 外链接在新标签页打开并加 rel 防护；内链接保持原地跳转
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const href = tokens[idx].attrGet("href");
  if (isExternalHref(href)) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }
  tokens[idx].attrSet(
    "class",
    isExternalHref(href) ? "mvs-link mvs-link--external" : "mvs-link mvs-link--internal",
  );
  return self.renderToken(tokens, idx, options);
};

/** 把行内 Markdown 渲染成 HTML 片段（加粗 / 斜体 / 行内代码 / 链接 / 图片） */
export function renderInline(source: string, env?: RenderEnv): string {
  return md.renderInline(source ?? "", env ?? {});
}

export { md };
