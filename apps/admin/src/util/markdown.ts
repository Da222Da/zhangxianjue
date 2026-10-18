/**
 * 生成 Markdown 行内链接 `[标题](路径)`
 *
 * 标题里的反斜杠与方括号必须转义，否则会提前闭合链接文本；
 * 换行压成空格，避免链接被拆到两行。
 */
export const formatMarkdownLink = (title: string, path: string): string => {
  const safeTitle = title.replace(/[\r\n]+/g, " ").replace(/([\\[\]])/g, "\\$1");
  return `[${safeTitle}](${path})`;
};
