import type { NodeImage, TextRun } from "../types";
import { md, type RenderEnv } from "./markdown";
import { isWideChar } from "./utils";

/**
 * 把行内 Markdown 拆成带样式的文本片段。
 *
 * 屏幕上节点文本走 foreignObject + HTML，可以随便用 `<strong>` / `<em>`；
 * 但导出的 SVG 必须避开 foreignObject（Chrome 会在把含 foreignObject 的
 * SVG 画进 canvas 时污染画布，导致 PNG 导出失败），
 * 因此导出时改用原生 `<text>` + `<tspan>`，需要的样式信息就来自这里。
 */
export function parseInlineRuns(source: string, env?: RenderEnv): TextRun[] {
  return parseInlineContent(source, env).runs;
}

/**
 * 解析节点内容，把「行内文本片段」和「图片」分开返回。
 *
 * 图片不走文本流：它是要按 maxWidth 等比缩放的块级元素，
 * 高度由图片自身比例决定，塞进按行高排版的文本流里会把行高算错。
 * 所以图片单独提出来，和文本行、代码块一样当作块级内容排布。
 */
export function parseInlineContent(
  source: string,
  env?: RenderEnv,
): { runs: TextRun[]; images: NodeImage[] } {
  const runs: TextRun[] = [];
  const images: NodeImage[] = [];
  const text = source ?? "";
  if (!text) return { runs, images };

  const inline = md.parseInline(text, env ?? {})[0];
  const tokens = inline?.children ?? [];

  let bold = 0;
  let italic = 0;
  let href: string | undefined;

  const push = (value: string, forceCode = false) => {
    if (!value) return;
    runs.push({
      text: value,
      bold: bold > 0 || undefined,
      italic: italic > 0 || undefined,
      code: forceCode || undefined,
      href,
    });
  };

  for (const token of tokens) {
    switch (token.type) {
      case "strong_open":
        bold += 1;
        break;
      case "strong_close":
        bold = Math.max(0, bold - 1);
        break;
      case "em_open":
        italic += 1;
        break;
      case "em_close":
        italic = Math.max(0, italic - 1);
        break;
      case "code_inline":
        push(token.content, true);
        break;
      case "text":
        push(token.content);
        break;
      case "softbreak":
      case "hardbreak":
        push(" ");
        break;
      case "link_open": {
        const value = token.attrGet("href");
        href = value === null || value === undefined ? undefined : String(value);
        break;
      }
      case "link_close":
        href = undefined;
        break;
      case "image": {
        const src = token.attrGet("src");
        if (src) {
          images.push({ src: String(src), alt: imageAlt(token) });
        }
        break;
      }
      default:
        break;
    }
  }

  return { runs: mergeRuns(runs), images };
}

/**
 * 取图片的 alt 文本。
 * markdown-it v15 把 alt 放在子 token 流里，老版本放在 `content`，
 * `attrGet("alt")` 则可能因为属性名差异取不到 —— 三处都兜一下。
 */
function imageAlt(token: {
  attrGet: (name: string) => unknown;
  children?: Array<{ content: string }> | null;
  content?: string;
}): string {
  const attr = token.attrGet("alt");
  if (attr !== null && attr !== undefined && String(attr)) return String(attr);
  if (token.children?.length) {
    return token.children.map((child) => child.content).join("");
  }
  return token.content ?? "";
}

/** 合并相邻且样式相同的片段，减少导出的 tspan 数量 */
function mergeRuns(runs: TextRun[]): TextRun[] {
  const merged: TextRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (
      last &&
      !!last.bold === !!run.bold &&
      !!last.italic === !!run.italic &&
      !!last.code === !!run.code &&
      last.href === run.href
    ) {
      last.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

/** 纯文本拼接，用于和测量结果对齐 */
export function runsToText(runs: TextRun[]): string {
  return runs.map((run) => run.text).join("");
}

/** 带样式的单个字符 */
interface StyledUnit {
  char: string;
  run: TextRun;
}

function toUnits(runs: TextRun[]): StyledUnit[] {
  const units: StyledUnit[] = [];
  for (const run of runs) {
    for (const char of run.text) units.push({ char, run });
  }
  return units;
}

function sameStyle(a: TextRun, b: TextRun): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.code === !!b.code
  );
}

