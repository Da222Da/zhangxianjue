// src/api/membershipService.ts
import apiClient from "@/services/apiClient";
import type { ApiResponse, MembershipApplicationItem, MembershipListParams } from "@/types/api";

/**
 * 会员申请审核接口层
 * 只负责请求与数据转换，不持有状态、不感知组件
 */
const membershipService = {
  /** 分页查询会员申请，返回带分页字段的完整响应体 */
  getApplications(params?: MembershipListParams): Promise<ApiResponse<MembershipApplicationItem[]>> {
    return apiClient.get<MembershipApplicationItem[]>("/admin/membership", { params });
  },

  /** 审核申请：approve=true 通过并升级为会员，false 拒绝 */
  reviewApplication(id: number, approve: boolean): Promise<MembershipApplicationItem> {
    return apiClient.put<MembershipApplicationItem>(`/admin/membership/${id}`, { approve });
  },
};

export default membershipService;
