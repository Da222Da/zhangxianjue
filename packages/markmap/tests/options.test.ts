import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLORS,
  DEFAULT_OPTIONS,
  getLineColor,
  getNodeColor,
  getNodeFill,
  pickOptionsFromFrontmatter,
  resolveOptions,
  withAlpha,
} from "../src/core/options";

describe("resolveOptions", () => {
  it("空配置返回默认值", () => {
    const options = resolveOptions();
    expect(options.roughness).toBe(DEFAULT_OPTIONS.roughness);
    expect(options.maxWidth).toBe(DEFAULT_OPTIONS.maxWidth);
  });

  it("默认只展开 3 层", () => {
    expect(resolveOptions().initialExpandLevel).toBe(3);
    expect(DEFAULT_OPTIONS.initialExpandLevel).toBe(3);
  });

  it("linkIcons 做浅合并，不传字段保留默认", () => {
    const partial = resolveOptions({ linkIcons: { external: "»" } });
    expect(partial.linkIcons).toEqual({ internal: "→", external: "»" });

    const full = resolveOptions({ linkIcons: { internal: "<", external: ">" } });
    expect(full.linkIcons).toEqual({ internal: "<", external: ">" });
  });

  it("显式传入的 undefined 不会覆盖默认值", () => {
    const options = resolveOptions({ roughness: undefined, maxWidth: 120 });
    expect(options.roughness).toBe(DEFAULT_OPTIONS.roughness);
    expect(options.maxWidth).toBe(120);
  });

  it("lineRoughness / lineBowing 未指定时由 roughness / bowing 派生", () => {
    const derived = resolveOptions({ roughness: 3, bowing: 2 });
    expect(derived.lineRoughness).toBeCloseTo(2.4);
    expect(derived.lineBowing).toBe(2);

    const explicit = resolveOptions({ roughness: 3, lineRoughness: 0.5, lineBowing: 0.1 });
    expect(explicit.lineRoughness).toBe(0.5);
    expect(explicit.lineBowing).toBe(0.1);
  });

  it("数组配置做浅拷贝，避免调用方后续改动污染配置", () => {
    const colors = ["#111111"];
    const options = resolveOptions({ color: colors });
    colors.push("#222222");
    expect(options.color).toEqual(["#111111"]);

    const extent: [number, number] = [0.5, 4];
    const viewer = resolveOptions({ imageViewerScaleExtent: extent });
    extent.push(99);
    expect(viewer.imageViewerScaleExtent).toEqual([0.5, 4]);
  });

  it("图片查看器默认开启，可关掉", () => {
    const options = resolveOptions();
    expect(options.imageViewer).toBe(true);
    expect(options.imageViewerDownload).toBe(true);
    expect(resolveOptions({ imageViewer: false }).imageViewer).toBe(false);
  });

  it("字符串 color 归一化成数组（front-matter 常见写法）", () => {
    const options = resolveOptions({ color: "#ff0000" as unknown as string[] });
    expect(options.color).toEqual(["#ff0000"]);
  });
});

describe("颜色计算", () => {
  it("按层级取色，根节点用中性色", () => {
    const options = resolveOptions();
    expect(getNodeColor({ depth: 0 }, options)).not.toBe(DEFAULT_COLORS[0]);
    expect(getNodeColor({ depth: 1 }, options)).toBe(DEFAULT_COLORS[0]);
    expect(getNodeColor({ depth: 2 }, options)).toBe(DEFAULT_COLORS[1]);
    expect(getNodeColor({ depth: 11 }, options)).toBe(DEFAULT_COLORS[0]);
  });

  it("colorFreezeLevel 让该层及后代共用同一颜色", () => {
    const options = resolveOptions({ colorFreezeLevel: 2 });
    const level2 = getNodeColor({ depth: 2 }, options);

    expect(getNodeColor({ depth: 3 }, options)).toBe(level2);
    expect(getNodeColor({ depth: 9 }, options)).toBe(level2);
    expect(getNodeColor({ depth: 1 }, options)).not.toBe(level2);
  });

  it("color 传函数时完全自定义", () => {
    const options = resolveOptions({ color: (node) => `depth-${node.depth}` });
    expect(getNodeColor({ depth: 3 }, options)).toBe("depth-3");
  });

  it("nodeFill 'auto' 生成半透明填充，'none' 不填充", () => {
    const auto = resolveOptions({ nodeFill: "auto" });
    expect(getNodeFill({ depth: 1 }, auto)).toMatch(/^rgba\(/);

    const none = resolveOptions({ nodeFill: "none" });
    expect(getNodeFill({ depth: 1 }, none)).toBeUndefined();

    const fixed = resolveOptions({ nodeFill: "#123456" });
    expect(getNodeFill({ depth: 1 }, fixed)).toBe("#123456");
  });

  it("nodeFillOpacity 控制 'auto' 填充的透明度，不再写死", () => {
    const options = resolveOptions({ nodeFillOpacity: 0.4 });
    expect(getNodeFill({ depth: 1 }, options)).toMatch(/, 0\.4\)$/);

    const none = resolveOptions({ nodeFillOpacity: 0 });
    expect(getNodeFill({ depth: 1 }, none)).toMatch(/, 0\)$/);
  });

  it("lineColor 'auto' 跟随子节点颜色", () => {
    const options = resolveOptions();
    expect(getLineColor({ depth: 2 }, options)).toBe(getNodeColor({ depth: 2 }, options));

    const fixed = resolveOptions({ lineColor: "#000000" });
    expect(getLineColor({ depth: 2 }, fixed)).toBe("#000000");
  });
});

describe("withAlpha", () => {
  it("支持 3 / 6 / 8 位十六进制与 rgb()/rgba()", () => {
    expect(withAlpha("#abc", 0.5)).toBe("rgba(170, 187, 204, 0.5)");
    expect(withAlpha("#4C72B0", 0.12)).toBe("rgba(76, 114, 176, 0.12)");
    expect(withAlpha("rgb(10, 20, 30)", 0.3)).toBe("rgba(10, 20, 30, 0.3)");
    expect(withAlpha("rgba(10, 20, 30, 0.9)", 0.3)).toBe("rgba(10, 20, 30, 0.3)");
  });

  it("无法解析的形式原样返回", () => {
    expect(withAlpha("hsl(200 50% 50%)", 0.5)).toBe("hsl(200 50% 50%)");
    expect(withAlpha("var(--x)", 0.5)).toBe("var(--x)");
  });
});

describe("pickOptionsFromFrontmatter", () => {
  it("挑出可识别项，忽略无关键", () => {
    const options = pickOptionsFromFrontmatter({
      title: "文档标题",
      roughness: 3,
      maxWidth: 200,
    });
    expect(options).toEqual({ roughness: 3, maxWidth: 200 });
  });

  it("支持 markmap: 嵌套写法，顶层键优先级更高", () => {
    const options = pickOptionsFromFrontmatter({
      markmap: { roughness: 1, fillStyle: "zigzag" },
      roughness: 4,
    });
    expect(options).toEqual({ roughness: 4, fillStyle: "zigzag" });
  });

  it("跳过 null / undefined，数组元素转成字符串", () => {
    const options = pickOptionsFromFrontmatter({
      roughness: null,
      maxWidth: undefined,
      color: [1, "#fff"],
    });
    expect(options.roughness).toBeUndefined();
    expect(options.maxWidth).toBeUndefined();
    expect(options.color).toEqual(["1", "#fff"]);
  });
});
