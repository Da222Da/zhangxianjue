// src/services/roleService.ts
import { randomUUID } from "node:crypto";
import type { Transaction } from "sequelize";
import { Permission, Role, RolePermission, Users, sequelize } from "../models/index.ts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors.ts";
import { Permissions, RoleCodes } from "../utils/constants/permissions.ts";
import { assertPermissionIdsExist } from "./permissionService.ts";

/** name 列类型为 STRING，即 VARCHAR(255) */
export const MAX_ROLE_NAME_LENGTH = 255;
/** description 列类型为 TEXT，上限 65535 字节 */
export const MAX_DESCRIPTION_BYTES = 65535;

/** 角色列表项 */
export interface RoleListItem {
  id: number;
  name: string;
  code: string;
  description: string | null;
  /** 系统内置角色不可删除 */
  is_system: boolean;
  /** 该角色下的用户数 */
  user_count: number;
  permission_ids: number[];
  permission_codes: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** 创建角色入参 */
export interface CreateRolePayload {
  name: string;
  description?: string | null;
  /** 不传表示不分配权限 */
  permission_ids?: number[];
}

/** 更新角色入参 */
export interface UpdateRolePayload {
  name: string;
  description?: string | null;
}

/** 带权限关联的模型实例 */
type RoleRow = Role & { permissions?: Permission[] };

/** 关联权限；through 不返回关联表自身的字段 */
const PERMISSION_INCLUDE = {
  model: Permission,
  as: "permissions",
  attributes: ["id", "code", "name", "group_name", "description"],
  through: { attributes: [] },
  required: false,
};

/** 把模型实例摊平成响应体 */
const toListItem = (row: RoleRow, userCount = 0): RoleListItem => {
  const plain = row.get({ plain: true }) as Role & { permissions?: Permission[] };
  const permissions = plain.permissions ?? [];
  return {
    id: plain.id,
    name: plain.name,
    code: plain.code,
    description: plain.description,
    is_system: plain.is_system,
    user_count: userCount,
    permission_ids: permissions.map((permission) => permission.id),
    permission_codes: permissions.map((permission) => permission.code),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

/**
 * 查询全部角色（含权限与成员数）
 *
 * 成员数用一次分组查询取回，避免逐个角色 count 造成 N+1。
 */
export const listRoles = async (): Promise<RoleListItem[]> => {
  const [roles, userCounts] = await Promise.all([
    Role.findAll({ include: [PERMISSION_INCLUDE], order: [["id", "ASC"]] }),
    Users.findAll({
      attributes: ["role_id", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      group: ["role_id"],
      raw: true,
    }),
  ]);

  const countMap = new Map<number, number>(
    (userCounts as unknown as Array<{ role_id: number; count: number | string }>).map((row) => [row.role_id, Number(row.count)]),
  );

  return (roles as RoleRow[]).map((role) => toListItem(role, countMap.get(role.id) ?? 0));
};

/**
 * 按主键取出角色
 * @throws {NotFoundError} 角色不存在
 */
const findRoleOrFail = async (id: number): Promise<RoleRow> => {
  const role = await Role.findByPk(id, { include: [PERMISSION_INCLUDE] });
  if (!role) {
    throw new NotFoundError("角色不存在");
  }
  return role as RoleRow;
};

/** 断言角色名未被占用 */
const assertRoleNameAvailable = async (name: string, excludeId?: number): Promise<void> => {
  const existing = await Role.findOne({ where: { name }, attributes: ["id"] });
  if (existing && existing.id !== excludeId) {
    throw new BadRequestError("角色名已存在");
  }
};

/** 替换角色的权限关联（事务内执行） */
const replacePermissions = async (roleId: number, permissionIds: number[], transaction: Transaction): Promise<void> => {
  await RolePermission.destroy({ where: { role_id: roleId }, transaction });
  if (permissionIds.length > 0) {
    await RolePermission.bulkCreate(
      permissionIds.map((permissionId) => ({ role_id: roleId, permission_id: permissionId })),
      { transaction },
    );
  }
};

/**
 * 创建自定义角色
 *
 * ⚠️ 自定义角色的 code 由服务端生成，不开放给用户填写：
 * code 只用于程序判定，内置角色之外没有业务含义。
 * @throws {BadRequestError} 角色名重复或权限 id 不存在
 */
export const createRole = async (payload: CreateRolePayload): Promise<RoleListItem> => {
  await assertRoleNameAvailable(payload.name);
  const permissionIds = [...new Set(payload.permission_ids ?? [])];
  await assertPermissionIdsExist(permissionIds);

  const roleId = await sequelize.transaction(async (transaction) => {
    const role = await Role.create(
      {
        name: payload.name,
        // 128 位 UUID 取前 12 位十六进制（48 bit），展示短且碰撞概率可忽略
        code: `custom_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        description: payload.description ?? null,
        is_system: false,
      },
      { transaction },
    );
    await replacePermissions(role.id, permissionIds, transaction);
    return role.id;
  });

  const role = await findRoleOrFail(roleId);
  return toListItem(role);
};

/**
 * 更新角色名与描述
 *
 * code 不随名称变化：令牌与中间件都依赖角色归属，改 code 等于换了一个角色。
 * @throws {BadRequestError} 角色名重复
 * @throws {NotFoundError} 角色不存在
 */
export const updateRole = async (id: number, payload: UpdateRolePayload): Promise<RoleListItem> => {
  const role = await findRoleOrFail(id);
  await assertRoleNameAvailable(payload.name, id);

  await role.update({ name: payload.name, description: payload.description ?? null });
  return toListItem(await findRoleOrFail(id));
};

/**
 * 删除角色
 *
 * 系统内置角色不可删除；仍有用户引用时拒绝删除。
 * @throws {ForbiddenError} 内置角色
 * @throws {BadRequestError} 仍有用户引用
 * @throws {NotFoundError} 角色不存在
 */
export const deleteRole = async (id: number): Promise<void> => {
  const role = await findRoleOrFail(id);

  if (role.is_system) {
    throw new ForbiddenError("系统内置角色不能删除");
  }

  const userCount = await Users.count({ where: { role_id: id } });
  if (userCount > 0) {
    throw new BadRequestError(`该角色下还有 ${userCount} 个用户，请先调整他们的角色`);
  }

  // RolePermissions 的外键是 ON DELETE CASCADE，关联记录会自动清理
  await role.destroy();
};

/**
 * 重设角色权限
 *
 * 校验：
 * - 权限 id 必须全部存在；
 * - 内置管理员角色必须保留 `admin:access`，否则后台会彻底失去入口。
 * @throws {BadRequestError} 权限 id 不存在
 * @throws {ForbiddenError} 管理员角色缺少后台访问权限
 * @throws {NotFoundError} 角色不存在
 */
export const setRolePermissions = async (id: number, permissionIds: number[]): Promise<RoleListItem> => {
  const role = await findRoleOrFail(id);
  const uniqueIds = [...new Set(permissionIds)];
  await assertPermissionIdsExist(uniqueIds);

  if (role.code === RoleCodes.ADMIN) {
    const adminAccess = await Permission.findOne({ where: { code: Permissions.ADMIN_ACCESS }, attributes: ["id"] });
    if (adminAccess && !uniqueIds.includes(adminAccess.id)) {
      throw new ForbiddenError(`管理员角色必须保留「后台访问」权限`);
    }
  }

  await sequelize.transaction(async (transaction) => {
    await replacePermissions(id, uniqueIds, transaction);
  });

  return toListItem(await findRoleOrFail(id));
};
