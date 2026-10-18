// src/services/userService.ts
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import type { Order, WhereOptions } from "sequelize";
import { Role, Users } from "../models/index.ts";
import type { UsersAttributes } from "../models/index.ts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors.ts";
import { RoleCodes } from "../utils/constants/permissions.ts";
import { getPermissionCodesByRoleId } from "./permissionService.ts";

/** 分页默认页码 */
export const DEFAULT_PAGE = 1;
/** 分页默认每页条数 */
export const DEFAULT_PAGE_SIZE = 10;
/** 单页最大条数 */
export const MAX_PAGE_SIZE = 100;
/** username 列类型为 STRING，即 VARCHAR(255) */
export const MAX_USERNAME_LENGTH = 255;
/** phone 列类型为 STRING(20) */
export const MAX_PHONE_LENGTH = 20;
/** bcrypt 最多只处理前 72 字节，更长的密码会被静默截断 */
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 72;

/** 账号状态 */
export const UserStatus = {
  DISABLED: 0,
  ENABLED: 1,
} as const;

/** bcrypt 哈希轮数 */
const BCRYPT_ROUNDS = 10;

/** 会员默认有效期：1 年 */
export const MEMBERSHIP_DURATION_YEARS = 1;

/** 从指定时间起算会员到期时间，默认 1 年 */
export const addMembershipDuration = (from: Date = new Date()): Date => {
  const expiresAt = new Date(from);
  expiresAt.setFullYear(expiresAt.getFullYear() + MEMBERSHIP_DURATION_YEARS);
  return expiresAt;
};

/** 会员是否已到期；null 视为没有时效（非会员） */
export const isMembershipExpired = (expiresAt: Date | null | undefined): boolean =>
  expiresAt instanceof Date && expiresAt.getTime() <= Date.now();

/**
 * 会员到期后自动降级为普通用户
 *
 * 惰性执行：登录、读取用户资料、鉴权与后台用户列表时调用，
 * 不引入额外的定时任务。
 *
 * @param user 已加载的 Users 实例（会就地更新 role_id / membership_expires_at）
 * @param roleCode 已知的角色编码，可省一次查询
 * @returns 是否发生了降级
 */
export const downgradeExpiredMembership = async (user: Users, roleCode?: string): Promise<boolean> => {
  if (!isMembershipExpired(user.membership_expires_at)) {
    return false;
  }

  const code = roleCode ?? (await Role.findByPk(user.role_id, { attributes: ["code"] }))?.code;
  if (code !== RoleCodes.MEMBER) {
    return false;
  }

  const userRole = await Role.findOne({ where: { code: RoleCodes.USER }, attributes: ["id"] });
  if (!userRole) {
    return false;
  }

  await user.update({ role_id: userRole.id, membership_expires_at: null });
  return true;
};

/**
 * 批量把已到期的会员降级为普通用户
 *
 * 用于后台用户列表：管理员打开列表时顺手清理过期会员，保证角色展示准确。
 * @returns 受影响的行数
 */
export const downgradeAllExpiredMembers = async (): Promise<number> => {
  const [memberRole, userRole] = await Promise.all([
    Role.findOne({ where: { code: RoleCodes.MEMBER }, attributes: ["id"] }),
    Role.findOne({ where: { code: RoleCodes.USER }, attributes: ["id"] }),
  ]);
  if (!memberRole || !userRole) {
    return 0;
  }

  const [affected] = await Users.update(
    { role_id: userRole.id, membership_expires_at: null },
    {
      where: {
        role_id: memberRole.id,
        membership_expires_at: { [Op.lte]: new Date() },
      },
    },
  );
  return affected;
};

/** 列表排序：新建的排前面 */
const LIST_ORDER: Order = [
  ["createdAt", "DESC"],
  ["id", "DESC"],
];

/** 角色关联；required: false → LEFT JOIN，角色缺失的账号也不会被过滤掉 */
const ROLE_INCLUDE = {
  model: Role,
  as: "roleRef",
  attributes: ["id", "name", "code"],
  required: false,
};

