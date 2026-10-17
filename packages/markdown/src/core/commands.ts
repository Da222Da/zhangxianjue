import type { AlignType, PanelType, TextResult, TextState } from "../types";

/**
 * 纯文本编辑命令
 *
 * 所有函数都是纯函数：输入当前文本与选区，返回新文本与选区。
 * 这样工具栏、快捷键、测试可以共用同一套逻辑，不依赖 DOM。
 */

function clampSelection(value: string, start: number, end: number): TextResult {
  const max = value.length;
  const selectionStart = Math.min(Math.max(0, start), max);
  const selectionEnd = Math.min(Math.max(selectionStart, end), max);
  return { value, selectionStart, selectionEnd };
}

/** 当前选区所在行的范围（不含行尾换行） */
function lineRange(value: string, start: number, end: number): [number, number] {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  // 选区结束在行首时，不要把下一行算进来
  const effectiveEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const nextBreak = value.indexOf("\n", effectiveEnd);
  return [lineStart, nextBreak === -1 ? value.length : nextBreak];
}

/** 在块级内容前补空行，保证它从行首开始 */
function padBlockBefore(value: string, start: number): string {
  const before = value.slice(0, start);
  if (before.length === 0) {
    return "";
  }
  if (before.endsWith("\n\n")) {
    return "";
  }
  return before.endsWith("\n") ? "\n" : "\n\n";
}

/** 块级内容后面还有同一行的文字时，补一个换行，避免结束标记被粘连 */
function padBlockAfter(value: string, end: number): string {
  const after = value.slice(end);
  if (after.length === 0 || after.startsWith("\n")) {
    return "";
  }
  return "\n";
}

/** 用标记包裹选区；没有选区时插入占位文本并选中它 */
export function wrapSelection(
  state: TextState,
  before: string,
  after = before,
  placeholder = "",
): TextResult {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const selected = value.slice(start, end);
  const inner = selected || placeholder;
  const next = value.slice(0, start) + before + inner + after + value.slice(end);
  const innerStart = start + before.length;
  return clampSelection(next, innerStart, innerStart + inner.length);
}

/** 切换包裹：已包裹时去掉标记，否则加上 */
export function toggleWrapSelection(
  state: TextState,
  before: string,
  after = before,
  placeholder = "",
): TextResult {
  const { value, selectionStart: start, selectionEnd: end } = state;
  if (start === end) {
    return wrapSelection(state, before, after, placeholder);
  }

  // 标记在选区外侧。注意 `*` 可能是 `**` 的一部分：选中 **粗体** 里的文字再点斜体，
  // 不应该把粗体拆成斜体，因此要确认标记外侧没有同字符。
  const outerStart = Math.max(0, start - before.length);
  const outerEnd = end + after.length;
  const outerBefore = value.slice(outerStart, start);
  const outerAfter = value.slice(end, outerEnd);
  const isLongerBefore = before.length === 1 && outerStart > 0 && value[outerStart - 1] === before;
  const isLongerAfter = after.length === 1 && outerEnd < value.length && value[outerEnd] === after;
  if (outerBefore === before && outerAfter === after && !isLongerBefore && !isLongerAfter) {
    const next = value.slice(0, outerStart) + value.slice(start, end) + value.slice(outerEnd);
    return clampSelection(next, outerStart, end - before.length);
  }

  // 选区本身包含标记
  const selected = value.slice(start, end);
  if (selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
    const inner = selected.slice(before.length, selected.length - after.length);
    const next = value.slice(0, start) + inner + value.slice(end);
    return clampSelection(next, start, start + inner.length);
  }

  return wrapSelection(state, before, after, placeholder);
}

interface LinePrefixOptions {
  /** 判断行是否已经有目标前缀 */
  target: RegExp;
  /** 添加前缀前先清掉的同类前缀（如其它级别标题） */
  remove?: RegExp;
  /** 新前缀；函数形式用于有序列表 */
  prefix: string | ((index: number) => string);
}

