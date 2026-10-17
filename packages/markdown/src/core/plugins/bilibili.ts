import type { MarkdownIt, Token } from "markdown-it";
import { escapeAttr } from "../sanitize";

interface BilibiliInfo {
  bvid?: string;
  aid?: string;
}

type TokenCtor = new (type: string, tag: string, nesting: -1 | 0 | 1) => Token;

/**
 * 识别 B 站视频链接
 *
 * 只接受 bilibili.com/video/BV... 与 av...；b23.tv 短链需要联网解析，
 * 这里保持普通链接，不猜测目标。
 */
function parseBilibili(url: string): BilibiliInfo | null {
  const match = /^https?:\/\/(?:www\.|m\.)?bilibili\.com\/video\/([^/?#]+)/i.exec(url);
  if (!match) {
    return null;
  }
  const videoId = match[1];
  if (/^BV[0-9A-Za-z]+$/.test(videoId)) {
    return { bvid: videoId };
  }
  if (/^av\d+$/i.test(videoId)) {
    return { aid: videoId.slice(2) };
  }
  return null;
}

function buildSrc(info: BilibiliInfo): string {
  return info.bvid
    ? `//player.bilibili.com/player.html?bvid=${encodeURIComponent(info.bvid)}&autoplay=0`
    : `//player.bilibili.com/player.html?aid=${encodeURIComponent(info.aid ?? "")}&autoplay=0`;
}

/**
 * 把单独的 B 站链接提升为块级播放器
 *
 * 段落里只有一条 B 站链接时，替换整个 paragraph 为播放器；
 * 与其它文字混排时退化为行内播放器，避免产生 `<p><div>` 这种非法结构。
 */
function promoteSoleLinks(state: { tokens: Token[]; Token: TokenCtor }): void {
  const { tokens } = state;
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].type !== "paragraph_open") {
      continue;
    }
    const inline = tokens[i + 1];
    const close = tokens[i + 2];
    if (
      !inline ||
      inline.type !== "inline" ||
      !close ||
      close.type !== "paragraph_close" ||
      !inline.children ||
      inline.children.length !== 3
    ) {
      continue;
    }
    const [open, text, linkClose] = inline.children;
    if (open.type !== "link_open" || linkClose.type !== "link_close" || text.type !== "text") {
      continue;
    }
    const info = parseBilibili(String(open.attrGet("href") ?? ""));
    if (!info) {
      continue;
    }
    const token = new state.Token("md_bilibili", "", 0);
    token.block = true;
    token.map = tokens[i].map;
    token.meta = { bvid: info.bvid, aid: info.aid };
    tokens.splice(i, 3, token);
  }
}

/** 处理段落中与文字混排的链接 */
function replaceInlineLinks(tokens: Token[], TokenCtor: TokenCtor): void {
  for (const token of tokens) {
    if (token.type !== "inline" || !token.children) {
      continue;
    }
    const children = token.children;
    for (let i = 0; i < children.length; i += 1) {
      if (children[i].type !== "link_open") {
        continue;
      }
      const info = parseBilibili(String(children[i].attrGet("href") ?? ""));
      if (!info) {
        continue;
      }
      let close = i + 1;
      while (close < children.length && children[close].type !== "link_close") {
        close += 1;
      }
      if (close >= children.length) {
        continue;
      }
      const embed = new TokenCtor("md_bilibili", "", 0);
      embed.meta = { ...info, inline: true };
      children.splice(i, close - i + 1, embed);
      i += 1;
    }
  }
}

export function addBilibili(md: MarkdownIt): void {
  md.core.ruler.push("md_bilibili", (state) => {
    promoteSoleLinks({ tokens: state.tokens, Token: state.Token });
    replaceInlineLinks(state.tokens, state.Token);
  });

  md.renderer.rules.md_bilibili = (tokens, idx) => {
    const token = tokens[idx];
    const info = token.meta as unknown as BilibiliInfo & { inline?: boolean };
    const src = buildSrc(info);
    const frame = `<iframe class="md-bilibili__frame" src="${escapeAttr(src)}" title="B 站视频播放器" scrolling="no" frameborder="no" framespacing="0" allowfullscreen="true" loading="lazy"></iframe>`;
    return info.inline
      ? `<span class="md-bilibili md-bilibili--inline">${frame}</span>`
      : `<div class="md-bilibili">${frame}</div>\n`;
  };
}
