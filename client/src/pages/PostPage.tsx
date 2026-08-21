import { Link, useParams } from "react-router";
import { useEffect, useState } from "react";
import type { BlogPost } from "@blogus/shared";
import { getPostBySlug } from "../lib/api";
import { getHeadings, MarkdownView } from "../lib/markdown";
import { estimateReadingMinutes, formatPostDate } from "../lib/posts";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useToc } from "../components/layouts/PostLayout";

export function PostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { setHeadings } = useToc();

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

  useEffect(() => {
    if (!post) return;
    const headings = getHeadings(post.content);
    setHeadings(headings);
    return () => setHeadings([]);
  }, [post, setHeadings]);

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

  return (
    <article className="mx-auto w-full min-w-0 max-w-3xl">
      <header className="grid gap-8 border-b border-foreground/10 pb-6">
        <div className="grid w-full gap-5 px-4 sm:px-0">
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-muted-foreground">
            <span>{formatPostDate(post.publishedAt)}</span>
            <span className="h-px w-4 bg-foreground/20" />
            <span>{estimateReadingMinutes(post.content)} 分钟阅读</span>
          </div>
          <h1 className="m-0 break-words font-display text-3xl leading-[1.05] tracking-tight text-foreground md:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          {post.coverImageUrl ? (
            <img
              alt=""
              className="mx-auto aspect-video w-full rounded-xl border border-foreground/10 object-cover"
              src={post.coverImageUrl}
            />
          ) : null}
          {post.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  className="border border-foreground/10 bg-trinary px-2.5 py-1 font-mono text-xs text-muted-foreground rounded-md"
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

      <div className="mt-6 mx-auto w-full min-w-0 min-h-[60vh]">
        <MarkdownView content={post.content} underlineH1 />
      </div>
    </article>
  );
}

function PostSkeleton() {
  return (
    <article className="mx-auto w-full min-w-0 max-w-3xl" aria-label="文章正在加载">
      <header className="grid gap-8 border-b border-foreground/10 pb-10">
        <div className="px-4 sm:px-0">
          <div className="h-4 w-20 animate-pulse rounded bg-muted/50" />
        </div>
        <div className="mx-auto aspect-video w-full animate-pulse rounded-xl bg-muted/50" />
        <div className="grid w-full gap-5 px-4 sm:px-0">
          <div className="h-4 w-44 animate-pulse rounded bg-muted/50" />
          <div className="h-16 w-5/6 animate-pulse rounded bg-muted/50" />
          <div className="h-20 w-full animate-pulse rounded bg-muted/50" />
        </div>
      </header>
      <div className="mt-6 mx-auto grid w-full max-w-3xl gap-4">
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