/**
 * 给选区覆盖的每一行加 / 去前缀
 *
 * 非空行全部已有目标前缀 → 视为「再点一次取消」，去掉前缀；
 * 否则先清掉同类前缀再统一加上。
 */
export function toggleLinePrefix(state: TextState, options: LinePrefixOptions): TextResult {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const [lineStart, lineEnd] = lineRange(value, start, end);
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const nonEmpty = lines.filter((line) => line.trim() !== "");
  const allTarget = nonEmpty.length > 0 && nonEmpty.every((line) => options.target.test(line));

  let counter = 0;
  const nextLines = lines.map((line) => {
    if (line.trim() === "") {
      return line;
    }
    if (allTarget) {
      return line.replace(options.target, "");
    }
    const cleaned = options.remove ? line.replace(options.remove, "") : line;
    const prefix = typeof options.prefix === "function" ? options.prefix(counter) : options.prefix;
    counter += 1;
    return `${prefix}${cleaned}`;
  });

  const nextBlock = nextLines.join("\n");
  const next = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);

  if (start === end) {
    // 无选区：光标放到第一行末尾
    const cursor = lineStart + nextLines[0].length;
    return clampSelection(next, cursor, cursor);
  }
  return clampSelection(next, lineStart, lineStart + nextBlock.length);
}

/** 标题：1–5 级（工具栏 header 子菜单的范围） */
export function setHeading(state: TextState, level: number): TextResult {
  const safeLevel = Math.min(5, Math.max(1, Math.trunc(level)));
  return toggleLinePrefix(state, {
    target: new RegExp(`^#{${safeLevel}}\\s+`),
    remove: /^#{1,6}\s+/,
    prefix: `${"#".repeat(safeLevel)} `,
  });
}

export function setQuote(state: TextState): TextResult {
  return toggleLinePrefix(state, {
    target: /^>\s?/,
    remove: /^>\s?/,
    prefix: "> ",
  });
}

/** 列表：无序 / 有序 / 任务清单 */
export function setList(state: TextState, kind: "ul" | "ol" | "checklist"): TextResult {
  const remove = /^(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/;
  if (kind === "ol") {
    return toggleLinePrefix(state, {
      target: /^\d+\.\s+/,
      remove,
      prefix: (index) => `${index + 1}. `,
    });
  }
  if (kind === "checklist") {
    return toggleLinePrefix(state, {
      target: /^[-*+]\s+\[[ xX]\]\s+/,
      remove,
      prefix: "- [ ] ",
    });
  }
  return toggleLinePrefix(state, {
    target: /^[-*+]\s+(?!\[[ xX]\])/,
    remove,
    prefix: "- ",
  });
}

/** 对齐：用 ::: left|center|right 包住选区 */
export function setAlign(state: TextState, align: AlignType): TextResult {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const [lineStart, lineEnd] = lineRange(value, start, end);
  const block = value.slice(lineStart, lineEnd) || "内容";
  const lead = padBlockBefore(value, lineStart);
  const wrapped = `::: ${align}\n${block}\n:::`;
  const next = value.slice(0, lineStart) + lead + wrapped + value.slice(lineEnd);
  const bodyStart = lineStart + lead.length + `::: ${align}\n`.length;
  return clampSelection(next, bodyStart, bodyStart + block.length);
}

/** 在光标处插入文本，光标落在插入内容之后 */
export function insertText(state: TextState, text: string): TextResult {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const next = value.slice(0, start) + text + value.slice(end);
  const pos = start + text.length;
  return clampSelection(next, pos, pos);
}

/** 插入链接 */
export function insertLink(state: TextState, url: string, label?: string): TextResult {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const selected = value.slice(start, end).trim();
  const text = (label ?? selected ?? "").replace(/]/g, "\\]") || url;
  return insertText(state, `[${text}](${url.trim()})`);
}

/** 插入图片 */
export function insertImage(state: TextState, url: string, alt = "图片"): TextResult {
  return insertText(state, `![${alt.replace(/]/g, "\\]")}](${url.trim()})`);
}

