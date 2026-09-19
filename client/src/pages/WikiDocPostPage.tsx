import { Link, useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import type { BlogPost } from "@blogus/shared";
import { getPostBySlug } from "../lib/api";
import { getHeadings, MarkdownView, preloadMathRendering } from "../lib/markdown";
import { estimateReadingMinutes, formatPostDate, getPostShareUrl } from "../lib/posts";
import { copyText } from "../lib/clipboard";
import { CopyIcon, ShareNetworkIcon } from "@phosphor-icons/react";
import { ToastView, useToast } from "../lib/toast";
import { useToc } from "../contexts/post-toc";
import { formatPostPageTitle } from "../lib/documentTitle";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { V2DocImageLightbox } from "../features/layout-test/v2-doc/V2DocImageLightbox";
import { collectGalleryImages } from "../features/layout-test/v2-doc/collectGalleryImages";

const PUBLIC_POST_API_HINT = `公开文章 API（无需登录，返回 JSON）：
- GET /api/posts — 已发布文章列表，响应 { "posts": [{ "title", "slug", "excerpt", "tags", "publishedAt", ... }] }
- GET /api/posts/:slug — 单篇已发布文章，响应 { "post": { "title", "slug", "content", "excerpt", "tags", "publishedAt", ... } }
默认仅返回 status=published 的文章；草稿与归档需登录并使用 ?visibility=all。`;

export function WikiDocPostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { setHeadings } = useToc();
  const { toasts, dismiss, notify } = useToast();

  useDocumentTitle(!loading && post ? formatPostPageTitle(post.title) : undefined);

  useEffect(() => {
    if (!slug) {
      setError("文章地址无效");
      setLoading(false);
      return;
    }

    setLoading(true);
    getPostBySlug(slug)
      .then((result) => {
        preloadMathRendering(result.post.content);
        setPost(result.post);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "加载失败");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!post) return;
    const headings = getHeadings(post.content);
    setHeadings(headings);
    return () => setHeadings([]);
  }, [post, setHeadings]);

  const galleryUrls = useMemo(
    () => (post ? collectGalleryImages(post.coverImageUrl, post.content) : []),
    [post],
  );
  const markdownGalleryStart = post?.coverImageUrl ? 1 : 0;

  const handleCopyMarkdown = async () => {
    if (!post) return;
    const ok = await copyText(post.content);
    notify(ok ? "Markdown 原文已复制到剪贴板" : "复制失败，请手动选择", ok ? "success" : "error");
  };

  const handleCopyLink = async () => {
    if (!post) return;
    const ok = await copyText(getPostShareUrl(post.slug));
    notify(ok ? "文章链接已复制到剪贴板" : "复制失败，请手动选择", ok ? "success" : "error");
  };

  if (loading) {
    return <WikiDocSkeleton />;
  }

  if (error || !post) {
    return (
      <section className="mx-auto grid max-w-2xl gap-6 border border-destructive/30 bg-destructive/5 p-8">
        <div className="grid gap-3">
          <h1 className="m-0 text-2xl font-semibold text-[#1a1a1a]">无法打开这篇文章</h1>
          <p className="m-0 leading-relaxed text-[#666]">{error ?? "文章不存在，或尚未发布。"}</p>
        </div>
        <Link
          className="inline-flex w-fit items-center rounded-full bg-[#136ec2] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0f5da3]"
          to="/"
        >
          返回首页
        </Link>
      </section>
    );
  }

  const readingMinutes = estimateReadingMinutes(post.content);

  return (
    <article className="w-full min-w-0">
      <div hidden>{PUBLIC_POST_API_HINT}</div>

      <header className="v2-doc-header">
        <div className="v2-doc-meta">
          <div className="v2-doc-meta-text">
            <span>{formatPostDate(post.createdAt)}</span>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span>{readingMinutes} 分钟阅读</span>
          </div>
          <div className="v2-doc-meta-actions">
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              title="复制文章链接"
              aria-label="复制文章链接"
              className="v2-doc-meta-btn"
            >
              <ShareNetworkIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleCopyMarkdown()}
              title="复制 Markdown 原文"
              aria-label="复制 Markdown 原文"
              className="v2-doc-meta-btn"
            >
              <CopyIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <h1 className="v2-doc-title">{post.title}</h1>
        {post.excerpt ? <p className="v2-doc-subtitle">{post.excerpt}</p> : null}
      </header>

      <div className="v2-doc-body min-h-[60vh]">
        {post.coverImageUrl ? (
          <figure className="v2-doc-figure">
            <button type="button" className="v2-gallery-trigger" onClick={() => setLightboxIndex(0)}>
              <img alt="" className="v2-gallery-img" src={post.coverImageUrl} />
            </button>
          </figure>
        ) : null}
        <MarkdownView
          article
          content={post.content}
          galleryImageStartIndex={markdownGalleryStart}
          onGalleryImageOpen={setLightboxIndex}
        />
      </div>

      <V2DocImageLightbox
        index={lightboxIndex}
        urls={galleryUrls}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />

      {post.tags.length > 0 ? (
        <footer className="mt-8 border-t border-[#e8e8e8] pt-4 text-[13px] text-[#666]">
          <div className="flex flex-wrap gap-3">
            {post.tags.map((tag) => (
              <span className="inline-flex items-center gap-1" key={tag}>
                <span aria-hidden="true">#</span>
                <span>{tag}</span>
              </span>
            ))}
          </div>
        </footer>
      ) : null}

      {/* <p className="mt-6 text-xs text-[#999]">
        旧版文章页：
        <Link className="ml-1 text-[#136ec2] hover:underline" to={`/legacy/posts/${post.slug}`}>
          /legacy/posts/{post.slug}
        </Link>
      </p> */}
      <ToastView toasts={toasts} onDismiss={dismiss} />
    </article>
  );
}

function WikiDocSkeleton() {
  return (
    <article className="w-full min-w-0" aria-label="文章正在加载">
      <div className="mb-4 h-6 w-36 animate-pulse rounded bg-[#eee]" />
      <header className="border-b border-[#e8e8e8] pb-6 pt-8">
        <div className="mb-3 h-3 w-40 animate-pulse rounded bg-[#eee]" />
        <div className="h-9 w-4/5 animate-pulse rounded bg-[#eee]" />
        <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-[#eee]" />
      </header>
      <div className="mt-6 grid gap-4">
        {[0, 1, 2, 3].map((item) => (
          <div className="grid gap-2" key={item}>
            <div className="h-4 w-full animate-pulse rounded bg-[#eee]" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-[#eee]" />
          </div>
        ))}
      </div>
    </article>
  );
}
