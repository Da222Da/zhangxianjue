// src/api/timelineService.ts
import http from "@/services/http";
import type { ApiResponse, TimelineEvent } from "@/types/api";

/**
 * 时间轴读接口
 *
 * ⚠️ 不分页：服务端一次返回全部事件，已按年份倒序、同一年内 sort 升序排好。
 * 读接口公开，无需登录。
 */
const timelineService = {
  getList(): Promise<ApiResponse<TimelineEvent[]>> {
    return http.get<TimelineEvent[]>("/admin/timeline");
  },
};

export default timelineService;