/** 对外用户信息：绝不包含 password */
export interface UserProfile {
  id: number;
  username: string;
  /** 手机号；管理员历史账号可能为 null */
  phone: string | null;
  avatar: string;
  role_id: number;
  /** 角色名（由关联查出） */
  role_name: string;
  /** 角色编码（由关联查出） */
  role_code: string;
  /** 会员到期时间；非会员为 null */
  membership_expires_at: Date | null;
  status: number;
  /** 该角色拥有的权限编码，前端据此控制菜单与按钮 */
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** 列表项与详情同构，单独命名便于消费端表达意图 */
export type UserListItem = UserProfile;

/** 已通过类型转换与范围校验的列表查询条件 */
export interface UserListQuery {
  /** 模糊搜索关键词，命中 username 与 phone */
  keyword?: string;
  /** 按角色筛选 */
  roleId?: number;
  /** 按状态筛选：1 启用 / 0 禁用 */
  status?: number;
  page: number;
  pageSize: number;
}

export interface UserListResult {
  rows: UserListItem[];
  total: number;
  currentPage: number;
  pageSize: number;
}

/** 创建用户入参 */
export interface CreateUserPayload {
  username: string;
  phone?: string | null;
  password: string;
  avatar?: string | null;
  role_id: number;
  /** 仅会员角色有意义；不传则默认当前时间 + 1 年 */
  membership_expires_at?: Date | null;
  status?: number;
}

/** 更新用户元数据入参；undefined 表示保持原值 */
export interface UpdateUserPayload {
  username?: string;
  phone?: string | null;
  avatar?: string | null;
  role_id?: number;
  /** 仅会员角色有意义；不传时：已是会员保持原值，新成为会员默认 1 年 */
  membership_expires_at?: Date | null;
  status?: number;
}

/** 关联了 roleRef 的模型实例 */
type UserRow = Users & { roleRef?: Role | null };

/** 把带关联的实例摊平成响应体，并补上权限编码 */
const toProfile = (row: UserRow): Omit<UserProfile, "permissions"> => {
  const { password: _password, roleRef, ...rest } = row.get({ plain: true }) as UsersAttributes & {
    roleRef?: { id: number; name: string; code: string } | null;
  };
  return {
    id: rest.id,
    username: rest.username,
    phone: rest.phone,
    avatar: rest.avatar,
    role_id: rest.role_id,
    role_name: roleRef?.name ?? "",
    role_code: roleRef?.code ?? "",
    membership_expires_at: rest.membership_expires_at,
    status: rest.status,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
  };
};

/** 为响应体补上角色权限编码 */
const enrichPermissions = async (profile: Omit<UserProfile, "permissions">): Promise<UserProfile> => ({
  ...profile,
  permissions: await getPermissionCodesByRoleId(profile.role_id),
});

/** 构造 LIKE 匹配模式：转义 % _ \ 三个通配符字符 */
const buildLikePattern = (keyword: string): string => `%${keyword.replace(/[\\%_]/g, "\\$&")}%`;

/** 组合列表筛选条件 */
const buildWhereCondition = (query: UserListQuery): WhereOptions<UsersAttributes> => {
  const conditions: WhereOptions<UsersAttributes>[] = [];

  if (query.keyword) {
    const pattern = buildLikePattern(query.keyword);
    conditions.push({
      [Op.or]: [{ username: { [Op.like]: pattern } }, { phone: { [Op.like]: pattern } }],
    });
  }
  if (query.roleId !== undefined) {
    conditions.push({ role_id: query.roleId });
  }
  if (query.status !== undefined) {
    conditions.push({ status: query.status });
  }

  return conditions.length > 0 ? { [Op.and]: conditions } : {};
};

/**
 * 分页查询用户列表
 *
 * 列表与详情都不返回 password —— 密码哈希即使不可逆也不应离开服务端。
 */
export const listUsers = async (query: UserListQuery): Promise<UserListResult> => {
  const { page, pageSize } = query;

  // 列表展示前先清理已到期的会员，保证角色列与到期列一致
  await downgradeAllExpiredMembers();

  const { count, rows } = await Users.findAndCountAll({
    where: buildWhereCondition(query),
    include: [ROLE_INCLUDE],
    // 显式排除 password，避免它随 SELECT * 一起返回
    attributes: { exclude: ["password"] },
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: LIST_ORDER,
  });

  const profiles = await Promise.all((rows as UserRow[]).map((row) => enrichPermissions(toProfile(row))));
  return { rows: profiles, total: count, currentPage: page, pageSize };
};

/** 按主键取出模型实例 */
const findUserOrFail = async (id: number): Promise<UserRow> => {
  const user = await Users.findByPk(id, { include: [ROLE_INCLUDE] });
  if (!user) {
    throw new NotFoundError("用户不存在");
  }
  return user as UserRow;
};

/**
 * 查询用户公开信息（含角色与权限）
 * @throws {NotFoundError} 用户不存在
 */
export const getUserProfile = async (id: number): Promise<UserProfile> => {
  let user = await findUserOrFail(id);
  if (await downgradeExpiredMembership(user, user.roleRef?.code)) {
    // 降级后角色关联已变化，重新查一次以拿到普通用户角色
    user = await findUserOrFail(id);
  }
  return enrichPermissions(toProfile(user));
};

/** 断言用户名 / 手机号未被占用 */
const assertIdentityAvailable = async (
  username: string | undefined,
  phone: string | null | undefined,
  excludeId?: number,
): Promise<void> => {
  if (username !== undefined) {
    const existing = await Users.findOne({ where: { username }, attributes: ["id"] });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestError("用户名已被占用");
    }
  }
  if (phone !== undefined && phone !== null && phone !== "") {
    const existing = await Users.findOne({ where: { phone }, attributes: ["id"] });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestError("该手机号已被注册");
    }
  }
};

