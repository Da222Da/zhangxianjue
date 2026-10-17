import { ref } from "vue";
import type { Ref } from "vue";
import type { TextResult, TextState } from "../types";

interface Snapshot {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface EditorHistory {
  canUndo: Ref<boolean>;
  canRedo: Ref<boolean>;
  /** 输入事件后调用；停顿 400ms 合并成一次撤销点 */
  recordInput: (start: number, end: number) => void;
  /** 工具栏命令执行前调用，保证命令本身可撤销 */
  snapshotBeforeEdit: () => void;
  undo: () => void;
  redo: () => void;
  /** 外部重置内容时清空历史 */
  reset: (value: string) => void;
  /** 工具栏命令写完内容后同步输入基线，避免下一次撤销跳回命令前的文本 */
  markBaseline: (value: string) => void;
}

const HISTORY_LIMIT = 100;
const INPUT_DEBOUNCE = 400;

/**
 * 编辑器撤销 / 重做历史
 *
 * 连续输入按 400ms 合并：一次撤销回到这段输入开始前，
 * 而不是逐字符回退。工具栏命令会在执行前单独压栈。
 */
export function useEditorHistory(options: {
  getState: () => TextState;
  applyState: (state: TextResult) => void;
}): EditorHistory {
  const undoStack: Snapshot[] = [];
  const redoStack: Snapshot[] = [];
  const canUndo = ref(false);
  const canRedo = ref(false);

  /** 最近一次已确认的内容，作为下一段输入的快照基线 */
  let baseline = options.getState().value;
  let typingBase: Snapshot | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const sync = (): void => {
    canUndo.value = undoStack.length > 0;
    canRedo.value = redoStack.length > 0;
  };

  const pushUndo = (snapshot: Snapshot): void => {
    const top = undoStack[undoStack.length - 1];
    if (top && top.value === snapshot.value) {
      return;
    }
    undoStack.push(snapshot);
    if (undoStack.length > HISTORY_LIMIT) {
      undoStack.shift();
    }
    redoStack.length = 0;
    sync();
  };

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  /** 把尚未落盘的连续输入立即压栈 */
  const flush = (): void => {
    clearTimer();
    if (typingBase) {
      if (typingBase.value !== options.getState().value) {
        pushUndo(typingBase);
      }
      typingBase = null;
    }
    baseline = options.getState().value;
  };

  const recordInput = (start: number, end: number): void => {
    if (!typingBase) {
      typingBase = { value: baseline, selectionStart: start, selectionEnd: end };
    }
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      if (typingBase && typingBase.value !== options.getState().value) {
        pushUndo(typingBase);
      }
      typingBase = null;
      baseline = options.getState().value;
    }, INPUT_DEBOUNCE);
  };

  const snapshotBeforeEdit = (): void => {
    flush();
    const current = options.getState();
    pushUndo({ ...current });
    baseline = current.value;
  };

  const undo = (): void => {
    flush();
    const previous = undoStack.pop();
    if (!previous) {
      sync();
      return;
    }
    redoStack.push({ ...options.getState() });
    options.applyState(previous);
    baseline = previous.value;
    sync();
  };

  const redo = (): void => {
    flush();
    const next = redoStack.pop();
    if (!next) {
      sync();
      return;
    }
    undoStack.push({ ...options.getState() });
    options.applyState(next);
    baseline = next.value;
    sync();
  };

  const reset = (value: string): void => {
    clearTimer();
    typingBase = null;
    undoStack.length = 0;
    redoStack.length = 0;
    baseline = value;
    sync();
  };

  const markBaseline = (value: string): void => {
    baseline = value;
  };

  return { canUndo, canRedo, recordInput, snapshotBeforeEdit, undo, redo, reset, markBaseline };
}
