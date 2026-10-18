/**
 * 复制文本到剪贴板
 *
 * 优先使用异步 Clipboard API（需要安全上下文，localhost 与 https 均满足）；
 * 不可用或被拒绝时退回隐藏 textarea + execCommand，兼容 http 内网部署。
 */
export const copyText = async (text: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 权限被拒或非安全上下文时继续走兜底
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("浏览器拒绝了复制操作");
    }
  } finally {
    document.body.removeChild(textarea);
  }
};
