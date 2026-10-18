// src/composables/useMembership.ts
import { ref } from "vue";
import membershipService from "@/api/membershipService";
import type { MembershipViewStatus } from "@/types/api";

/**
 * 会员申请状态与提交编排
 *
 * 审核在 admin 完成；client 只负责提交申请与展示状态。
 */
export const useMembership = () => {
  const status = ref<MembershipViewStatus>("none");
  const appliedAt = ref<string | null>(null);
  const reviewedAt = ref<string | null>(null);
  const loading = ref(false);
  const applying = ref(false);

  /** 拉取最近一次申请状态 */
  const loadStatus = async (): Promise<void> => {
    loading.value = true;
    try {
      const { data } = await membershipService.getStatus();
      status.value = data.status;
      appliedAt.value = data.appliedAt;
      reviewedAt.value = data.reviewedAt;
    } catch {
      // 未登录 / 网络异常时保持默认 none，视图自行决定提示
    } finally {
      loading.value = false;
    }
  };

  /**
   * 提交升级申请
   * @throws {ApiError} 已有待审核申请、管理员 / 已是会员等，由视图捕获提示
   */
  const apply = async (): Promise<void> => {
    applying.value = true;
    try {
      await membershipService.apply();
      await loadStatus();
    } finally {
      applying.value = false;
    }
  };

  return { status, appliedAt, reviewedAt, loading, applying, loadStatus, apply };
};
