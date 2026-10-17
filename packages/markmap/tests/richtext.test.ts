import { describe, expect, it } from "vitest";
import {
  parseInlineContent,
  parseInlineRuns,
  runsToText,
  splitRunsByLines,
} from "../src/core/richtext";
import { renderInline } from "../src/core/markdown";
import { wrapText } from "../src/core/measure";

/** 测试里用固定字宽的朴素测量，保证换行结果可预期 */
function fixedWidth(charsPerUnit: Record<string, number>, fallback = 10) {
  return (text: string) => {
    let width = 0;
    for (const char of text) width += charsPerUnit[char] ?? fallback;
    return width;
  };
}

describe("parseInlineRuns", () => {
  it("拆出加粗 / 斜体 / 行内代码片段", () => {
    const runs = parseInlineRuns("普通 **加粗** 与 *斜体* 与 `代码`");
    expect(runs.map((run) => [run.text, run.bold ?? false, run.italic ?? false, run.code ?? false]))
      .toEqual([
        ["普通 ", false, false, false],
        ["加粗", true, false, false],
        [" 与 ", false, false, false],
        ["斜体", false, true, false],
        [" 与 ", false, false, false],
        ["代码", false, false, true],
      ]);
  });

  it("链接带 href，并保留原始文本", () => {
    const runs = parseInlineRuns("见 [文档](https://example.com) 说明");
    const link = runs.find((run) => run.href);
    // 外链接的跳转图标跟在文本后面
    expect(link?.text).toBe("文档↗");
    expect(link?.href).toBe("https://example.com");
  });

  it("相邻同样式的片段会被合并成一个 tspan", () => {
    // 两个相邻链接：样式标记成对出现，但片段样式相同，应当合并
    const runs = parseInlineRuns("[a](https://x.test)[b](https://x.test)");
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe("a↗b↗");
    expect(runs[0].href).toBe("https://x.test");
  });
});

describe("链接跳转图标", () => {
  it("外链接（http / https 开头）图标在文本后", () => {
    expect(runsToText(parseInlineRuns("[站](https://a.test)"))).toBe("站↗");
    expect(runsToText(parseInlineRuns("[站](http://a.test)"))).toBe("站↗");
  });

  it("内链接（锚点 / 相对路径 / mailto）图标在文本前", () => {
    expect(runsToText(parseInlineRuns("[锚点](#section)"))).toBe("→锚点");
    expect(runsToText(parseInlineRuns("[相对](./docs/a.md)"))).toBe("→相对");
    expect(runsToText(parseInlineRuns("[邮件](mailto:a@b.test)"))).toBe("→邮件");
  });

  it("图标算在文本宽度里，不参与 href 标注", () => {
    const runs = parseInlineRuns("[a](https://x.test) 尾巴");
    // "↗" 紧跟链接文本，后面的普通文本不带图标
    expect(runs.map((run) => [run.text, run.href ?? null])).toEqual([
      ["a↗", "https://x.test"],
      [" 尾巴", null],
    ]);
  });

  it("可通过 linkIcons 覆盖，传空串可关掉", () => {
    const custom = parseInlineRuns("[a](https://x.test) [b](#x)", {
      linkIcons: { internal: "«", external: "»" },
    });
    expect(runsToText(custom)).toBe("a» «b");

    const off = parseInlineRuns("[a](https://x.test) [b](#x)", {
      linkIcons: { internal: "", external: "" },
    });
    expect(runsToText(off)).toBe("a b");
  });
});

describe("图片", () => {
  it("图片从文本流里提出来，alt 不作为普通文本", () => {
    const { runs, images } = parseInlineContent("看这个 ![示意图](a.png) 很好");
    expect(images).toEqual([{ src: "a.png", alt: "示意图" }]);
    expect(runsToText(runs)).toBe("看这个  很好");
  });

  it("多张图片保持文档顺序", () => {
    const { images } = parseInlineContent("![一](1.png)![二](2.png)");
    expect(images.map((image) => image.src)).toEqual(["1.png", "2.png"]);
  });

  it("SVG data URL 图片不被 markdown-it 的协议白名单拦掉", () => {
    // markdown-it 默认只放行 gif/png/jpeg/webp 的 data URL，
    // 但 SVG 是思维导图里最常用的图片格式
    const svg = "data:image/svg+xml;base64,PHN2Zy8+";
    const { images } = parseInlineContent(`![图标](${svg})`);
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe(svg);
  });

  it("javascript: 之类的危险协议仍然被拦掉", () => {
    const { images } = parseInlineContent("![x](javascript:alert(1))");
    expect(images).toEqual([]);
  });

  it("omitImages 时文本里不出现 img 标签", () => {
    const html = renderInline("文字 ![图](a.png)", { omitImages: true });
    expect(html).not.toContain("<img");
    expect(html).toContain("文字");
  });
});

describe("parseInlineRuns - 其它", () => {
  it("纯文本原样返回，空串返回空数组", () => {
    expect(parseInlineRuns("没有样式")).toEqual([{ text: "没有样式" }]);
    expect(parseInlineRuns("")).toEqual([]);
  });

  it("转义后的原始 HTML 作为普通文本处理，不会被当成标签执行", () => {
    const runs = parseInlineRuns("按住 <kbd>Alt</kbd> 键");
    expect(runsToText(runs)).toBe("按住 <kbd>Alt</kbd> 键");
    expect(runs.every((run) => !run.bold && !run.italic && !run.code)).toBe(true);
  });
});

describe("splitRunsByLines", () => {
  it("按换行结果把片段切到每一行，样式不丢", () => {
    const runs = parseInlineRuns("**加粗部分**普通部分");
    const plain = runsToText(runs);
    const lines = ["加粗部分普", "通部分"];

    const styled = splitRunsByLines(runs, lines, plain);
    expect(styled.map((line) => line.map((run) => run.text))).toEqual([
      ["加粗部分", "普"],
      ["通部分"],
    ]);
    expect(styled[0][0].bold).toBe(true);
    expect(styled[0][1].bold).toBeUndefined();
  });

  it("换行丢弃的空白不会错位", () => {
    const runs = parseInlineRuns("alpha beta gamma");
    const plain = runsToText(runs);
    const lines = wrapText(plain, 60, fixedWidth({}, 10));

    const styled = splitRunsByLines(runs, lines, plain);
    expect(styled.map((line) => line.map((run) => run.text).join("")).join(" ")).toBe(
      lines.join(" "),
    );
  });

  it("行数与片段数不一致时也不会抛错", () => {
    const runs = parseInlineRuns("abc");
    expect(() => splitRunsByLines(runs, ["", "abc"], "abc")).not.toThrow();
  });
});
