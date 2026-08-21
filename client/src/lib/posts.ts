import type { BlogPost } from "@blogus/shared";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric"
});

const monthFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long"
});

export function getPostDate(post: BlogPost) {
  return post.publishedAt ?? post.createdAt;
}

export function formatPostDate(value?: string) {
  if (!value) {
    return "已发布";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "已发布" : dateFormatter.format(date);
}

export function formatPostMonth(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未归档" : monthFormatter.format(date);
}

export function countContentChars(content: string) {
  return content.replace(/\s/g, "").length;
}

export function estimateReadingMinutes(content: string) {
  const normalized = content.trim();
  if (!normalized) {
    return 1;
  }

  const cjkCount = (normalized.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latinWordCount = (normalized.replace(/[\u4e00-\u9fff]/g, " ").match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(1, Math.ceil((cjkCount + latinWordCount) / 500));
}

export function getPostSummary(post: BlogPost, maxLength = 120) {
  const source = post.excerpt?.trim();
  if (!source) {
    return "这篇文章暂未设置摘要，打开后阅读全文。";
  }

  return source.length > maxLength ? `${source.slice(0, maxLength)}...` : source;
}

export function sortPostsByPublishedDate(posts: BlogPost[]) {
  return [...posts].sort((left, right) => new Date(getPostDate(right)).getTime() - new Date(getPostDate(left)).getTime());
}