/** 断言角色存在，并返回角色实体 */
const assertRoleExists = async (roleId: number): Promise<Role> => {
  const role = await Role.findByPk(roleId, { attributes: ["id", "code"] });
  if (!role) {
    throw new BadRequestError("角色不存在");
  }
  return role;
};

/** 哈希密码 */
export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, BCRYPT_ROUNDS);

/**
 * 查询注册用户的默认角色（内置 user 角色）
 * @throws {NotFoundError} 默认角色缺失（通常意味着数据库未迁移）
 */
export const getDefaultRole = async (): Promise<Role> => {
  const role = await Role.findOne({ where: { code: RoleCodes.USER } });
  if (!role) {
    throw new NotFoundError("默认角色不存在，请检查数据库迁移");
  }
  return role;
};

/**
 * 创建用户
 * @throws {BadRequestError} 用户名 / 手机号重复或角色不存在
 */
export const createUser = async (payload: CreateUserPayload): Promise<UserProfile> => {
  await assertIdentityAvailable(payload.username, payload.phone);
  const role = await assertRoleExists(payload.role_id);
  const isMember = role.code === RoleCodes.MEMBER;

  const user = await Users.create({
    username: payload.username,
    phone: payload.phone ?? null,
    password: await hashPassword(payload.password),
    avatar: payload.avatar ?? "",
    role_id: payload.role_id,
    // 会员默认 1 年；其它角色不保存时效
    membership_expires_at: isMember ? (payload.membership_expires_at ?? addMembershipDuration()) : null,
    status: payload.status ?? UserStatus.ENABLED,
  });

  return getUserProfile(user.id);
};

/**
 * 统计除指定用户外，仍处于启用状态的管理员数量
 *
 * 用于阻止「删除 / 禁用 / 降级最后一个管理员」——否则后台会彻底锁死。
 */
const countOtherActiveAdmins = async (excludeUserId: number): Promise<number> => {
  const adminRole = await Role.findOne({ where: { code: RoleCodes.ADMIN }, attributes: ["id"] });
  if (!adminRole) {
    return 0;
  }
  return Users.count({
    where: {
      role_id: adminRole.id,
      status: UserStatus.ENABLED,
      id: { [Op.ne]: excludeUserId },
    },
  });
};

