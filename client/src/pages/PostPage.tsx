import { Link, useParams } from "react-router";
import { useEffect, useState } from "react";
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

export function PostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
    return <PostSkeleton />;
  }

  if (error || !post) {
    return (
      <section className="grid max-w-2xl gap-6 border border-destructive/30 bg-destructive/5 p-8">
        <div className="grid gap-3">
          <h1 className="m-0 font-display text-3xl text-foreground">无法打开这篇文章</h1>
          <p className="m-0 leading-relaxed text-muted-foreground">{error ?? "文章不存在，或尚未发布。"}</p>
        </div>
        <Link
          className="inline-flex w-fit items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 active:translate-y-px"
          to="/"
        >
          返回首页
        </Link>
      </section>
    );
  }

  const readingMinutes = estimateReadingMinutes(post.content);

  return (
    <article className="mx-auto w-full min-w-0 max-w-[728px] px-6">
      <header className="pt-8 mb-8">
        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <span>{formatPostDate(post.publishedAt)}</span>
            <span className="hidden md:inline">·</span>
            <span>{readingMinutes} 分钟阅读</span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              title="复制文章链接"
              aria-label="复制文章链接"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ShareNetworkIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleCopyMarkdown()}
              title="复制 Markdown 原文"
              aria-label="复制 Markdown 原文"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CopyIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <h1 className="m-0 break-words text-[28px] font-medium leading-[1.3] text-foreground md:text-[38px] md:font-semibold md:leading-[1.25]">
          {post.title}
        </h1>

        {post.coverImageUrl ? (
          <div className="mt-8">
            <img
              alt=""
              className="block w-full object-cover max-[679px]:rounded-none min-[680px]:rounded-lg"
              src={post.coverImageUrl}
            />
          </div>
        ) : null}

        {post.excerpt ? (
          <p className="m-0 mt-5 text-base leading-relaxed text-muted-foreground">{post.excerpt}</p>
        ) : null}
      </header>

      <div className="min-h-[60vh]">
        <MarkdownView content={post.content} article />
      </div>

      {post.tags.length > 0 ? (
        <footer className="mt-6 text-[13px] text-muted-foreground md:text-[15px]">
          <div className="flex flex-wrap gap-4 md:gap-6">
            {post.tags.map((tag) => (
              <span className="inline-flex items-center gap-1.5" key={tag}>
                <span aria-hidden="true">#</span>
                <span>{tag}</span>
              </span>
            ))}
          </div>
        </footer>
      ) : null}
      <ToastView toasts={toasts} onDismiss={dismiss} />
    </article>
  );
}

function PostSkeleton() {
  return (
    <article className="mx-auto w-full min-w-0 max-w-[728px] px-6" aria-label="文章正在加载">
      <header className="pt-8 mb-8">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="h-3 w-40 animate-pulse rounded bg-muted/50" />
          <div className="flex gap-0.5">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted/50" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted/50" />
          </div>
        </div>
        <div className="h-10 w-5/6 animate-pulse rounded bg-muted/50" />
        <div className="mt-8 aspect-video w-full animate-pulse bg-muted/50 max-[679px]:rounded-none min-[680px]:rounded-lg" />
      </header>
      <div className="grid gap-6">
        {[0, 1, 2, 3].map((item) => (
          <div className="grid gap-2" key={item}>
            <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-muted/50" />
          </div>
        ))}
      </div>
    </article>
  );
}
