import { describe, expect, it, vi } from "vitest";
import {
  applyColor,
  applyFontSize,
  insertDetail,
  insertLink,
  insertPanel,
  insertRuby,
  insertToc,
  setAlign,
  setHeading,
  setList,
  setQuote,
  toggleWrapSelection,
} from "../src/core/commands";
import { useEditorHistory } from "../src/composables/useEditorHistory";
import type { TextState } from "../src/types";

const state = (value: string, selectionStart: number, selectionEnd = selectionStart): TextState => ({
  value,
  selectionStart,
  selectionEnd,
});

describe("行内命令", () => {
  it("包裹选区并选中内部文本", () => {
    const result = toggleWrapSelection(state("abc", 1, 2), "**");
    expect(result.value).toBe("a**b**c");
    expect(result.selectionStart).toBe(3);
    expect(result.selectionEnd).toBe(4);
  });

  it("再次点击时去掉标记", () => {
    const result = toggleWrapSelection(state("a**b**c", 3, 4), "**");
    expect(result.value).toBe("abc");
    expect(result.selectionStart).toBe(1);
    expect(result.selectionEnd).toBe(2);
  });

  it("斜体不会拆掉粗体标记", () => {
    const result = toggleWrapSelection(state("**文字**", 2, 4), "*");
    expect(result.value).toBe("***文字***");
  });

  it("没有选区时插入占位文本并选中", () => {
    const result = toggleWrapSelection(state("ab", 1), "^", "^", "上标");
    expect(result.value).toBe("a^上标^b");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("上标");
  });

  it("字号 / 颜色 / 注音 / 链接", () => {
    expect(applyFontSize(state("文字", 0, 2), 20).value).toBe("!20 文字!");
    expect(applyColor(state("文字", 0, 2), "#f00").value).toBe("!!#f00 文字!!");
    expect(applyColor(state("文字", 0, 2), "#ff0", true).value).toBe("!!!#ff0 文字!!!");
    expect(insertRuby(state("汉", 1), "hàn").value).toBe("汉{文字|hàn}");
    expect(insertLink(state("", 0), "https://example.com", "示例").value).toBe(
      "[示例](https://example.com)",
    );
  });
});

describe("段落命令", () => {
  it("标题可切换", () => {
    const first = setHeading(state("你好\n世界", 0, 5), 2);
    expect(first.value).toBe("## 你好\n## 世界");
    const second = setHeading(first, 2);
    expect(second.value).toBe("你好\n世界");
  });

  it("标题级别互斥", () => {
    const result = setHeading(state("# 旧标题", 4), 2);
    expect(result.value).toBe("## 旧标题");
  });

  it("引用与列表", () => {
    expect(setQuote(state("引用", 2)).value).toBe("> 引用");
    expect(setList(state("a\nb", 0, 3), "ul").value).toBe("- a\n- b");
    expect(setList(state("a\nb", 0, 3), "ol").value).toBe("1. a\n2. b");
    expect(setList(state("a", 1), "checklist").value).toBe("- [ ] a");
  });

  it("对齐块", () => {
    const result = setAlign(state("居中", 0, 2), "center");
    expect(result.value).toBe("::: center\n居中\n:::");
  });

  it("手风琴与面板", () => {
    expect(insertDetail(state("正文", 0, 2)).value).toBe("+++ 点击查看详情\n正文\n+++");
    expect(insertPanel(state("正文", 0, 2), "warning").value).toBe(
      "::: warning 警告\n正文\n:::",
    );
  });

  it("块级语法插在行中间时会补齐前后换行", () => {
    const detail = insertDetail(state("abcdef", 3, 3));
    expect(detail.value).toBe("abc\n\n+++ 点击查看详情\n内容\n+++\ndef");

    const panel = insertPanel(state("abcdef", 3, 3), "tips");
    expect(panel.value).toBe("abc\n\n::: tips 提示\n内容\n:::\ndef");
  });

  it("目录插入到行首", () => {
    expect(insertToc(state("正文", 2)).value).toBe("正文\n\n[TOC]\n\n");
  });
});

describe("撤销历史", () => {
  it("连续输入合并为一次撤销", () => {
    vi.useFakeTimers();
    let current: TextState = state("a", 1);
    const history = useEditorHistory({
      getState: () => current,
      applyState: (next) => {
        current = { ...next };
      },
    });

    current = state("ab", 2);
    history.recordInput(2, 2);
    vi.advanceTimersByTime(500);

    current = state("abc", 3);
    history.recordInput(3, 3);
    vi.advanceTimersByTime(500);

    history.undo();
    expect(current.value).toBe("ab");
    history.undo();
    expect(current.value).toBe("a");
    history.redo();
    expect(current.value).toBe("ab");

    vi.useRealTimers();
  });
});
