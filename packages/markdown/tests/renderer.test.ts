import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/core/renderer";

describe("基础 markdown", () => {
  it("标题、粗体、链接、表格", () => {
    const html = renderMarkdown("# 标题\n\n**粗体** [链接](https://example.com)\n\n| A | B |\n| - | - |\n| 1 | 2 |");
    expect(html).toContain("<h1");
    expect(html).toContain("<strong>粗体</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("target=\"_blank\"");
    expect(html).toContain("<table>");
  });

  it("单换行默认渲染为 br", () => {
    expect(renderMarkdown("第一行\n第二行")).toContain("<br>");
  });

  it("emoji 短代码", () => {
    expect(renderMarkdown(":smile:")).toContain("😄");
  });

  it("脚注", () => {
    const html = renderMarkdown("正文[^1]\n\n[^1]: 脚注内容");
    expect(html).toContain("footnote");
    expect(html).toContain("脚注内容");
  });
});

describe("扩展语法", () => {
  it("上下标、下划线、高亮", () => {
    const html = renderMarkdown("^^下标^^ ^上标^ ++下划线++ ==高亮==");
    expect(html).toContain("<sub>下标</sub>");
    expect(html).toContain("<sup>上标</sup>");
    expect(html).toContain("<u>下划线</u>");
    expect(html).toContain('<mark class="md-mark">高亮</mark>');
  });

  it("注音", () => {
    expect(renderMarkdown("{汉字|hàn zì}")).toContain("<ruby>汉字<rp>(</rp><rt>hàn zì</rt>");
  });

  it("字号与颜色", () => {
    const html = renderMarkdown("!20 大字! !!red 红字!! !!!#ff0 黄底!!!");
    expect(html).toContain('style="font-size:20px;line-height:1.2"');
    expect(html).toContain('style="color:red"');
    expect(html).toContain('style="background-color:#ff0"');
  });

  it("手风琴", () => {
    const html = renderMarkdown("+++ 标题\n内容\n+++");
    expect(html).toContain("<details class=\"md-detail\">");
    expect(html).toContain("md-detail__summary");
    expect(html).toContain("内容");
  });

  it("信息面板与对齐", () => {
    const html = renderMarkdown("::: warning 注意\n内容\n:::\n\n::: center\n居中\n:::");
    expect(html).toContain("md-panel--warning");
    expect(html).toContain("md-align--center");
  });

  it("任务清单", () => {
    const html = renderMarkdown("- [ ] 待办\n- [x] 完成");
    expect(html).toContain('class="md-task-list"');
    expect(html).toContain("md-task-checkbox");
    expect(html).toContain("checked");
  });

  it("行内公式与块级公式", () => {
    const inline = renderMarkdown("$E=mc^2$");
    expect(inline).toContain("katex");
    const block = renderMarkdown("$$\nE=mc^2\n$$");
    expect(block).toContain("md-math-block");
    expect(block).toContain("katex-display");
  });
});

describe("目录", () => {
  it("收集标题并生成锚点导航", () => {
    const html = renderMarkdown("[TOC]\n\n# 一级\n\n## 二级\n\n### 三级");
    expect(html).toContain("md-toc");
    expect(html).toContain('href="#md-heading-一级"');
    expect(html).toContain('id="md-heading-一级"');
    expect(html).toContain("md-toc__item--h2");
    // 折叠按钮不能被 HTML 白名单过滤掉
    expect(html).toContain("md-toc__toggle");
    expect(html).toContain("md-toc__collapsed");
  });

  it("重复标题自动加后缀", () => {
    const html = renderMarkdown("# 重复\n\n# 重复");
    expect(html).toContain('id="md-heading-重复"');
    expect(html).toContain('id="md-heading-重复-2"');
  });

  it("auto 模式没有 [TOC] 也会自动生成", () => {
    const html = renderMarkdown("# 标题\n\n## 小节", { tocMode: "auto" });
    expect(html).toContain('class="md-toc"');
    expect(html).toContain('href="#md-heading-标题"');
  });

  it("auto 模式遇到已有 [TOC] 不会生成两份", () => {
    const html = renderMarkdown("[TOC]\n\n# 标题", { tocMode: "auto" });
    expect((html.match(/<nav class="md-toc"/g) ?? []).length).toBe(1);
  });

  it("默认 marker 模式不会自动生成", () => {
    expect(renderMarkdown("# 标题")).not.toContain("md-toc");
  });
});

describe("B 站播放器", () => {
  it("独立的 B 站链接渲染为 iframe", () => {
    const html = renderMarkdown("[视频](https://www.bilibili.com/video/BV1xx411c7mD)");
    expect(html).toContain("player.bilibili.com");
    expect(html).toContain("bvid=BV1xx411c7mD");
    expect(html).toContain("<iframe");
  });

  it("混排在文字中的链接退化为行内播放器", () => {
    const html = renderMarkdown("看这个 https://www.bilibili.com/video/BV1xx411c7mD 视频");
    expect(html).toContain("md-bilibili--inline");
  });

  it("非视频链接保持普通链接", () => {
    const html = renderMarkdown("[B 站首页](https://www.bilibili.com/)");
    expect(html).not.toContain("<iframe");
  });
});

describe("HTML 白名单", () => {
  it("脚本与事件属性被清除", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });

  it("白名单标签保留", () => {
    expect(renderMarkdown("<u>原始下划线</u>")).toContain("<u>原始下划线</u>");
  });
});
