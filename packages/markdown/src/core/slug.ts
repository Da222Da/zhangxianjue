/**
 * 生成标题锚点
 *
 * 保留中文 / 字母 / 数字，空白转 `-`，去掉标点。
 * 前缀 `md-heading-` 避免与宿主页面已有 id 冲突。
 */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/[\s　]+/g, "-")
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "section";
}

/** 生成带前缀且同文档内唯一的锚点 */
export function uniqueHeadingId(text: string, used: Map<string, number>): string {
  const base = `md-heading-${slugify(text)}`;
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}
