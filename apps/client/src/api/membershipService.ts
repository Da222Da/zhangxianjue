// src/api/membershipService.ts
import http from "@/services/http";
import type { ApiResponse, MembershipStatus } from "@/types/api";

/**
 * 会员申请接口层
 * 只负责请求与数据转换；审核在 admin 完成
 */
const membershipService = {
  /** 提交会员升级申请 */
  apply(): Promise<ApiResponse<unknown>> {
    return http.post<unknown>("/membership/apply");
  },

  /** 查询当前用户最近一次申请状态 */
  getStatus(): Promise<ApiResponse<MembershipStatus>> {
    return http.get<MembershipStatus>("/membership/status");
  },
};

export default membershipService;
