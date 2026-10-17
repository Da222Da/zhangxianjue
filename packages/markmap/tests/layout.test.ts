import { describe, expect, it } from "vitest";
import { computeLayout, createLinkD, getToggleBadge } from "../src/core/layout";
import { createNodeMeasurer } from "../src/core/measure";
import { resolveOptions } from "../src/core/options";
import { parseMarkdown } from "../src/core/parser";
import type { LayoutResult, MarkmapOptions } from "../src/types";

function layoutOf(markdown: string, options: MarkmapOptions = {}): LayoutResult {
  const resolved = resolveOptions(options);
  const { root } = parseMarkdown(markdown);
  return computeLayout(root, {
    options: resolved,
    measure: createNodeMeasurer(resolved),
  });
}

describe("computeLayout - 基本几何", () => {
  it("每个节点都拿到有限的坐标与正尺寸", () => {
    const result = layoutOf("# A\n- a\n  - a1\n- b");
    expect(result.nodes.length).toBe(4);
    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });

  it("深度轴单调递增：子节点在父节点右侧", () => {
    const result = layoutOf("# A\n- a\n  - a1\n    - a11");
    for (const node of result.nodes) {
      if (!node.parent) continue;
      expect(node.y).toBeGreaterThan(node.parent.y + node.parent.width);
    }
  });

  it("同层兄弟按顺序排列且不重叠", () => {
    const result = layoutOf("# 根\n- 一\n- 二\n- 三");
    const siblings = result.root.children;
    expect(siblings.map((n) => n.data.content)).toEqual(["一", "二", "三"]);
    for (let i = 1; i < siblings.length; i += 1) {
      const previous = siblings[i - 1];
      const current = siblings[i];
      const gap = current.x - previous.x;
      expect(gap).toBeGreaterThanOrEqual(
        (previous.height + current.height) / 2 - 1e-6,
      );
    }
  });

  it("任意两个可见节点在垂直方向都不重叠", () => {
    const result = layoutOf(
      ["# 根", "- a", "  - a1", "  - a2", "- b", "  - b1", "- c"].join("\n"),
    );
    for (let i = 0; i < result.nodes.length; i += 1) {
      for (let j = i + 1; j < result.nodes.length; j += 1) {
        const a = result.nodes[i];
        const b = result.nodes[j];
        // 只有深度轴上有交叠的节点才需要满足垂直不重叠
        const overlapOnDepth = a.y < b.y + b.width && b.y < a.y + a.width;
        if (!overlapOnDepth) continue;
        const distance = Math.abs(a.x - b.x);
        expect(distance).toBeGreaterThanOrEqual(
          (a.height + b.height) / 2 - 1e-6,
        );
      }
    }
  });

  it("长文本按 maxWidth 换行，节点不会无限变宽", () => {
    const long = "这是一段非常长的中文说明文字，用来验证节点宽度会被 maxWidth 截断并换行显示";
    const result = layoutOf(`# 根\n- ${long}`, { maxWidth: 120 });
    const node = result.root.children[0];

    expect(node.width).toBeLessThanOrEqual(120 + 16 + 1);
    expect(node.height).toBeGreaterThan(14 * 1.4);
  });

  it("spacingVertical / spacingHorizontal 生效", () => {
    const tight = layoutOf("# 根\n- a\n- b", {
      spacingVertical: 0,
      spacingHorizontal: 0,
    });
    const loose = layoutOf("# 根\n- a\n- b", {
      spacingVertical: 40,
      spacingHorizontal: 200,
    });

    const [a1, b1] = tight.root.children;
    const [a2, b2] = loose.root.children;

    expect(b2.x - a2.x).toBeGreaterThan(b1.x - a1.x);
    expect(a2.y - tight.root.y).toBeGreaterThan(a1.y - tight.root.y);
  });
});

describe("computeLayout - 折叠", () => {
  it("折叠节点的子树不参与布局", () => {
    const { root } = parseMarkdown("# 根\n- a\n  - a1\n  - a2\n- b");
    const resolved = resolveOptions({});
    const measure = createNodeMeasurer(resolved);
    const foldedId = root.children[0].id;

    const expanded = computeLayout(root, { options: resolved, measure });
    const folded = computeLayout(root, {
      options: resolved,
      measure,
      isFolded: (node) => node.id === foldedId,
    });

    expect(expanded.nodes.length).toBe(5);
    expect(folded.nodes.length).toBe(3);

    const foldedNode = folded.nodes.find((n) => n.id === foldedId);
    expect(foldedNode?.hasChildren).toBe(true);
    expect(foldedNode?.hasHiddenChildren).toBe(true);
    expect(foldedNode?.children).toEqual([]);
  });

  it("折叠让子树占据的广度轴空间被回收", () => {
    const { root } = parseMarkdown(
      "# 根\n- a\n  - 一段很长的文字内容会自动换行从而撑高节点所占的垂直空间\n  - a2\n- b",
    );
    const resolved = resolveOptions({ maxWidth: 120 });
    const measure = createNodeMeasurer(resolved);
    const foldedId = root.children[0].id;

    const expanded = computeLayout(root, { options: resolved, measure });
    const folded = computeLayout(root, {
      options: resolved,
      measure,
      isFolded: (node) => node.id === foldedId,
    });

    const breadth = (r: LayoutResult) => r.bbox.x1 - r.bbox.x0;
    expect(breadth(folded)).toBeLessThan(breadth(expanded));
    // 深度轴同样回收了被折叠子树占据的空间
    expect(folded.bbox.y1).toBeLessThan(expanded.bbox.y1);
  });

  it("折叠是幂等的：重新展开得到完全一致的布局", () => {
    const { root } = parseMarkdown("# 根\n- a\n  - a1\n  - a2\n- b");
    const resolved = resolveOptions({});
    const measure = createNodeMeasurer(resolved);
    const foldedId = root.children[0].id;

    const snapshot = (r: LayoutResult) =>
      r.nodes.map((node) => [node.id, node.x, node.y]);

    const first = computeLayout(root, { options: resolved, measure });
    computeLayout(root, {
      options: resolved,
      measure,
      isFolded: (node) => node.id === foldedId,
    });
    const again = computeLayout(root, { options: resolved, measure });

    expect(snapshot(again)).toEqual(snapshot(first));
  });
});

