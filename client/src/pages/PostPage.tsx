import { Link, useParams } from "react-router";
import { useEffect, useState } from "react";
import type { BlogPost } from "@blogus/shared";
import { getPostBySlug } from "../lib/api";
import { MarkdownView } from "../lib/markdown";
import { estimateReadingMinutes, formatPostDate } from "../lib/posts";

export function PostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setError("文章地址无效");
      setLoading(false);
      return;
    }

    setLoading(true);
    getPostBySlug(slug)
      .then((result) => {
        setPost(result.post);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "加载失败");
      })
      .finally(() => setLoading(false));
  }, [slug]);

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
          className="inline-flex w-fit items-center rounded-full bg-foreground px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-foreground/90 active:translate-y-px"
          to="/"
        >
          返回首页
        </Link>
      </section>
    );
  }

  return (
    <article className="mx-auto w-full min-w-0 max-w-304">
      <header className="grid gap-8 border-b border-foreground/10 pb-10">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-0">
          <Link
            className="inline-flex w-fit items-center gap-2 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
            to="/archive"
          >
            <span className="h-px w-6 bg-foreground/30" />
            返回归档
          </Link>
        </div>
        {post.coverImageUrl ? (
          <img
            alt=""
            className="mx-auto max-h-[520px] w-full max-w-5xl border border-foreground/10 object-cover"
            src={post.coverImageUrl}
          />
        ) : null}
        <div className="mx-auto grid w-full max-w-3xl gap-5 px-4 sm:px-0">
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-muted-foreground">
            <span>{formatPostDate(post.publishedAt)}</span>
            <span className="h-px w-4 bg-foreground/20" />
            <span>{estimateReadingMinutes(post.content)} 分钟阅读</span>
          </div>
          <h1 className="m-0 break-words font-display text-5xl leading-[1.05] tracking-tight text-foreground md:text-6xl lg:text-7xl">
            {post.title}
          </h1>
          {post.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  className="border border-foreground/10 bg-secondary px-2.5 py-1 font-mono text-xs text-muted-foreground"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {post.excerpt ? (
            <p className="m-0 text-xl leading-relaxed text-muted-foreground">{post.excerpt}</p>
          ) : null}
        </div>
      </header>

      <div className="relative mt-10 xl:grid xl:grid-cols-[1fr_minmax(0,48rem)_1fr] xl:gap-x-10">
        <aside className="max-xl:hidden">{/* reserved: TOC */}</aside>
        <div className="mx-auto w-full min-w-0 max-w-3xl xl:max-w-none">
          <MarkdownView content={post.content} />
        </div>
        <aside className="max-xl:hidden">{/* reserved: related */}</aside>
      </div>
    </article>
  );
}

function PostSkeleton() {
  return (
    <article className="mx-auto w-full min-w-0 max-w-304" aria-label="文章正在加载">
      <header className="grid gap-8 border-b border-foreground/10 pb-10">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-0">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="mx-auto h-72 w-full max-w-5xl animate-pulse bg-muted" />
        <div className="mx-auto grid w-full max-w-3xl gap-5 px-4 sm:px-0">
          <div className="h-4 w-44 animate-pulse rounded bg-muted" />
          <div className="h-16 w-5/6 animate-pulse rounded bg-muted" />
          <div className="h-20 w-full animate-pulse rounded bg-secondary" />
        </div>
      </header>
      <div className="relative mt-10 xl:grid xl:grid-cols-[1fr_minmax(0,48rem)_1fr] xl:gap-x-10">
        <div className="max-xl:hidden" />
        <div className="mx-auto grid w-full max-w-3xl gap-4 xl:max-w-none">
          {[0, 1, 2, 3].map((item) => (
            <div className="grid gap-2" key={item}>
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="max-xl:hidden" />
      </div>
    </article>
  );
}
