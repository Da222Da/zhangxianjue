import { beforeEach, describe, expect, it } from "vitest";
import {
  IMAGE_PLACEHOLDER_RATIO,
  guessImageFilename,
  resolveImageLayout,
  setNaturalSize,
} from "../src/core/images";

describe("resolveImageLayout", () => {
  beforeEach(() => {
    setNaturalSize("wide.png", null);
    setNaturalSize("small.png", null);
  });

  it("超出 maxWidth 的图片等比缩放到 maxWidth", () => {
    setNaturalSize("wide.png", { width: 2000, height: 500 });
    const layout = resolveImageLayout({ src: "wide.png", alt: "宽图" }, 260);

    expect(layout.ready).toBe(true);
    expect(layout.width).toBe(260);
    // 宽高比保持不变
    expect(layout.height).toBe(65);
    expect(layout.width / layout.height).toBeCloseTo(2000 / 500, 1);
  });

  it("没超过 maxWidth 的图片保持原尺寸，不放大", () => {
    setNaturalSize("small.png", { width: 120, height: 80 });
    const layout = resolveImageLayout({ src: "small.png", alt: "小图" }, 260);

    expect(layout.ready).toBe(true);
    expect(layout.width).toBe(120);
    expect(layout.height).toBe(80);
  });

  it("正方形图片按 maxWidth 收窄", () => {
    setNaturalSize("square.png", { width: 400, height: 400 });
    const layout = resolveImageLayout({ src: "square.png", alt: "" }, 200);

    expect(layout.width).toBe(200);
    expect(layout.height).toBe(200);
  });

  it("尺寸未知时先用占位尺寸，标记 ready: false", () => {
    const layout = resolveImageLayout({ src: "pending.png", alt: "" }, 260);

    expect(layout.ready).toBe(false);
    expect(layout.width).toBeLessThanOrEqual(260);
    expect(layout.height).toBe(
      Math.round(layout.width * IMAGE_PLACEHOLDER_RATIO),
    );
  });

  it("加载失败也返回占位尺寸，节点不会塌成 0 高", () => {
    setNaturalSize("broken.png", null);
    const layout = resolveImageLayout({ src: "broken.png", alt: "坏图" }, 260);

    expect(layout.ready).toBe(false);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    expect(layout.alt).toBe("坏图");
  });

  it("maxWidth 很小时不会算出负数或零尺寸", () => {
    setNaturalSize("wide.png", { width: 2000, height: 500 });
    const layout = resolveImageLayout({ src: "wide.png", alt: "" }, 40);

    expect(layout.width).toBe(40);
    expect(layout.height).toBeGreaterThan(0);
  });
});

describe("guessImageFilename", () => {
  it("从 URL 路径里取文件名", () => {
    expect(guessImageFilename("https://example.com/a/b/photo.PNG")).toBe("photo.png");
    expect(guessImageFilename("/assets/图 表.svg")).toBe("图 表.svg");
  });

  it("去掉查询串和锚点", () => {
    expect(guessImageFilename("https://example.com/img.png?v=2#top")).toBe("img.png");
  });

  it("以 MIME 为准：服务端协商出的类型比 URL 后缀可信", () => {
    expect(guessImageFilename("https://example.com/avatar", "image/png")).toBe("avatar.png");
    expect(guessImageFilename("https://example.com/a.php", "image/jpeg")).toBe("a.jpg");
    expect(guessImageFilename("https://example.com/a.png", "image/webp")).toBe("a.webp");
  });

  it("带参数的 MIME（含 charset）也能识别", () => {
    expect(guessImageFilename("https://example.com/a.svg", "image/svg+xml; charset=utf-8")).toBe(
      "a.svg",
    );
  });

  it("data URL / blob URL 没有有意义的文件名，退回 image.<ext>", () => {
    const data = "data:image/svg+xml;base64,PHN2Zy8+";
    expect(guessImageFilename(data)).toBe("image.png");
    expect(guessImageFilename(data, "image/svg+xml")).toBe("image.svg");
    expect(guessImageFilename("blob:http://localhost/9a1b")).toBe("image.png");
  });

  it("文件名里的非法字符被替换掉", () => {
    // `?` `#` 是 URL 分隔符，会被先切掉，轮不到这里的只有 `:` `*` 这类
    expect(guessImageFilename("https://example.com/a:b*c.png")).toBe("a_b_c.png");
    expect(guessImageFilename("/pics/a*b:c.png")).toBe("a_b_c.png");
  });
});