/**
 * 更新用户元数据
 *
 * 自我保护：不能禁用自己、不能改自己的角色（避免把自己锁在后台外）。
 * 最后一名启用状态的管理员不能被禁用或降级。
 * @throws {BadRequestError} 用户名 / 手机号重复、角色不存在
 * @throws {ForbiddenError} 违反自我保护或最后一名管理员约束
 */
export const updateUser = async (id: number, payload: UpdateUserPayload, operatorId: number): Promise<UserProfile> => {
  const user = await findUserOrFail(id);
  const currentRoleCode = user.roleRef?.code ?? "";

  if (id === operatorId) {
    if (payload.status === UserStatus.DISABLED) {
      throw new ForbiddenError("不能禁用当前登录的账号");
    }
    if (payload.role_id !== undefined && payload.role_id !== user.role_id) {
      throw new ForbiddenError("不能修改当前登录账号的角色");
    }
  }

  const nextRoleId = payload.role_id ?? user.role_id;
  const nextStatus = payload.status ?? user.status;
  const isDemotingAdmin = currentRoleCode === RoleCodes.ADMIN && (nextRoleId !== user.role_id || nextStatus === UserStatus.DISABLED);
  if (isDemotingAdmin && (await countOtherActiveAdmins(id)) === 0) {
    throw new ForbiddenError("必须至少保留一名启用状态的管理员");
  }

  const nextRole = await assertRoleExists(payload.role_id ?? user.role_id);
  await assertIdentityAvailable(payload.username, payload.phone, id);

  const patch: Partial<UsersAttributes> = {};
  if (payload.username !== undefined) patch.username = payload.username;
  if (payload.phone !== undefined) patch.phone = payload.phone;
  if (payload.avatar !== undefined) patch.avatar = payload.avatar ?? "";
  if (payload.role_id !== undefined) patch.role_id = payload.role_id;
  if (payload.status !== undefined) patch.status = payload.status;

  if (nextRole.code === RoleCodes.MEMBER) {
    const becomingMember = payload.role_id !== undefined && payload.role_id !== user.role_id;
    if (becomingMember) {
      // 新成为会员：显式传了到期时间就用它，否则默认 1 年
      patch.membership_expires_at = payload.membership_expires_at ?? addMembershipDuration();
    } else if (payload.membership_expires_at !== undefined) {
      // 已是会员：允许后台修改到期时间；传 null 视为重新给 1 年
      patch.membership_expires_at = payload.membership_expires_at ?? addMembershipDuration();
    } else if (!user.membership_expires_at) {
      // 历史会员数据没有到期时间：补默认 1 年
      patch.membership_expires_at = addMembershipDuration();
    }
  } else {
    // 非会员角色不保留时效
    patch.membership_expires_at = null;
  }

  await user.update(patch);
  return getUserProfile(id);
};

/**
 * 重置用户密码（管理员操作，不校验旧密码）
 * @throws {NotFoundError} 用户不存在
 */
export const resetPassword = async (id: number, password: string): Promise<void> => {
  const user = await findUserOrFail(id);
  await user.update({ password: await hashPassword(password) });
};

/**
 * 删除用户
 *
 * 不能删除自己，也不能删除最后一名启用状态的管理员。
 * @throws {ForbiddenError} 违反自我保护或最后一名管理员约束
 * @throws {NotFoundError} 用户不存在
 */
export const deleteUser = async (id: number, operatorId: number): Promise<void> => {
  if (id === operatorId) {
    throw new ForbiddenError("不能删除当前登录的账号");
  }

  const user = await findUserOrFail(id);
  if (user.roleRef?.code === RoleCodes.ADMIN && (await countOtherActiveAdmins(id)) === 0) {
    throw new ForbiddenError("必须至少保留一名启用状态的管理员");
  }

  await user.destroy();
};

/**
 * 校验密码长度
 * @throws {BadRequestError} 长度不在允许区间
 */
export const assertPasswordLength = (password: string): void => {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new BadRequestError(`密码长度需为 ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} 个字符`);
  }
};
