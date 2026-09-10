import { siteConfig } from "../config/site";

const TITLE_SEPARATOR = " · ";

/** 浏览器标签默认标题（与 index.html 一致） */
export const defaultDocumentTitle = siteConfig.name;

/** 截断过长标题，避免标签栏显示不全 */
export function truncateForDocumentTitle(text: string, maxLength = 50): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "未命名文章";
  }
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

/** 文章页标签标题：`{post-title} · {website name}` */
export function formatPostPageTitle(postTitle: string): string {
  return `${truncateForDocumentTitle(postTitle)}${TITLE_SEPARATOR}${siteConfig.name}`;
}
