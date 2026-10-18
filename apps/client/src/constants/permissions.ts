/**
 * 权限编码
 *
 * ⚠️ 必须与 server 的 `src/utils/constants/permissions.ts` 保持一致。
 * client 只用它判断 VIP 阅读权益与升级提示；真正的拦截在服务端。
 */
export const Permissions = {
  LIBRARY_VIEW: "library:view",
} as const;

export type PermissionCode = (typeof Permissions)[keyof typeof Permissions];
