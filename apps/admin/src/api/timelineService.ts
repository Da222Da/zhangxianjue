// src/api/timelineService.ts
import apiClient from "@/services/apiClient";
import type { ApiResponse, TimelineEvent, TimelineEventPayload } from "@/types/api";

const timelineService = {
  /**
   * 查询全部时间轴事件
   *
   * ⚠️ 该接口**不分页**（时间轴规模天然很小），返回的数组已按年份倒序、
   * 同一年内 sort 升序排好，页面直接渲染即可。
   */
  getEvents(): Promise<ApiResponse<TimelineEvent[]>> {
    return apiClient.get<TimelineEvent[]>("/admin/timeline");
  },

  /** 创建事件 */
  createEvent(data: TimelineEventPayload): Promise<TimelineEvent> {
    return apiClient.post<TimelineEvent>("/admin/timeline", data);
  },

  /** 更新事件，description / button / sort 不传则服务端保持原值 */
  updateEvent(id: number, data: TimelineEventPayload): Promise<TimelineEvent> {
    return apiClient.put<TimelineEvent>(`/admin/timeline/${id}`, data);
  },

  /** 删除事件，成功时服务端不返回 data */
  deleteEvent(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/timeline/${id}`);
  },
};

export default timelineService;
