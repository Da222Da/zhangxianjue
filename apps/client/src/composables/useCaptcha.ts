// src/composables/useCaptcha.ts
import { onMounted, ref } from "vue";
import captchaService from "@/api/captchaService";

/**
 * 图形验证码状态
 *
 * 只负责「取一张验证码」并把 captchaId / image 提供给视图；
 * 用户输入的验证码文本由表单自己持有。
 */
export const useCaptcha = () => {
  const captchaId = ref("");
  const image = ref("");
  const loading = ref(false);

  /** 重新获取一张（验证码是一次性的，校验失败后必须刷新） */
  const refresh = async (): Promise<void> => {
    loading.value = true;
    try {
      const { data } = await captchaService.getCaptcha();
      captchaId.value = data.captchaId;
      image.value = data.image;
    } finally {
      loading.value = false;
    }
  };

  onMounted(refresh);

  return { captchaId, image, loading, refresh };
};