/** 一段连续同样式的字符的宽度 */
function unitsWidth(
  units: StyledUnit[],
  measure: (text: string, run: TextRun) => number,
): number {
  let width = 0;
  let index = 0;
  while (index < units.length) {
    const run = units[index].run;
    let text = "";
    while (index < units.length && sameStyle(units[index].run, run)) {
      text += units[index].char;
      index += 1;
    }
    width += measure(text, run);
  }
  return width;
}

/** 切成断行单元：全角字符与空白各自成 token，拉丁单词整体成 token */
function toTokens(units: StyledUnit[]): StyledUnit[][] {
  const tokens: StyledUnit[][] = [];
  let current: StyledUnit[] = [];

  const flush = () => {
    if (current.length) {
      tokens.push(current);
      current = [];
    }
  };

  for (const unit of units) {
    if (isWideChar(unit.char) || /\s/.test(unit.char)) {
      flush();
      tokens.push([unit]);
    } else {
      current.push(unit);
    }
  }
  flush();
  return tokens;
}

/**
 * 按最大宽度换行，**逐段用各自的字体测量**。
 *
 * 这一点很关键：加粗字比常规字宽、行内代码是 monospace 还带左右内边距，
 * 如果按纯文本量一遍，节点框会系统性偏窄，浏览器实际排版时就会多折一行、
 * 文字顶出框外。
 *
 * 返回的 `lines[i]` 是第 i 行的纯文本，`width` 是最宽一行的宽度。
 */
export function wrapRuns(
  runs: TextRun[],
  maxWidth: number,
  measure: (text: string, run: TextRun) => number,
): { lines: string[]; width: number } {
  const tokens = toTokens(toUnits(runs));
  const lines: StyledUnit[][] = [];
  let line: StyledUnit[] = [];

  const isBlank = (token: StyledUnit[]) =>
    token.every((unit) => /\s/.test(unit.char));

  const pushLine = () => {
    while (line.length && /\s/.test(line[line.length - 1].char)) line.pop();
    lines.push(line);
    line = [];
  };

  for (const token of tokens) {
    if (!line.length) {
      if (isBlank(token)) continue;
      line = [...token];
      continue;
    }
    const candidate = [...line, ...token];
    if (unitsWidth(candidate, measure) > maxWidth) {
      pushLine();
      line = isBlank(token) ? [] : [...token];
    } else {
      line = candidate;
    }
  }
  pushLine();

  const text = lines.map((units) =>
    units.map((unit) => unit.char).join(""),
  );
  let width = 0;
  for (const units of lines) {
    width = Math.max(width, unitsWidth(units, measure));
  }
  return { lines: text.length ? text : [""], width };
}

/**
 * 把「按纯文本切好的行」映射回带样式的片段。
 *
 * 换行是在纯文本上算出来的（见 measure.ts），断行时会丢掉行首行尾的空白，
 * 所以这里用双指针对齐：遇到行里没有的空白就跳过，保证切分结果和换行完全一致。
 */
export function splitRunsByLines(
  runs: TextRun[],
  lines: string[],
  plainText: string,
): TextRun[][] {
  const result: TextRun[][] = [];
  let cursor = 0;

  for (const line of lines) {
    if (!line) {
      result.push([]);
      continue;
    }
    const start = cursor;
    let matched = 0;
    while (matched < line.length && cursor < plainText.length) {
      if (plainText[cursor] === line[matched]) {
        matched += 1;
        cursor += 1;
      } else if (/\s/.test(plainText[cursor])) {
        cursor += 1;
      } else {
        break;
      }
    }
    result.push(sliceRuns(runs, start, cursor));
  }

  return result;
}

/** 取 [from, to) 区间内的片段，并去掉首尾空白 */
function sliceRuns(runs: TextRun[], from: number, to: number): TextRun[] {
  const slices: TextRun[] = [];
  let offset = 0;

  for (const run of runs) {
    const runStart = offset;
    const runEnd = offset + run.text.length;
    offset = runEnd;
    if (runEnd <= from || runStart >= to) continue;

    const sliceStart = Math.max(from, runStart) - runStart;
    const sliceEnd = Math.min(to, runEnd) - runStart;
    const text = run.text.slice(sliceStart, sliceEnd);
    if (text) slices.push({ ...run, text });
  }

  if (slices.length) {
    slices[0] = { ...slices[0], text: slices[0].text.replace(/^\s+/, "") };
    const last = slices.length - 1;
    slices[last] = { ...slices[last], text: slices[last].text.replace(/\s+$/, "") };
  }
  return slices.filter((slice) => slice.text);
}
