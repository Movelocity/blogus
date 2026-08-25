/**
 * 全项目可复用的剪贴板工具。
 *
 * 写剪贴板时优先使用 Web Clipboard API（`navigator.clipboard.writeText`），
 * 该 API 只在安全上下文（HTTPS 或 localhost）中可用。
 * 若处于非 HTTPS 页面（如以 IP/明文 http 访问）或 Clipboard API 被拒绝，
 * 自动回退到「临时 textarea + execCommand('copy')」方案：
 * 创建一个不占用布局、不可见的 textarea，插入页面后选中内容并触发复制，
 * 复制完成立即移除该临时元素，避免影响页面布局与滚动位置。
 */
export async function copyText(text: string): Promise<boolean> {
  // 安全上下文（HTTPS / localhost）且暴露 Clipboard API 时直接写入
  if (window.isSecureContext && typeof navigator.clipboard?.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 权限被拒绝等异常，回退到 textarea 方案
    }
  }

  return copyTextViaTextarea(text);
}

function copyTextViaTextarea(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");

  // 定位到可视区域之外、透明、不参与布局，避免产生滚动或布局跳动；
  // 保留 1px 尺寸以满足部分 iOS 浏览器的选中要求。
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    textarea.remove();
  }
  return ok;
}