/** 插入注音：{文字|拼音} */
export function insertRuby(state: TextState, pinyin: string): TextResult {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const selected = value.slice(start, end) || "文字";
  const note = pinyin.trim() || "拼音";
  const text = `{${selected}|${note}}`;
  const next = value.slice(0, start) + text + value.slice(end);
  const textStart = start + 1;
  return clampSelection(next, textStart, textStart + selected.length);
}

/** 字号：!20 文字! */
export function applyFontSize(state: TextState, size: number): TextResult {
  const safeSize = Math.min(72, Math.max(8, Math.round(size)));
  return wrapSelection(state, `!${safeSize} `, "!", "文字");
}

/** 颜色：!!#f00 文字!! / !!!#f00 文字!!! */
export function applyColor(state: TextState, color: string, background = false): TextResult {
  const marker = background ? "!!!" : "!!";
  return wrapSelection(state, `${marker}${color} `, marker, "文字");
}

/** 插入手风琴 */
export function insertDetail(state: TextState): TextResult {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const selected = value.slice(start, end);
  const body = selected || "内容";
  const lead = padBlockBefore(value, start);
  const tail = padBlockAfter(value, end);
  const text = `+++ 点击查看详情\n${body}\n+++`;
  const next = value.slice(0, start) + lead + text + tail + value.slice(end);
  const bodyStart = start + lead.length + "+++ 点击查看详情\n".length;
  return clampSelection(next, bodyStart, bodyStart + body.length);
}

const PANEL_LABELS: Record<PanelType, string> = {
  tips: "提示",
  info: "信息",
  warning: "警告",
  danger: "危险",
  success: "成功",
};

/** 插入信息面板 */
export function insertPanel(state: TextState, type: PanelType): TextResult {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const selected = value.slice(start, end);
  const body = selected || "内容";
  const lead = padBlockBefore(value, start);
  const tail = padBlockAfter(value, end);
  const opening = `::: ${type} ${PANEL_LABELS[type]}`;
  const text = `${opening}\n${body}\n:::`;
  const next = value.slice(0, start) + lead + text + tail + value.slice(end);
  const bodyStart = start + lead.length + opening.length + 1;
  return clampSelection(next, bodyStart, bodyStart + body.length);
}

/** 插入代码块；有选区时把选区包进代码块 */
export function insertCodeBlock(state: TextState, language = ""): TextResult {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const selected = value.slice(start, end);
  const lead = padBlockBefore(value, start);
  const tail = padBlockAfter(value, end);
  if (selected) {
    const opening = `\`\`\`${language}\n`;
    const text = `${opening}${selected}\n\`\`\``;
    const next = value.slice(0, start) + lead + text + tail + value.slice(end);
    const bodyStart = start + lead.length + opening.length;
    return clampSelection(next, bodyStart, bodyStart + selected.length);
  }
  const opening = `\`\`\`${language}\n`;
  const text = `${opening}\n\`\`\``;
  const next = value.slice(0, start) + lead + text + tail + value.slice(end);
  const cursor = start + lead.length + opening.length;
  return clampSelection(next, cursor, cursor);
}

/** 插入目录标记 */
export function insertToc(state: TextState): TextResult {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const lead = padBlockBefore(value, start);
  const text = "[TOC]\n\n";
  const next = value.slice(0, start) + lead + text + value.slice(end);
  const cursor = start + lead.length + text.length;
  return clampSelection(next, cursor, cursor);
}

/** 水平分割线 */
export function insertHr(state: TextState): TextResult {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const lead = padBlockBefore(value, start);
  const text = "---\n\n";
  const next = value.slice(0, start) + lead + text + value.slice(end);
  const cursor = start + lead.length + text.length;
  return clampSelection(next, cursor, cursor);
}

/** 硬换行 */
export function insertBr(state: TextState): TextResult {
  return insertText(state, "<br>");
}
