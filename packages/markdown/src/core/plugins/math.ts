import type { MarkdownIt, StateBlock, StateInline } from "markdown-it";
import katex from "katex";

/** 渲染公式；语法错误时 KaTeX 会输出红色错误文本而不是抛异常 */
function renderMath(source: string, displayMode: boolean): string {
  return katex.renderToString(source, {
    displayMode,
    throwOnError: false,
    strict: false,
    output: "html",
  });
}

/**
 * 行内公式 `$...$`
 *
 * 规则与常见实现一致：开头 `$` 后不能是空白，结尾 `$` 前不能是空白，
 * 且内容不能跨行，尽量避免把货币写法误判成公式。
 */
function mathInline(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const start = state.pos;
  if (src[start] !== "$" || src[start + 1] === "$") {
    return false;
  }
  const contentStart = start + 1;
  if (contentStart >= state.posMax || /\s/.test(src[contentStart])) {
    return false;
  }

  let close = src.indexOf("$", contentStart);
  while (close !== -1 && close < state.posMax) {
    if (src[close - 1] === "\\") {
      close = src.indexOf("$", close + 1);
      continue;
    }
    if (close > contentStart && !/\s/.test(src[close - 1])) {
      break;
    }
    close = src.indexOf("$", close + 1);
  }
  if (close === -1 || close >= state.posMax) {
    return false;
  }

  const content = src.slice(contentStart, close);
  if (!content || content.includes("\n")) {
    return false;
  }

  if (!silent) {
    const token = state.push("md_math_inline", "", 0);
    token.content = renderMath(content, false);
  }
  state.pos = close + 1;
  return true;
}

/**
 * 块级公式
 *
 *   $$
 *   E = mc^2
 *   $$
 *
 * 也支持单行 $$E = mc^2$$。
 */
function mathBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const firstLine = state.src.slice(start, max).trim();
  if (!firstLine.startsWith("$$")) {
    return false;
  }

  let content = "";
  let nextLine = startLine + 1;

  // 单行形式：$$...$$
  if (firstLine.length > 4 && firstLine.endsWith("$$")) {
    content = firstLine.slice(2, -2).trim();
  } else {
    const rest = firstLine.slice(2).trim();
    const parts: string[] = rest ? [rest] : [];
    let closed = rest.endsWith("$$");
    if (closed) {
      parts[0] = rest.slice(0, -2).trim();
      parts.length = 1;
    }
    while (!closed && nextLine < endLine) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const lineEnd = state.eMarks[nextLine];
      const line = state.src.slice(lineStart, lineEnd);
      if (line.trim() === "$$") {
        closed = true;
        nextLine += 1;
        break;
      }
      parts.push(line);
      nextLine += 1;
    }
    if (!closed) {
      return false;
    }
    content = parts.join("\n").trim();
  }

  if (silent) {
    return true;
  }
  if (!content) {
    return false;
  }

  const token = state.push("md_math_block", "", 0);
  token.block = true;
  token.map = [startLine, nextLine];
  token.content = renderMath(content, true);
  state.line = nextLine;
  return true;
}

export function addMath(md: MarkdownIt): void {
  md.inline.ruler.before("emphasis", "md_math_inline", mathInline);
  md.block.ruler.before("fence", "md_math_block", mathBlock, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
}
