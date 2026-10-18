/**
 * client 应用的站内页面地址
 *
 * ⚠️ 统一输出根相对路径（如 `/articles/1`），不拼域名：
 * 这样复制出来可以直接粘进 Markdown 链接 `[标题](/articles/1)`，
 * 也不会因为 client 换了部署地址而失效。路径需与 client 路由表保持一致。
 */
export const clientRoutes = {
  article: (id: number): string => `/articles/${id}`,
  note: (id: number): string => `/notes/${id}`,
  book: (id: number): string => `/library/${id}`,
} as const;
