// src/composables/useArticleCover.ts
import { computed, onBeforeUnmount, ref } from "vue";
import type { Ref, ComputedRef } from "vue";
import articleService from "@/api/articleService";
import { resolveAssetUrl } from "@/services/apiConfig";

interface UseArticleCoverReturn {
  /** 待上传的文件；选中即暂存，保存时才真正上传（决策 B） */
  pendingFile: Ref<File | null>;
  /** 上传请求进行中，供视图禁用按钮 */
  uploading: Ref<boolean>;
  /** 封面预览地址：优先展示待上传文件的本地预览，其次展示已保存封面 */
  previewUrl: ComputedRef<string>;
  /** 是否有封面可展示（含待上传） */
  hasCover: ComputedRef<boolean>;
  /** 打开弹窗时按文章当前封面重置状态 */
  reset: (cover: string | null) => void;
  /** 选中本地图片，仅暂存并生成本地预览 */
  selectFile: (file: File) => void;
  /** 移除封面（包含已保存的与待上传的） */
  clear: () => void;
  /**
   * 结算出可提交给接口的 cover 值
   * - 有待上传文件 → 先调上传接口，返回其相对路径
   * - 否则 → 返回当前封面（可能是 null，表示清空）
   * @throws {ApiError} 上传失败时抛出，由视图捕获提示，此时不应提交文章
   */
  resolveForSubmit: () => Promise<string | null>;
}

/**
 * 文章封面管理
 *
 * 只负责封面这一件事的状态与上传编排，不感知 DOM 结构；
 * 视图负责渲染与错误提示。
 */
export const useArticleCover = (): UseArticleCoverReturn => {
  /** 已保存的封面（相对路径或外链） */
  const currentCover = ref<string | null>(null);
  const pendingFile = ref<File | null>(null);
  const uploading = ref(false);
  /** 待上传文件的本地预览地址，需手动回收 */
  const objectUrl = ref<string | null>(null);

  const revokeObjectUrl = (): void => {
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value);
      objectUrl.value = null;
    }
  };

  const previewUrl = computed(() => objectUrl.value ?? resolveAssetUrl(currentCover.value));
  const hasCover = computed(() => !!previewUrl.value);

  const reset = (cover: string | null): void => {
    revokeObjectUrl();
    pendingFile.value = null;
    currentCover.value = cover;
  };

  const selectFile = (file: File): void => {
    revokeObjectUrl();
    objectUrl.value = URL.createObjectURL(file);
    pendingFile.value = file;
  };

  const clear = (): void => {
    revokeObjectUrl();
    pendingFile.value = null;
    currentCover.value = null;
  };

  const resolveForSubmit = async (): Promise<string | null> => {
    if (!pendingFile.value) {
      return currentCover.value;
    }

    uploading.value = true;
    try {
      const uploaded = await articleService.uploadImage(pendingFile.value);
      currentCover.value = uploaded.url;
      revokeObjectUrl();
      pendingFile.value = null;
      return uploaded.url;
    } finally {
      uploading.value = false;
    }
  };

  // 组件销毁时回收本地预览地址，避免内存泄漏
  onBeforeUnmount(revokeObjectUrl);

  return { pendingFile, uploading, previewUrl, hasCover, reset, selectFile, clear, resolveForSubmit };
};
