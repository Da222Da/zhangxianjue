/**
 * 把服务端返回的时间字符串格式化为本地日期
 * @param value - ISO 时间字符串，可能为空
 * @returns 形如 2026-10-17 的日期；无法解析时返回空串
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/**
 * 为 Markdown 文本中的所有链接添加 `parent` 查询参数
 * @param text - 包含 Markdown 链接的原始文本
 * @param parentValue - 需要添加到 URL 查询参数中的 parent 值
 * @returns 处理后的新文本，所有合法链接都会被添加上 parent 参数
 */
export function addParentToMarkdownLinks(text: string, parentValue: string): string {
  // 定义正则表达式，用于匹配 Markdown 链接格式：[链接文本](链接地址)
  // \[([^\]]+)\] ：匹配方括号内的链接文本，捕获组1
  // \(([^)]+)\)  ：匹配圆括号内的链接地址，捕获组2
  // /g ：全局匹配，找出文本中所有的 Markdown 链接
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  // 使用 replace 方法替换匹配到的每一个链接
  return text.replace(linkRegex, (match, linkTitle, url) => {
    try {
      // 使用 URL 构造函数解析链接地址。
      // 第二个参数 "http://localhost" 作为 base URL，
      // 这样当遇到相对路径（如 "/path/to/page"）或无协议路径时，URL 对象也能正确解析，而不会报错。
      const urlObj = new URL(url, "http://localhost");

      // 在解析出的 URL 对象中，添加或更新 "parent" 查询参数
      urlObj.searchParams.set("parent", parentValue);

      // 重新组装 Markdown 链接并返回
      // 注意：这里故意只拼接 pathname + search + hash，去掉了 protocol 和 host (如 http://localhost)
      // 这样可以保证原本的相对路径在添加参数后依然是相对路径，原本的绝对路径依然保持原样
      return `[${linkTitle}](${urlObj.pathname}${urlObj.search}${urlObj.hash})`;
    } catch (e) {
      // 如果 URL 解析失败（例如遇到不合法的 URL 字符串），则原样返回当前匹配的文本，不做任何修改
      return match;
    }
  });
}
