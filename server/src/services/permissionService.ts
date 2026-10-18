// src/services/permissionService.ts
import { Permission, RolePermission } from "../models/index.ts";
import type { PermissionAttributes } from "../models/index.ts";
import { BadRequestError } from "../utils/errors.ts";

/** 权限点列表项 */
export interface PermissionItem extends PermissionAttributes {}

/**
 * 查询全部权限点
 *
 * 排序：先按分组名，再按 id —— 与种子写入顺序一致，
 * 后台「权限管理」按 group_name 分组渲染时顺序稳定。
 */
export const listPermissions = async (): Promise<PermissionItem[]> => {
  const rows = await Permission.findAll({
    attributes: ["id", "code", "name", "group_name", "description", "createdAt", "updatedAt"],
    order: [
      ["group_name", "ASC"],
      ["id", "ASC"],
    ],
    raw: true,
  });
  return rows;
};

/**
 * 查询某角色拥有的权限编码
 *
 * ⚠️ 每次都读库而不是把权限塞进 JWT：角色权限调整后应立即生效，
 * 而令牌在有效期内无法撤销。两次小查询（关联表 + 权限表）换取即时性。
 */
export const getPermissionCodesByRoleId = async (roleId: number): Promise<string[]> => {
  const links = await RolePermission.findAll({
    where: { role_id: roleId },
    attributes: ["permission_id"],
    raw: true,
  });
  if (links.length === 0) {
    return [];
  }

  const rows = await Permission.findAll({
    where: { id: links.map((link) => link.permission_id) },
    attributes: ["code"],
    raw: true,
  });
  return rows.map((row) => row.code);
};

/**
 * 校验权限 id 是否全部存在
 * @throws {BadRequestError} 存在未知权限 id
 */
export const assertPermissionIdsExist = async (ids: number[]): Promise<void> => {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return;
  }

  const count = await Permission.count({ where: { id: uniqueIds } });
  if (count !== uniqueIds.length) {
    throw new BadRequestError("包含不存在的权限点，请刷新后重试");
  }
};
