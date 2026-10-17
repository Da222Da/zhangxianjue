import { caf, clamp, easeCubicInOut, raf } from "./utils";

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/**
 * 基于 requestAnimationFrame 的补间驱动器。
 *
 * 只负责把 0→1 的进度按缓动曲线推给调用方，
 * 具体插值什么（节点坐标 / 视图变换）由调用方决定。
 */
export class Animator {
  private handle: number | null = null;

  get running(): boolean {
    return this.handle !== null;
  }

  /**
   * 启动一次补间。`duration <= 0` 时直接跳到终点，不做动画。
   * 重复调用会取消上一次未完成的补间。
   */
  run(
    duration: number,
    onUpdate: (progress: number) => void,
    onComplete?: () => void,
  ): void {
    this.cancel();

    if (!(duration > 0)) {
      onUpdate(1);
      onComplete?.();
      return;
    }

    const startedAt = now();
    const step = () => {
      this.handle = null;
      const elapsed = now() - startedAt;
      const progress = clamp(elapsed / duration, 0, 1);
      onUpdate(easeCubicInOut(progress));
      if (progress < 1) {
        this.handle = raf(step);
      } else {
        onComplete?.();
      }
    };
    this.handle = raf(step);
  }

  cancel(): void {
    if (this.handle !== null) {
      caf(this.handle);
      this.handle = null;
    }
  }
}
