const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)/g;

function isSafeImageUrl(url: string) {
  const trimmed = url.trim();
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  );
}

/** 按正文阅读顺序收集可浏览图片（封面优先） */
export function collectGalleryImages(coverImageUrl: string | null | undefined, markdown: string): string[] {
  const urls: string[] = [];
  if (coverImageUrl && isSafeImageUrl(coverImageUrl)) {
    urls.push(coverImageUrl.trim());
  }
  let match: RegExpExecArray | null;
  MARKDOWN_IMAGE_RE.lastIndex = 0;
  while ((match = MARKDOWN_IMAGE_RE.exec(markdown))) {
    const src = match[1]?.trim() ?? "";
    if (isSafeImageUrl(src)) urls.push(src);
  }
  return urls;
}