describe("computeLayout - 连线与包围盒", () => {
  it("连线数量等于非根节点数量", () => {
    const result = layoutOf("# A\n- a\n  - a1\n- b");
    expect(result.links.length).toBe(result.nodes.length - 1);
    expect(result.links.every((link) => link.target.parent === link.source)).toBe(
      true,
    );
  });

  it("包围盒覆盖全部节点", () => {
    const result = layoutOf("# A\n- a\n- b");
    for (const node of result.nodes) {
      expect(node.x - node.height / 2).toBeGreaterThanOrEqual(result.bbox.x0);
      expect(node.x + node.height / 2).toBeLessThanOrEqual(result.bbox.x1);
      expect(node.y).toBeGreaterThanOrEqual(result.bbox.y0);
      expect(node.y + node.width).toBeLessThanOrEqual(result.bbox.y1);
    }
  });

  it("createLinkD 生成三次贝塞尔路径且端点精确", () => {
    const d = createLinkD(0, 10, 80, 40);
    expect(d).toBe("M0,10C36,10 44,40 80,40");
  });
});

describe("getToggleBadge", () => {
  const options = resolveOptions();

  it("展开态是减号，尺寸为圆直径", () => {
    const badge = getToggleBadge(options, false, 3);
    expect(badge.label).toBe("−");
    expect(badge.folded).toBe(false);
    expect(badge.width).toBe(options.toggleRadius * 2);
    expect(badge.height).toBe(options.toggleRadius * 2);
  });

  it("折叠态显示直接子节点数量", () => {
    expect(getToggleBadge(options, true, 3).label).toBe("+3");
    expect(getToggleBadge(options, true, 12).label).toBe("+12");
    expect(getToggleBadge(options, true, 1).label).toBe("+1");
  });

  it("数量超过 99 显示 99+", () => {
    expect(getToggleBadge(options, true, 100).label).toBe("+99+");
  });

  it("关掉 showCollapsedCount 后只显示 +，且更窄", () => {
    const off = resolveOptions({ showCollapsedCount: false });
    const bare = getToggleBadge(off, true, 12);
    const full = getToggleBadge(options, true, 12);

    expect(bare.label).toBe("+");
    expect(bare.width).toBeLessThan(full.width);
  });

  it("折叠态高度至少能容纳文字，宽度随位数增长", () => {
    const one = getToggleBadge(options, true, 1);
    const many = getToggleBadge(options, true, 12);

    expect(one.height).toBeGreaterThanOrEqual(Math.round(options.fontSize * 1.15));
    expect(many.width).toBeGreaterThan(one.width);
  });
});

describe("computeLayout - 折叠徽标参与包围盒", () => {
  const markdown = ["# 根", ...Array.from({ length: 12 }, (_, i) => `- 子项${i + 1}`)].join("\n");

  function bboxOf(collapsed: boolean, options: MarkmapOptions): LayoutResult {
    const { root } = parseMarkdown(markdown);
    const resolved = resolveOptions(options);
    const measure = createNodeMeasurer(resolved);
    const foldedId = root.id;
    return computeLayout(root, {
      options: resolved,
      measure,
      isFolded: collapsed ? (node) => node.id === foldedId : undefined,
    });
  }

  it("折叠后数量胶囊比展开时的圆更宽，包围盒要跟着外扩", () => {
    const withCount = bboxOf(true, { showCollapsedCount: true });
    const withoutCount = bboxOf(true, { showCollapsedCount: false });

    expect(withCount.bbox.y1).toBeGreaterThan(withoutCount.bbox.y1);
  });

  it("扁平树折叠后只剩根节点，横向范围主要由徽标决定", () => {
    const collapsed = bboxOf(true, { showCollapsedCount: true });
    const node = collapsed.nodes[0];
    const badge = getToggleBadge(resolveOptions(), true, 12);

    expect(collapsed.nodes).toHaveLength(1);
    // 右边界的富余量至少要盖住胶囊的一半，否则 fit() 会把它裁掉
    expect(collapsed.bbox.y1).toBeGreaterThanOrEqual(
      node.y + node.width + badge.width / 2,
    );
  });
});
