import { describe, expect, it } from "vitest";
import {
  findNode,
  findNodePath,
  flattenTree,
  parseMarkdown,
} from "../src/core/parser";

/** 把树压成 "内容@depth" 形式，方便断言结构 */
function outline(md: string): string[] {
  return flattenTree(parseMarkdown(md).root).map(
    (node) => `${node.content}@${node.depth}`,
  );
}

describe("parseMarkdown - 标题", () => {
  it("把 # ~ ###### 解析成层级树", () => {
    const md = [
      "# 一级",
      "## 二级",
      "### 三级",
      "## 二级 B",
      "# 一级 B",
    ].join("\n");

    expect(outline(md)).toEqual([
      "@0",
      "一级@1",
      "二级@2",
      "三级@3",
      "二级 B@2",
      "一级 B@1",
    ]);
  });

  it("跨级标题按真实树深度计算 depth", () => {
    // ### 直接跟在 # 后面，缺失的 ## 不占位，depth 为 2 而不是 3
    expect(outline("# A\n# B\n### C")).toEqual(["@0", "A@1", "B@1", "C@2"]);
  });

  it("全文只有一棵顶层子树时提升为根节点", () => {
    expect(outline("# A\n### C")).toEqual(["A@0", "C@1"]);
  });
});

describe("parseMarkdown - 列表", () => {
  it("解析无序列表嵌套", () => {
    const md = ["# 根", "- a", "  - a1", "    - a11", "- b"].join("\n");
    expect(outline(md)).toEqual([
      "根@0",
      "a@1",
      "a1@2",
      "a11@3",
      "b@1",
    ]);
  });

  it("解析有序列表与 * / + 标记", () => {
    const md = ["# 根", "1. 第一", "2. 第二", "* 星号", "+ 加号"].join("\n");
    const result = parseMarkdown(md);

    expect(result.root.children.map((n) => n.content)).toEqual([
      "第一",
      "第二",
      "星号",
      "加号",
    ]);
    expect(result.root.children.map((n) => n.payload?.ordered)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("标题与列表混排时列表挂在最近的标题下", () => {
    // 两个顶层标题，不存在单根提升，因此保留 depth 0 的空根
    const md = ["# A", "- a1", "## B", "1. b1", "- b2", "# C"].join("\n");
    expect(outline(md)).toEqual([
      "@0",
      "A@1",
      "a1@2",
      "B@2",
      "b1@3",
      "b2@3",
      "C@1",
    ]);
  });

  it("识别任务列表勾选状态并剥离标记", () => {
    const md = ["# 根", "- [ ] 未完成", "- [x] 已完成"].join("\n");
    const result = parseMarkdown(md);
    const [todo, done] = result.root.children;

    expect(todo.content).toBe("未完成");
    expect(todo.payload?.checked).toBe(false);
    expect(done.content).toBe("已完成");
    expect(done.payload?.checked).toBe(true);
  });

  it("更深嵌套项之后的同级项仍挂在同一父节点下", () => {
    // 回归用例：回溯条件曾经拿「树深度」和「Markdown 目标层级」比较，
    // 而 ## 标题在树里是 depth 1、目标层级却是 2，两者错位会让 A2 挂到 A11 下、
    // B 挂到 A 下
    // 单个顶层标题会被提升为根，所以整体 depth 比 Markdown 层级小 1
    const md = ["## 布局", "- A", "  - A1", "    - A11", "  - A2", "- B"].join("\n");
    expect(outline(md)).toEqual([
      "布局@0",
      "A@1",
      "A1@2",
      "A11@3",
      "A2@2", // 与 A1 同级，而不是挂到 A11 下
      "B@1", // 与 A 同级，而不是挂到 A 下
    ]);
  });

  it("三级标题下的嵌套列表同样正确回溯", () => {
    const md = ["# 根", "### 深标题", "- A", "  - A1", "- B"].join("\n");
    expect(outline(md)).toEqual(["根@0", "深标题@1", "A@2", "A1@3", "B@2"]);
  });

  it("列表项内的第二个段落成为该项的子节点", () => {
    const md = ["# 根", "- 项目", "", "  补充说明"].join("\n");
    expect(outline(md)).toEqual(["根@0", "项目@1", "补充说明@2"]);
  });
});

describe("parseMarkdown - 内容与元信息", () => {
  it("保留原始 Markdown 文本作为 content", () => {
    const md = "# 根\n- **加粗** 与 `代码` 与 [链接](https://example.com)";
    const result = parseMarkdown(md);
    expect(result.root.children[0].content).toBe(
      "**加粗** 与 `代码` 与 [链接](https://example.com)",
    );
  });

  it("识别 <!-- markmap: fold --> 并设置 fold", () => {
    const result = parseMarkdown("# 根\n- 折叠我 <!-- markmap: fold -->\n- 正常");
    expect(result.root.children[0].fold).toBe(true);
    expect(result.root.children[0].content).toBe("折叠我");
    expect(result.root.children[1].fold).toBeUndefined();
  });

  it("把代码块挂到相邻节点上", () => {
    const md = ["# 根", "代码节点", "", "```js", "const a = 1;", "```"].join("\n");
    const result = parseMarkdown(md);
    const node = flattenTree(result.root).find((n) => n.content === "代码节点");
    expect(node?.payload?.lines).toBe("const a = 1;");
  });

  it("全文只有一个顶层节点时提升为根", () => {
    const result = parseMarkdown("# 唯一标题\n- 子项");
    expect(result.root.content).toBe("唯一标题");
    expect(result.root.children.map((n) => n.content)).toEqual(["子项"]);
  });

  it("剪掉没有内容的空叶子节点", () => {
    const result = parseMarkdown("# 根\n- \n- 有效");
    expect(flattenTree(result.root).map((n) => n.content)).toEqual(["根", "有效"]);
  });

  it("空字符串返回只有根的空树", () => {
    const result = parseMarkdown("");
    expect(result.root.children).toEqual([]);
    expect(result.root.depth).toBe(0);
  });
});

describe("parseMarkdown - front-matter 与 id", () => {
  it("解析顶层 front-matter 配置项", () => {
    const md = ["---", "colorFreezeLevel: 2", "maxWidth: 240", "---", "# 根"].join("\n");
    const result = parseMarkdown(md);

    expect(result.options.colorFreezeLevel).toBe(2);
    expect(result.options.maxWidth).toBe(240);
    expect(result.root.content).toBe("根");
  });

  it("解析 markmap: 嵌套写法与行内数组", () => {
    const md = [
      "---",
      "markmap:",
      "  roughness: 3",
      "  fillStyle: zigzag",
      "color: ['#111111', '#222222']",
      "---",
      "# 根",
    ].join("\n");
    const result = parseMarkdown(md);

    expect(result.options.roughness).toBe(3);
    expect(result.options.fillStyle).toBe("zigzag");
    expect(result.options.color).toEqual(["#111111", "#222222"]);
  });

  it("忽略无法识别的 front-matter 键", () => {
    const result = parseMarkdown("---\ntitle: 文档\n---\n# 根");
    expect(result.frontmatter.title).toBe("文档");
    expect(result.options).not.toHaveProperty("title");
  });

  it("同一段 Markdown 反复解析得到相同 id", () => {
    const md = "# A\n- a\n- a\n## B";
    const first = flattenTree(parseMarkdown(md).root).map((n) => n.id);
    const second = flattenTree(parseMarkdown(md).root).map((n) => n.id);

    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });
});

describe("树查询工具", () => {
  it("findNode 按 id 找到节点", () => {
    const result = parseMarkdown("# A\n- a\n- b");
    const target = result.root.children[1];
    expect(findNode(result.root, target.id)?.content).toBe("b");
    expect(findNode(result.root, "不存在")).toBeUndefined();
  });

  it("findNodePath 返回根到节点的路径", () => {
    const result = parseMarkdown("# A\n- a\n  - a1");
    const target = result.root.children[0].children[0];
    expect(findNodePath(result.root, target.id).map((n) => n.content)).toEqual([
      "A",
      "a",
      "a1",
    ]);
    expect(findNodePath(result.root, "不存在")).toEqual([]);
  });
});
