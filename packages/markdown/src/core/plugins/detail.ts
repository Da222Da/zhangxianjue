import type { MarkdownIt, StateBlock } from "markdown-it";

interface DetailMeta {
  open: boolean;
  title: string;
}

/**
 * 手风琴语法
 *
 *   +++ 点击查看详情
 *   内容
 *   +++
 *
 * 首行写成 `+++-` 表示默认展开。
 */
function detailRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const firstLine = state.src.slice(start, max);
  const match = /^\+\+\+(-?)[ \t]*(.*)$/.exec(firstLine);
  if (!match) {
    return false;
  }

  let nextLine = startLine + 1;
  let closed = false;
  for (; nextLine < endLine; nextLine += 1) {
    const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const lineEnd = state.eMarks[nextLine];
    if (state.src.slice(lineStart, lineEnd).trim() === "+++") {
      closed = true;
      break;
    }
  }
  if (!closed) {
    return false;
  }
  if (silent) {
    return true;
  }

  const token = state.push("md_detail", "", 0);
  token.block = true;
  token.map = [startLine, nextLine + 1];
  token.meta = {
    open: match[1] === "-",
    title: match[2].trim() || "点击查看详情",
  } satisfies DetailMeta;
  token.content = state.getLines(startLine + 1, nextLine, state.blkIndent, false).trim();
  state.line = nextLine + 1;
  return true;
}

export function addDetail(md: MarkdownIt): void {
  md.block.ruler.before("fence", "md_detail", detailRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });

  md.renderer.rules.md_detail = (tokens, idx) => {
    const token = tokens[idx];
    const meta = token.meta as unknown as DetailMeta;
    const title = md.renderInline(meta.title, {});
    const body = token.content ? md.render(token.content, {}) : "";
    return `<details class="md-detail"${meta.open ? " open" : ""}>\n<summary class="md-detail__summary">${title}</summary>\n<div class="md-detail__body">\n${body}</div>\n</details>\n`;
  };
}
