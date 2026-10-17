import { afterEach, describe, expect, it } from "vitest";
import { createApp, nextTick, type App } from "vue";
import Markdown from "../src/components/Markdown.vue";
import type { MarkdownMode, MarkdownProps } from "../src/types";

const mounted: Array<{ app: App; root: HTMLElement }> = [];

/** 在 jsdom 里挂载组件，返回容器与卸载函数 */
function mount(mode: MarkdownMode = "editOnly", modelValue = "", extra: Partial<MarkdownProps> = {}) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const updates: string[] = [];
  const app = createApp(Markdown, {
    mode,
    modelValue,
    ...extra,
    "onUpdate:modelValue": (value: string) => updates.push(value),
  });
  app.mount(root);
  mounted.push({ app, root });
  return { root, updates, app };
}

afterEach(() => {
  while (mounted.length > 0) {
    const item = mounted.pop();
    item?.app.unmount();
    item?.root.remove();
  }
});

const button = (root: HTMLElement, label: string): HTMLButtonElement => {
  const element = root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!element) {
    throw new Error(`button not found: ${label}`);
  }
  return element;
};

describe("Markdown 组件", () => {
  it("工具栏命令写回 textarea 并触发 v-model", async () => {
    const { root, updates } = mount("editOnly", "hello");
    const textarea = root.querySelector("textarea");
    if (!textarea) {
      throw new Error("textarea not found");
    }

    textarea.setSelectionRange(0, 5);
    button(root, "加粗").click();
    await nextTick();

    expect(textarea.value).toBe("**hello**");
    expect(updates[updates.length - 1]).toBe("**hello**");
    expect(textarea.selectionStart).toBe(2);
    expect(textarea.selectionEnd).toBe(7);
  });

  it("工具栏命令后继续输入，撤销顺序正确", async () => {
    const { root } = mount("editOnly", "hello");
    const textarea = root.querySelector("textarea");
    if (!textarea) {
      throw new Error("textarea not found");
    }

    textarea.setSelectionRange(0, 5);
    button(root, "加粗").click();
    await nextTick();
    expect(textarea.value).toBe("**hello**");

    // 模拟用户继续输入：input 事件会进入历史
    textarea.value = "**hello**!";
    textarea.setSelectionRange(10, 10);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();

    button(root, "撤销").click();
    await nextTick();
    expect(textarea.value).toBe("**hello**");

    button(root, "撤销").click();
    await nextTick();
    expect(textarea.value).toBe("hello");
  });

  it("撤销按钮恢复上一步", async () => {
    const { root } = mount("editOnly", "hello");
    const textarea = root.querySelector("textarea");
    if (!textarea) {
      throw new Error("textarea not found");
    }

    textarea.setSelectionRange(0, 5);
    button(root, "加粗").click();
    await nextTick();
    expect(textarea.value).toBe("**hello**");

    button(root, "撤销").click();
    await nextTick();
    expect(textarea.value).toBe("hello");
  });

  it("标题 / 列表 / 引用命令", async () => {
    const { root } = mount("editOnly", "你好\n世界");
    const textarea = root.querySelector("textarea");
    if (!textarea) {
      throw new Error("textarea not found");
    }

    textarea.setSelectionRange(0, 5);
    button(root, "二级标题").click();
    await nextTick();
    expect(textarea.value).toBe("## 你好\n## 世界");

    textarea.setSelectionRange(0, textarea.value.length);
    button(root, "无序列表").click();
    await nextTick();
    expect(textarea.value).toBe("- ## 你好\n- ## 世界");
  });

  it("二级菜单（标题级别）可展开并执行", async () => {
    const { root } = mount("editOnly", "hello");
    const textarea = root.querySelector("textarea");
    if (!textarea) {
      throw new Error("textarea not found");
    }

    textarea.setSelectionRange(0, 5);
    button(root, "标题级别").click();
    await nextTick();

    const item = Array.from(root.querySelectorAll<HTMLButtonElement>(".md-toolbar__menu-item")).find(
      (element) => element.textContent?.includes("四级标题"),
    );
    expect(item).toBeTruthy();
    item?.click();
    await nextTick();
    expect(textarea.value).toBe("#### hello");
  });

  it("tocMode=auto 时没有 [TOC] 也生成目录", async () => {
    const { root } = mount("previewOnly", "# 标题\n\n## 小节", { tocMode: "auto" });
    await nextTick();
    expect(root.querySelector(".md-toc")).toBeTruthy();
    expect(root.querySelector(".md-toc__toggle")).toBeTruthy();
  });

  it("目录可收起 / 展开", async () => {
    const { root } = mount("previewOnly", "[TOC]\n\n# 标题\n\n## 小节");
    await nextTick();

    const preview = root.querySelector(".md-preview");
    expect(preview?.classList.contains("is-toc-collapsed")).toBe(false);

    const toggle = root.querySelector<HTMLButtonElement>(".md-toc__toggle");
    expect(toggle).toBeTruthy();
    toggle?.click();
    await nextTick();
    expect(preview?.classList.contains("is-toc-collapsed")).toBe(true);

    const collapsed = root.querySelector<HTMLButtonElement>(".md-toc__collapsed");
    expect(collapsed).toBeTruthy();
    collapsed?.click();
    await nextTick();
    expect(preview?.classList.contains("is-toc-collapsed")).toBe(false);
  });

  it("脚注悬浮显示提示框", async () => {
    const { root } = mount("previewOnly", "正文[^1]\n\n[^1]: 脚注别名1");
    await nextTick();

    const anchor = root.querySelector<HTMLAnchorElement>(".footnote-ref a");
    expect(anchor).toBeTruthy();
    anchor?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await nextTick();

    const tip = document.querySelector<HTMLElement>(".md-footnote-tip");
    expect(tip).toBeTruthy();
    expect(tip?.textContent).toContain("脚注别名1");
    expect(tip?.textContent).not.toContain("↩");

    anchor?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    await nextTick();
    expect(document.querySelector(".md-footnote-tip")).toBeNull();
  });

  it("previewOnly 渲染扩展语法", async () => {
    const { root } = mount("previewOnly", "# 标题\n\n==高亮== 与 ^上标^");
    await nextTick();
    const preview = root.querySelector(".md-preview");
    expect(preview?.querySelector("h1")?.textContent).toBe("标题");
    expect(preview?.innerHTML).toContain("<mark");
    expect(preview?.innerHTML).toContain("<sup>上标</sup>");
    expect(root.querySelector("textarea")).toBeNull();
  });
});
