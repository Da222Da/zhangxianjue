// src/api/captchaService.ts
import http from "@/services/http";
import type { ApiResponse, CaptchaResult } from "@/types/api";

/**
 * 图形验证码接口层
 * 只负责请求与数据转换，不持有状态、不感知组件
 */
const captchaService = {
  /** 获取一张新的图形验证码（一次性） */
  getCaptcha(): Promise<ApiResponse<CaptchaResult>> {
    return http.get<CaptchaResult>("/auth/captcha");
  },
};

export default captchaService;
