import type { MarkdownIt, StateBlock, Token } from "markdown-it";
import { escapeAttr, escapeHtml } from "../sanitize";
import { uniqueHeadingId } from "../slug";
import type { HeadingInfo, MarkdownEnv } from "../../types";

interface TocNode {
  heading: HeadingInfo;
  children: TocNode[];
}

/**
 * 从 inline token 里提取纯文本
 *
 * TOC 只需要可读文本：文本 / 行内代码 / 自定义 HTML 去标签，公式去掉 KaTeX 标签。
 */
function inlineText(token: Token): string {
  if (!token.children || token.children.length === 0) {
    return token.content;
  }
  return token.children
    .map((child) => {
      if (child.type === "text" || child.type === "code_inline") {
        return child.content;
      }
      if (child.type === "md_html" || child.type === "md_math_inline") {
        return child.content.replace(/<[^>]*>/g, "");
      }
      return "";
    })
    .join("")
    .trim();
}

/** 给标题加唯一锚点，并把标题清单存进 env，供 TOC 渲染 */
function collectHeadings(state: { tokens: Token[]; env: MarkdownEnv }): void {
  const headings: HeadingInfo[] = [];
  const used = new Map<string, number>();
  const { tokens } = state;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type !== "heading_open") {
      continue;
    }
    const inline = tokens[i + 1];
    if (!inline || inline.type !== "inline") {
      continue;
    }
    const text = inlineText(inline);
    const id = uniqueHeadingId(text, used);
    token.attrSet("id", id);
    headings.push({ level: Number(token.tag.slice(1)), id, text });
  }

  state.env.headings = headings;
}

function buildTree(headings: HeadingInfo[]): TocNode[] {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const heading of headings) {
    const node: TocNode = { heading, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].heading.level >= heading.level) {
      stack.pop();
    }
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
    } else {
      root.push(node);
    }
    stack.push(node);
  }
  return root;
}

function renderNodes(nodes: TocNode[]): string {
  const items = nodes
    .map((node) => {
      const level = node.heading.level;
      const children = node.children.length > 0 ? renderNodes(node.children) : "";
      return `<li class="md-toc__item md-toc__item--h${level}"><a class="md-toc__link" href="#${escapeAttr(node.heading.id)}">${escapeHtml(node.heading.text)}</a>${children}</li>`;
    })
    .join("");
  return `<ul class="md-toc__list">${items}</ul>`;
}

function renderToc(headings: HeadingInfo[], title: string): string {
  if (headings.length === 0) {
    return "";
  }
  // 折叠按钮与展开按钮都放在 TOC token 里；展开/收起由预览层的根类控制，
  // 这样 preview 重新渲染（每次输入）时折叠状态不会丢。
  //
  // .md-toc-anchor 在窄容器下高度为 0，仅作为 sticky + absolute 的定位锚点，
  // 让目录浮在正文之上而不挤占内容；宽容器下它本身就是左侧那一列。
  return [
    '<div class="md-toc-anchor">',
    '<nav class="md-toc">',
    '<div class="md-toc__header">',
    '<button type="button" class="md-toc__toggle" aria-label="收起目录" title="收起目录">«</button>',
    `<p class="md-toc__title">${escapeHtml(title)}</p>`,
    "</div>",
    `<div class="md-toc__body">${renderNodes(buildTree(headings))}</div>`,
    "</nav>",
    '<button type="button" class="md-toc__collapsed" aria-label="展开目录" title="展开目录">',
    '<span class="md-toc__collapsed-icon" aria-hidden="true">☰</span>',
    "</button>",
    "</div>",
  ].join("");
}

/**
 * `[TOC]` / `[toc]` 独占一行时插入目录
 */
function tocRule(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (!/^\[toc\]$/i.test(state.src.slice(start, max).trim())) {
    return false;
  }
  if (silent) {
    return true;
  }

  const token = state.push("md_toc", "", 0);
  token.block = true;
  token.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
}

export function addToc(md: MarkdownIt): void {
  md.block.ruler.before("paragraph", "md_toc", tocRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });

  md.core.ruler.push("md_collect_headings", (state) => {
    collectHeadings({
      tokens: state.tokens,
      env: state.env as MarkdownEnv,
    });
  });

  md.renderer.rules.md_toc = (tokens, idx, options, env) => {
    const environment = (env ?? {}) as MarkdownEnv;
    const headings = environment.headings ?? [];
    const title = typeof environment.tocTitle === "string" ? environment.tocTitle : "目录";
    return `${renderToc(headings, title)}\n`;
  };
}
