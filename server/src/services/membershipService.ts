// src/services/membershipService.ts
import type { Order, WhereOptions } from "sequelize";
import { MembershipApplication, Role, Users, sequelize } from "../models/index.ts";
import type { MembershipApplicationStatus } from "../models/index.ts";
export type { MembershipApplicationStatus } from "../models/index.ts";
import { BadRequestError, NotFoundError } from "../utils/errors.ts";
import { RoleCodes } from "../utils/constants/permissions.ts";
import { addMembershipDuration, downgradeExpiredMembership, UserStatus } from "./userService.ts";

/** 分页默认值 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/** 客户端看到的状态：从未申请过时返回 none */
export type MembershipViewStatus = MembershipApplicationStatus | "none";

export interface MembershipStatusResult {
  status: MembershipViewStatus;
  appliedAt: Date | null;
  reviewedAt: Date | null;
}

/** 后台列表项：申请 + 申请人公开信息 */
export interface MembershipApplicationItem {
  id: number;
  user_id: number;
  username: string;
  phone: string | null;
  role_id: number;
  role_name: string;
  role_code: string;
  status: MembershipApplicationStatus;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipListQuery {
  status?: MembershipApplicationStatus;
  page: number;
  pageSize: number;
}

export interface MembershipListResult {
  rows: MembershipApplicationItem[];
  total: number;
  currentPage: number;
  pageSize: number;
}

const LIST_ORDER: Order = [
  ["createdAt", "DESC"],
  ["id", "DESC"],
];

/** 申请人的角色关联（嵌套 include） */
const USER_INCLUDE = {
  model: Users,
  as: "userRef",
  attributes: ["id", "username", "phone", "role_id"],
  include: [{ model: Role, as: "roleRef", attributes: ["id", "name", "code"], required: false }],
  required: true,
};

/** 带申请人关联的模型实例 */
type ApplicationRow = MembershipApplication & {
  userRef?: Users & { roleRef?: Role | null };
};

/** 模型实例 → 列表项 */
const toApplicationItem = (row: ApplicationRow): MembershipApplicationItem => {
  const plain = row.get({ plain: true }) as MembershipApplication & {
    userRef?: (Users & { roleRef?: Role | null }) | null;
  };
  const user = plain.userRef;

  return {
    id: plain.id,
    user_id: plain.user_id,
    username: user?.username ?? "",
    phone: user?.phone ?? null,
    role_id: user?.role_id ?? 0,
    role_name: user?.roleRef?.name ?? "",
    role_code: user?.roleRef?.code ?? "",
    status: plain.status,
    reviewed_by: plain.reviewed_by,
    reviewed_at: plain.reviewed_at,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

/**
 * 提交会员升级申请
 *
 * - 管理员无需申请；已是会员无需重复申请；
 * - 同一用户同时只能有一条 pending 申请。
 * @throws {NotFoundError} 用户 / 角色缺失
 * @throws {BadRequestError} 管理员、已是会员或已有待审核申请
 */
export const applyMembership = async (userId: number): Promise<MembershipApplicationItem> => {
  const user = await Users.findByPk(userId);
  if (!user) {
    throw new NotFoundError("用户不存在");
  }
  if (user.status !== UserStatus.ENABLED) {
    throw new BadRequestError("账号已被禁用，无法申请");
  }

  // 已过期的会员先降级，允许重新申请
  await downgradeExpiredMembership(user);

  const role = await Role.findByPk(user.role_id);
  if (role?.code === RoleCodes.ADMIN) {
    throw new BadRequestError("管理员无需申请会员");
  }
  if (role?.code === RoleCodes.MEMBER) {
    throw new BadRequestError("当前已是会员");
  }

  const pending = await MembershipApplication.findOne({
    where: { user_id: userId, status: "pending" },
  });
  if (pending) {
    throw new BadRequestError("已有待审核的申请，请耐心等待");
  }

  const application = await MembershipApplication.create({
    user_id: userId,
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
  });

  return getApplicationById(application.id);
};

/** 按主键取出申请（带申请人信息） */
const getApplicationById = async (id: number): Promise<MembershipApplicationItem> => {
  const row = await MembershipApplication.findByPk(id, { include: [USER_INCLUDE] });
  if (!row) {
    throw new NotFoundError("申请不存在");
  }
  return toApplicationItem(row as ApplicationRow);
};

/**
 * 查询当前用户最近一次申请状态
 *
 * 从未申请过时 status 为 none（而不是 404），客户端据此决定按钮文案。
 */
export const getMembershipStatus = async (userId: number): Promise<MembershipStatusResult> => {
  const latest = await MembershipApplication.findOne({
    where: { user_id: userId },
    order: LIST_ORDER,
  });

  return {
    status: latest?.status ?? "none",
    appliedAt: latest?.createdAt ?? null,
    reviewedAt: latest?.reviewed_at ?? null,
  };
};

/** 后台分页查询申请列表 */
export const listApplications = async (query: MembershipListQuery): Promise<MembershipListResult> => {
  const where: WhereOptions<MembershipApplication> = query.status ? { status: query.status } : {};

  const { count, rows } = await MembershipApplication.findAndCountAll({
    where,
    include: [USER_INCLUDE],
    order: LIST_ORDER,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    distinct: true,
  });

  return {
    rows: (rows as ApplicationRow[]).map(toApplicationItem),
    total: count,
    currentPage: query.page,
    pageSize: query.pageSize,
  };
};

/**
 * 审核申请
 *
 * 通过后把用户角色改成内置的 member；拒绝只是标记状态。
 * @throws {NotFoundError} 申请 / 会员角色 / 用户不存在
 * @throws {BadRequestError} 申请已处理、申请人已变成管理员
 */
export const reviewApplication = async (
  id: number,
  approve: boolean,
  reviewerId: number,
): Promise<MembershipApplicationItem> => {
  await sequelize.transaction(async (transaction) => {
    const application = await MembershipApplication.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!application) {
      throw new NotFoundError("申请不存在");
    }
    if (application.status !== "pending") {
      throw new BadRequestError("该申请已处理，请刷新列表");
    }

    if (approve) {
      const [memberRole, user] = await Promise.all([
        Role.findOne({ where: { code: RoleCodes.MEMBER }, transaction }),
        Users.findByPk(application.user_id, { transaction, lock: transaction.LOCK.UPDATE }),
      ]);

      if (!memberRole) {
        throw new NotFoundError("会员角色不存在，请检查数据库迁移");
      }
      if (!user) {
        throw new NotFoundError("申请人不存在");
      }

      const currentRole = await Role.findByPk(user.role_id, { transaction });
      if (currentRole?.code === RoleCodes.ADMIN) {
        throw new BadRequestError("该用户是管理员，无需升级为会员");
      }

      // 审核通过默认给 1 年有效期，之后可在用户管理里单独延长
      await user.update(
        {
          role_id: memberRole.id,
          membership_expires_at: addMembershipDuration(),
        },
        { transaction },
      );
    }

    await application.update(
      {
        status: approve ? "approved" : "rejected",
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
      },
      { transaction },
    );
  });

  return getApplicationById(id);
};
