import type { MarkdownIt, StateInline, Token } from "markdown-it";
import { escapeAttr, escapeHtml } from "../sanitize";

/**
 * 把一段内联 markdown 渲染成 HTML
 *
 * 扩展语法内部允许再写粗体、链接等（例如 `==**重点**==`），
 * 因此不直接转义，而是递归走一遍 inline parser。
 */
function renderInline(state: StateInline, source: string): string {
  const tokens: Token[] = [];
  state.md.inline.parse(source, state.md, state.env, tokens);
  return state.md.renderer.render(tokens, state.md.options, state.env);
}

interface MarkerRule {
  name: string;
  marker: string;
  /** 额外守卫：返回 false 表示当前位置不归本规则处理 */
  guard?: (src: string, start: number) => boolean;
  render: (inner: string, state: StateInline) => string;
}

/**
 * 注册一对相同标记包裹的行内规则
 *
 * 之所以不用 markdown-it 的 emphasis 机制，是因为这些标记（`^^`、`==`、`++`）
 * 不在 CommonMark 里，直接用字符串边界匹配更可控。
 */
function addMarkerRule(md: MarkdownIt, rule: MarkerRule): void {
  md.inline.ruler.before("emphasis", rule.name, (state: StateInline, silent: boolean): boolean => {
    const start = state.pos;
    const src = state.src;
    const max = state.posMax;

    if (start + rule.marker.length > max) {
      return false;
    }
    if (!src.startsWith(rule.marker, start)) {
      return false;
    }
    if (start > 0 && src[start - 1] === "\\") {
      return false;
    }
    if (rule.guard && !rule.guard(src, start)) {
      return false;
    }

    const contentStart = start + rule.marker.length;
    let close = src.indexOf(rule.marker, contentStart);
    while (close !== -1 && close < max && src[close - 1] === "\\") {
      close = src.indexOf(rule.marker, close + rule.marker.length);
    }
    if (close === -1 || close >= max) {
      return false;
    }

    const inner = src.slice(contentStart, close);
    if (!inner || inner.includes("\n") || inner.trim() === "") {
      return false;
    }
    // 标记紧贴空白时按普通文本处理，避免 `a ^ b ^ c` 这类写法误判
    if (inner.startsWith(" ") || inner.endsWith(" ")) {
      return false;
    }

    if (!silent) {
      const token = state.push("md_html", "", 0);
      token.content = rule.render(inner, state);
    }
    state.pos = close + rule.marker.length;
    return true;
  });
}

/** 匹配一个颜色值：十六进制或 CSS 颜色名 */
const COLOR_PATTERN = "(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})";

const RUBY_RE = /^\{([^{}\n|]{1,60})\|([^{}\n|]{1,60})\}/;
const BG_COLOR_RE = new RegExp(`^!!!${COLOR_PATTERN}[ \\t]+([^!\\n]+?)!!!`);
const FONT_COLOR_RE = new RegExp(`^!!${COLOR_PATTERN}[ \\t]+([^!\\n]+?)!!`);
const FONT_SIZE_RE = /^!(\d{1,2})[ \t]+([^!\n]+?)!/;

export function addInlineFormatting(md: MarkdownIt): void {
  // 上下标：Cherry 风格的 ^上标^ 与 ^^下标^^
  addMarkerRule(md, {
    name: "md_sub",
    marker: "^^",
    render: (inner, state) => `<sub>${renderInline(state, inner)}</sub>`,
  });
  addMarkerRule(md, {
    name: "md_sup",
    marker: "^",
    guard: (src, start) => src[start + 1] !== "^",
    render: (inner, state) => `<sup>${renderInline(state, inner)}</sup>`,
  });

  // 下划线：++文字++
  addMarkerRule(md, {
    name: "md_underline",
    marker: "++",
    render: (inner, state) => `<u>${renderInline(state, inner)}</u>`,
  });

  // 高亮：==文字==
  addMarkerRule(md, {
    name: "md_highlight",
    marker: "==",
    render: (inner, state) => `<mark class="md-mark">${renderInline(state, inner)}</mark>`,
  });

  // 注音：{文字|拼音}
  md.inline.ruler.before("emphasis", "md_ruby", (state: StateInline, silent: boolean): boolean => {
    const rest = state.src.slice(state.pos, state.posMax);
    const match = RUBY_RE.exec(rest);
    if (!match) {
      return false;
    }
    if (!silent) {
      const token = state.push("md_html", "", 0);
      const text = renderInline(state, match[1]);
      token.content = `<ruby>${text}<rp>(</rp><rt>${escapeHtml(match[2])}</rt><rp>)</rp></ruby>`;
    }
    state.pos += match[0].length;
    return true;
  });

  // 背景色：!!!#ff0 文字!!!
  // 必须比前景色先注册：`!!!...!!!` 否则会被 `!!...!!` 抢先匹配
  md.inline.ruler.before("emphasis", "md_bg_color", (state: StateInline, silent: boolean): boolean => {
    const match = BG_COLOR_RE.exec(state.src.slice(state.pos, state.posMax));
    if (!match) {
      return false;
    }
    if (!silent) {
      const token = state.push("md_html", "", 0);
      token.content = `<span style="background-color:${escapeAttr(match[1])}">${renderInline(state, match[2])}</span>`;
    }
    state.pos += match[0].length;
    return true;
  });

  // 前景色：!!#f00 文字!!
  md.inline.ruler.before("emphasis", "md_font_color", (state: StateInline, silent: boolean): boolean => {
    const rest = state.src.slice(state.pos, state.posMax);
    const match = FONT_COLOR_RE.exec(rest);
    if (!match) {
      return false;
    }
    // 三连感叹号交给背景色规则处理
    if (rest.startsWith("!!!")) {
      return false;
    }
    if (!silent) {
      const token = state.push("md_html", "", 0);
      token.content = `<span style="color:${escapeAttr(match[1])}">${renderInline(state, match[2])}</span>`;
    }
    state.pos += match[0].length;
    return true;
  });

  // 字号：!20 文字!（单位 px）
  md.inline.ruler.before("emphasis", "md_font_size", (state: StateInline, silent: boolean): boolean => {
    const match = FONT_SIZE_RE.exec(state.src.slice(state.pos, state.posMax));
    if (!match) {
      return false;
    }
    const size = Number(match[1]);
    if (!Number.isFinite(size) || size < 8 || size > 72) {
      return false;
    }
    if (!silent) {
      const token = state.push("md_html", "", 0);
      token.content = `<span style="font-size:${size}px;line-height:1.2">${renderInline(state, match[2])}</span>`;
    }
    state.pos += match[0].length;
    return true;
  });
}
