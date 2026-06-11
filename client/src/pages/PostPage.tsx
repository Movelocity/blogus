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
      <section className="grid max-w-2xl gap-5 rounded-lg border border-red-200 bg-red-50 p-8 text-red-900">
        <div className="grid gap-2">
          <h1 className="m-0 text-2xl font-semibold">无法打开这篇文章</h1>
          <p className="m-0 leading-7">{error ?? "文章不存在，或尚未发布。"}</p>
        </div>
        <Link
          className="inline-flex w-fit items-center rounded-lg bg-red-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 active:translate-y-px"
          to="/"
        >
          返回首页
        </Link>
      </section>
    );
  }

  return (
    <article className="grid gap-8">
      <header className="grid gap-6 border-b border-slate-200 pb-8">
        <Link className="text-sm font-medium text-teal-700 transition hover:text-teal-900" to="/archive">
          返回归档
        </Link>
        {post.coverImageUrl ? (
          <img
            alt=""
            className="max-h-[520px] w-full rounded-lg border border-slate-200 object-cover"
            src={post.coverImageUrl}
          />
        ) : null}
        <div className="mx-auto grid w-full max-w-3xl gap-4">
          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            <span>{formatPostDate(post.publishedAt)}</span>
            <span>{estimateReadingMinutes(post.content)} 分钟阅读</span>
          </div>
          <h1 className="m-0 break-words text-4xl font-bold leading-tight text-slate-950 md:text-5xl">
            {post.title}
          </h1>
          {post.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {post.excerpt ? <p className="m-0 text-lg leading-8 text-slate-600">{post.excerpt}</p> : null}
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl">
        <MarkdownView content={post.content} />
      </div>
    </article>
  );
}

function PostSkeleton() {
  return (
    <article className="grid gap-8" aria-label="文章正在加载">
      <header className="grid gap-6 border-b border-slate-200 pb-8">
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        <div className="h-72 w-full animate-pulse rounded-lg bg-slate-200" />
        <div className="mx-auto grid w-full max-w-3xl gap-4">
          <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
          <div className="h-12 w-5/6 animate-pulse rounded bg-slate-200" />
          <div className="h-20 w-full animate-pulse rounded bg-slate-100" />
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        {[0, 1, 2, 3].map((item) => (
          <div className="grid gap-2" key={item}>
            <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </article>
  );
}
