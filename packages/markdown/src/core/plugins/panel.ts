import type { MarkdownIt, StateBlock } from "markdown-it";
import { escapeHtml } from "../sanitize";
import type { PanelType } from "../../types";

type PanelKind = PanelType | "left" | "center" | "right";

interface PanelMeta {
  type: PanelKind;
  title: string;
}

/** `tips` 与 Cherry 的 `tip` 都接受，统一成 CSS 类名用的 tip */
const PANEL_TYPES: Record<string, PanelKind> = {
  tip: "tips",
  tips: "tips",
  info: "info",
  warning: "warning",
  danger: "danger",
  success: "success",
  left: "left",
  center: "center",
  right: "right",
};

const PANEL_LABELS: Record<PanelType, string> = {
  tips: "提示",
  info: "信息",
  warning: "警告",
  danger: "危险",
  success: "成功",
};

/**
 * 信息面板 / 对齐块
 *
 *   ::: tips 标题
 *   内容
 *   :::
 *
 * `::: left|center|right` 用作段落对齐，不渲染标题。
 */
function panelRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const firstLine = state.src.slice(start, max);
  const match = /^:::[ \t]*([a-zA-Z]+)[ \t]*(.*)$/.exec(firstLine);
  if (!match) {
    return false;
  }
  const type = PANEL_TYPES[match[1].toLowerCase()];
  if (!type) {
    return false;
  }

  let nextLine = startLine + 1;
  let closed = false;
  for (; nextLine < endLine; nextLine += 1) {
    const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const lineEnd = state.eMarks[nextLine];
    if (state.src.slice(lineStart, lineEnd).trim() === ":::") {
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

  const token = state.push("md_panel", "", 0);
  token.block = true;
  token.map = [startLine, nextLine + 1];
  token.meta = { type, title: match[2].trim() } satisfies PanelMeta;
  token.content = state.getLines(startLine + 1, nextLine, state.blkIndent, false).trim();
  state.line = nextLine + 1;
  return true;
}

export function addPanel(md: MarkdownIt): void {
  md.block.ruler.before("fence", "md_panel", panelRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });

  md.renderer.rules.md_panel = (tokens, idx) => {
    const token = tokens[idx];
    const meta = token.meta as unknown as PanelMeta;
    const body = token.content ? md.render(token.content, {}) : "";

    if (meta.type === "left" || meta.type === "center" || meta.type === "right") {
      return `<div class="md-align md-align--${meta.type}">\n${body}</div>\n`;
    }

    const type = meta.type as PanelType;
    const title = meta.title || PANEL_LABELS[type];
    return `<div class="md-panel md-panel--${type}">\n<p class="md-panel__title">${escapeHtml(title)}</p>\n<div class="md-panel__body">\n${body}</div>\n</div>\n`;
  };
}
